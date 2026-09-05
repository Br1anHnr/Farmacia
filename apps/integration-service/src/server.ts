import express, { type Request, type Response } from "express";
import { CONFIG } from "./config.js";
import { agentBotService } from "./services/agentbot.js";
import {
  validSignature,
  validInternalToken,
  eventDigest,
} from "./services/webhook-security.js";
export const app = express();
app.disable("x-powered-by");
app.use(
  express.json({
    limit: "256kb",
    verify(req, _res, buf) {
      (req as Request & { rawBody: Buffer }).rawBody = buf;
    },
  }),
);
async function rpc(name: string, body: unknown) {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SECRET_KEY)
    throw new Error("PERSISTENCE_UNAVAILABLE");
  const response = await fetch(CONFIG.SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: CONFIG.SUPABASE_SECRET_KEY,
      Authorization: "Bearer " + CONFIG.SUPABASE_SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("PERSISTENCE_FAILED");
  return response.status === 204 ? null : response.json();
}
app.get("/internal/health", (req, res) => {
  if (!validInternalToken(req.header("authorization"), CONFIG.INTERNAL_TOKEN))
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  return res.json({
    status: "process_running",
    service: "MultiFarma Integration Hub",
    channels: "not_checked",
  });
});
// Browser operations are served only by the authenticated Next handlers.
app.all("/api/*", (_req, res) =>
  res.status(410).json({ error: "USE_AUTHENTICATED_HUB_API" }),
);
async function webhook(req: Request, res: Response) {
  if(CONFIG.MOCK_MODE && CONFIG.NODE_ENV!=="test") return res.status(503).json({error:"MOCK_MODE_RESTRICTED_TO_TESTS"});
  if (CONFIG.WEBHOOK_SECRET.length < 32)
    return res.status(503).json({ error: "WEBHOOK_CONFIGURATION_REQUIRED" });
  const raw = (req as Request & { rawBody: Buffer }).rawBody;
  if (
    !raw ||
    !validSignature(
      raw,
      req.header("x-hub-timestamp"),
      req.header("x-hub-signature"),
      CONFIG.WEBHOOK_SECRET,
    )
  )
    return res.status(401).json({ error: "INVALID_SIGNATURE" });
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    return res.status(400).json({ error: "INVALID_EVENT" });
  const body = req.body,
    conv =
      body?.conversation ||
      (String(body?.event || "").startsWith("conversation_") ? body : null);
  const msg = body?.message || body;
  if (
    (msg.attachments != null &&
      (!Array.isArray(msg.attachments) ||
        msg.attachments.some(
          (a: unknown) => !a || typeof a !== "object" || Array.isArray(a),
        ))) ||
    (msg.content != null && typeof msg.content !== "string")
  )
    return res.status(400).json({ error: "INVALID_MESSAGE" });
  const account = body?.account?.id ?? conv?.account_id;
  if (
    !Number.isSafeInteger(account) ||
    account !== CONFIG.CHATWOOT_ACCOUNT_ID ||
    (conv?.account_id != null && conv.account_id !== account)
  )
    return res.status(403).json({ error: "ACCOUNT_DENIED" });
  const inbox = conv?.inbox_id ?? body?.inbox?.id;
  if (
    !Number.isSafeInteger(inbox) ||
    inbox <= 0 ||
    (body.inbox?.id != null && body.inbox.id !== inbox) ||
    (msg.inbox_id != null && msg.inbox_id !== inbox)
  )
    return res.status(403).json({ error: "INBOX_DENIED" });
  let mapping: any;
  try {
    mapping = JSON.parse(CONFIG.INBOX_MAP)[String(inbox)];
  } catch {
    return res.status(503).json({ error: "INBOX_CONFIGURATION_REQUIRED" });
  }
  if (
    !mapping ||
    !/^[a-f0-9-]{36}$/i.test(mapping.organization_id || "") ||
    !/^[a-f0-9-]{36}$/i.test(mapping.branch_id || "") ||
    !["whatsapp", "instagram", "facebook"].includes(mapping.channel)
  )
    return res.status(403).json({ error: "INBOX_DENIED" });
  if (!Number.isSafeInteger(conv?.id) || conv.id <= 0)
    return res.status(400).json({ error: "INVALID_CONVERSATION" });
  const event = body.event;
  if (
    ![
      "message_created",
      "conversation_updated",
      "conversation_status_changed",
      "conversation_created",
    ].includes(event)
  )
    return res.status(400).json({ error: "UNSUPPORTED_EVENT" });
  const isMessage = event === "message_created";
  if (isMessage && !/^[1-9]\d*$/.test(String(msg.id || "")))
    return res.status(400).json({ error: "STABLE_EVENT_ID_REQUIRED" });
  const revision = body.updated_at ?? conv.updated_at;
  if (
    !isMessage &&
    ((typeof revision !== "number" && typeof revision !== "string") ||
      !Number.isFinite(
        new Date(
          typeof revision === "number" ? revision * 1000 : revision,
        ).getTime(),
      ))
  )
    return res.status(400).json({ error: "STABLE_REVISION_REQUIRED" });
  const incoming =
    isMessage &&
    (msg.message_type === 0 || msg.message_type === "incoming") &&
    !msg.private;
  const sender = msg.sender || conv.meta?.sender;
  const assignee = conv.assignee_id ?? conv.meta?.assignee?.id ?? null;
  const human =
    !!assignee ||
    msg.private === true ||
    (isMessage &&
      !incoming &&
      msg.sender_type !== "AgentBot" &&
      sender?.type !== "agent_bot");
  const identity = {
    account,
    conversation: conv.id,
    inbox,
    event,
    id: isMessage ? String(msg.id) : String(revision),
  };
  const key = eventDigest(identity);
  // Exclude changing conversation metadata from immutable message fingerprint.
  const hash = eventDigest(
    isMessage
      ? {
          ...identity,
          content: msg.content ?? null,
          type: msg.message_type,
          private: !!msg.private,
          sender: sender?.id ?? null,
          attachments: (msg.attachments || []).map((a: any) => a.id),
        }
      : { ...identity, changed: body.changed_attributes ?? null },
  );
  let reserved = false;
  try {
    const state = await rpc("reserve_webhook", { p_key: key, p_hash: hash });
    if (state === "completed") return res.json({ status: "DUPLICATE_IGNORED" });
    if (state !== "acquired")
      return res.status(409).json({
        error:
          state === "conflict"
            ? "EVENT_CONFLICT"
            : "EVENT_RECONCILIATION_REQUIRED",
      });
    reserved = true;
    const context = await rpc("sync_webhook", {
      p_org: mapping.organization_id,
      p_branch: mapping.branch_id,
      p_account: account,
      p_conv: conv.id,
      p_channel: mapping.channel,
      p_contact: incoming && sender?.id != null ? String(sender.id) : null,
      p_name: incoming ? (sender?.name ?? null) : null,
      p_phone: incoming ? (sender?.phone_number ?? null) : null,
      p_human: human,
      p_key: incoming ? key : null,
      p_assignee: assignee,
    });
    if (
      incoming &&
      context.bot_active &&
      !context.assigned_user_id &&
      !context.chatwoot_assignee_id
    ) {
      agentBotService.setConversationState(conv.id, "BOT_ACTIVE");
      const decision = await agentBotService.handleIncomingMessage(
        { ...conv, account_id: account },
        { ...msg, conversation_id: conv.id },
      );
      await rpc("finish_bot_turn", {
        p_org: mapping.organization_id,
        p_conv: conv.id,
        p_key: key,
        p_handoff: decision.transition_to_human,
      });
    } else if (human)
      agentBotService.deactivateBotForConversation(conv.id, "VERIFIED_WEBHOOK");
    await rpc("finish_webhook", { p_key: key, p_state: "completed" });
    return res.json({ status: "PROCESSED" });
  } catch {
    if (reserved) {
      try {
        await rpc("finish_webhook", { p_key: key, p_state: "uncertain" });
      } catch {}
    }
    return res.status(503).json({ error: "EVENT_NOT_COMPLETED" });
  }
}
app.post("/internal/chatwoot/webhook", webhook);
app.post("/internal/chatwoot/agent-bot", webhook);
app.use((_error: unknown, _req: Request, res: Response, _next: unknown) =>
  res.status(400).json({ error: "INVALID_REQUEST_BODY" }),
);
if (process.env.NODE_ENV !== "test")
  app.listen(CONFIG.PORT, () => console.log("Integration service started"));
