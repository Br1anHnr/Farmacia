import { NextResponse, type NextRequest } from "next/server";
import { CloseConversationInputSchema } from "@hub-farmacia/contracts";
import { supabaseRest } from "@/lib/server/supabase";
import { uuid } from "@/lib/server-auth";
import { conversationAccess } from "@/lib/conversation-access";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
  if ("response" in auth) return auth.response;
  if (!["agent", "manager"].includes(auth.context.role))
    return NextResponse.json({ error: "CLOSURE_ACCESS_DENIED" }, { status: 403 });

  const conversationId = Number(params.id);
  const key = request.headers.get("idempotency-key");
  if (!Number.isInteger(conversationId) || conversationId <= 0)
    return NextResponse.json({ error: "INVALID_CONVERSATION" }, { status: 400 });
  if (!key || !uuid.test(key))
    return NextResponse.json(
      { error: "IDEMPOTENCY_KEY_REQUIRED" },
      { status: 400 },
    );

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = CloseConversationInputSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_CLOSURE_INPUT" }, { status: 400 });

  const input =
    parsed.data.outcome === "sale"
      ? (({ agent_id: _agentId, agent_name: _agentName, ...sale }) => sale)(
          parsed.data,
        )
      : parsed.data;
  if (
    input.chatwoot_conversation_id !== conversationId ||
    input.chatwoot_account_id !== auth.accountId ||
    input.organization_id !== auth.context.organizationId ||
    !auth.context.branchIds.includes(input.branch_id)
  )
    return NextResponse.json({ error: "CLOSURE_ACCESS_DENIED" }, { status: 403 });

  if (auth.context.role === "agent" && auth.conversation.assigned_user_id !== auth.context.userId) {
    return NextResponse.json({ error: "CLOSURE_ACCESS_DENIED", message: "Assuma o atendimento antes de encerrá-lo." }, { status: 403 });
  }

  const result = await supabaseRest<any>("rpc/close_conversation", {
    accessToken: auth.context.accessToken,
    method: "POST",
    body: { p_input: input, p_key: key },
  });
  const persisted =
    !result.error &&
    result.data?.persisted === true &&
    result.data?.outcome === input.outcome &&
    (input.outcome !== "sale" || uuid.test(result.data?.sale_id || ""));
  if (!persisted)
    return NextResponse.json(
      {
        error:
          result.status === 409
            ? "CLOSURE_CONFLICT"
            : "CONVERSATION_NOT_CLOSED",
      },
      { status: [400, 403, 409].includes(result.status) ? result.status : 503 },
    );

  // A persisted closure must not be presented as a confirmed Chatwoot resolution.
  let chatwoot_synced = false;
  let note_synced = false;
  const cwBase = process.env.CHATWOOT_BASE_URL;
  const cwToken = process.env.CHATWOOT_API_TOKEN;
  if (cwBase && cwToken) {
    try {
      const response = await fetch(
        `${cwBase}/api/v1/accounts/${auth.accountId}/conversations/${conversationId}/toggle_status`,
        { method: "POST", headers: { "Content-Type": "application/json", api_access_token: cwToken },
          body: JSON.stringify({ status: "resolved" }), signal: AbortSignal.timeout(4000) });
      const status = response.ok ? await response.json() : null;
      chatwoot_synced = response.ok && (status?.status === "resolved" || status?.payload?.status === "resolved");
      if (chatwoot_synced) {
        const messagesUrl = `${cwBase}/api/v1/accounts/${auth.accountId}/conversations/${conversationId}/messages`;
        const headers = { "Content-Type": "application/json", api_access_token: cwToken };
        const marker = `[Hub encerramento ${key}]`;
        const history = await fetch(messagesUrl, { headers, signal: AbortSignal.timeout(4000) });
        if (history.ok) {
          const data = await history.json();
          const messages = Array.isArray(data.payload) ? data.payload : [];
          note_synced = messages.some((message: any) => message.private && message.content?.includes(marker));
          if (!note_synced) {
            const descriptions = { sale: "Venda realizada", not_sold: "Não venda", resolved: "Dúvida resolvida", cancelled: "Cancelado" };
            const note = await fetch(messagesUrl, { method: "POST", headers,
              body: JSON.stringify({ private: true, content: `${marker} ${auth.context.fullName}: ${descriptions[input.outcome]}.${"reason" in input ? ` Motivo: ${input.reason}.` : ""}` }),
              signal: AbortSignal.timeout(4000) });
            note_synced = note.ok;
          }
        }
      }
    } catch { /* The same idempotency key can retry synchronization safely. */ }
  }
  return NextResponse.json({ ...result.data, chatwoot_synced, note_synced,
    message: chatwoot_synced ? undefined : "Desfecho salvo no Hub; encerramento no Chatwoot pendente. Tente novamente para sincronizar." },
    { status: chatwoot_synced ? 201 : 202 });
}
