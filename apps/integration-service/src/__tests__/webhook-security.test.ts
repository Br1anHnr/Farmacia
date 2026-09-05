import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { createHmac } from "node:crypto";
import { request as httpRequest } from "node:http";
import type { Server } from "node:http";
import { app } from "../server";
import { CONFIG } from "../config";
import { agentBotService } from "../services/agentbot";
import { validSignature } from "../services/webhook-security";
let server: Server,
  port: number,
  calls: string[],
  fail: string,
  receipt: Map<string, { hash: string; state: string }>;
const secret = "test-secret-at-least-32-characters-long";
const org = "11111111-1111-1111-1111-111111111111",
  branch = "22222222-2222-2222-2222-222222222221";
beforeAll(async () => {
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  port = (server.address() as any).port;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});
beforeEach(() => {
  Object.assign(CONFIG, {
    NODE_ENV: "test", MOCK_MODE: true,
    WEBHOOK_SECRET: secret,
    INTERNAL_TOKEN: secret,
    CHATWOOT_ACCOUNT_ID: 1,
    INBOX_MAP: JSON.stringify({
      1: { organization_id: org, branch_id: branch, channel: "whatsapp" },
    }),
    SUPABASE_URL: "https://supabase.invalid",
    SUPABASE_SECRET_KEY: "test",
  });
  receipt = new Map();
  calls = [];
  fail = "";
  vi.spyOn(agentBotService, "handleIncomingMessage").mockResolvedValue({
    should_respond: false,
    intent_detected: "UNKNOWN",
    confidence: 1,
    transition_to_human: false,
    reason: "test",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, options: any) => {
      const name = String(url).split("/").pop()!;
      calls.push(name);
      if (name === fail) return new Response("{}", { status: 503 });
      const body = JSON.parse(options.body);
      let data: any = null;
      if (name === "reserve_webhook") {
        const old = receipt.get(body.p_key);
        data = old
          ? old.hash === body.p_hash
            ? old.state
            : "conflict"
          : "acquired";
        if (!old)
          receipt.set(body.p_key, { hash: body.p_hash, state: "processing" });
      } else if (name === "finish_webhook")
        receipt.get(body.p_key)!.state = body.p_state;
      else if (name === "sync_webhook")
        data = { bot_active: true, assigned_user_id: null };
      return new Response(JSON.stringify(data), { status: 200 });
    }),
  );
});
const payload = () => ({
  event: "message_created",
  id: 1,
  account: { id: 1 },
  conversation: { id: 101, account_id: 1, inbox_id: 1 },
  message_type: "incoming",
  content: "Synthetic message",
  sender: { id: 7, name: "Test" },
});
function send(
  body: any = payload(),
  overrides: Record<string, string> = {},
  path = "/internal/chatwoot/webhook",
  timestamp = Math.floor(Date.now() / 1000).toString(),
) {
  const raw = JSON.stringify(body),
    signature =
      "sha256=" +
      createHmac("sha256", secret)
        .update(timestamp + "." + raw)
        .digest("hex");
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path,
        method: path === "/internal/health" ? "GET" : "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-timestamp": timestamp,
          "x-hub-signature": signature,
          ...overrides,
        },
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () =>
          resolve({ status: res.statusCode!, body: JSON.parse(out) }),
        );
      },
    );
    req.on("error", reject);
    req.end(path === "/internal/health" ? undefined : raw);
  });
}
describe("Webhook HTTP em loopback; backend remoto simulado", () => {
  it("nega chamada sem assinatura antes de acessar banco", async () => {
    expect((await send(payload(), { "x-hub-signature": "" })).status).toBe(401);
    expect(calls).toEqual([]);
  });
  it("rejeita assinatura inválida e timestamp expirado", async () => {
    expect(
      (await send(payload(), { "x-hub-signature": "sha256=" + "0".repeat(64) }))
        .status,
    ).toBe(401);
    expect((await send(payload(), {}, undefined, "1000000000")).status).toBe(
      401,
    );
    expect(calls).toEqual([]);
  });
  it("assinatura cobre os bytes exatos e rejeita timestamp futuro", () => {
    const raw = Buffer.from("{}"),
      ts = Math.floor(Date.now() / 1000).toString(),
      sig =
        "sha256=" +
        createHmac("sha256", secret)
          .update(ts + ".")
          .update(raw)
          .digest("hex");
    expect(validSignature(Buffer.from("{ }"), ts, sig, secret)).toBe(false);
    expect(validSignature(raw, String(Number(ts) + 1000), sig, secret)).toBe(
      false,
    );
  });
  it("nega conta e inbox desconhecidos", async () => {
    const body = payload();
    body.account.id = 2;
    expect((await send(body)).status).toBe(403);
    body.account.id = 1;
    body.conversation.inbox_id = 3;
    expect((await send(body)).status).toBe(403);
    expect(calls).toEqual([]);
  });
  it("exige identidade estável do evento", async () => {
    expect((await send({ ...payload(), id: undefined })).status).toBe(400);
    expect(calls).toEqual([]);
  });
  it("não processa com configuração ausente", async () => {
    CONFIG.WEBHOOK_SECRET = "";
    expect((await send()).status).toBe(503);
    expect(calls).toEqual([]);
  });
  it("processa uma vez e reconhece duplicata durável", async () => {
    expect((await send()).status).toBe(200);
    expect((await send()).body.status).toBe("DUPLICATE_IGNORED");
    expect(calls.filter((c) => c === "sync_webhook")).toHaveLength(1);
    expect(agentBotService.handleIncomingMessage).toHaveBeenCalledTimes(1);
  });
  it("duas entregas concorrentes não executam efeitos duas vezes", async () => {
    const responses = await Promise.all([send(), send()]);
    expect(responses.some((r) => r.status === 200)).toBe(true);
    expect(calls.filter((c) => c === "sync_webhook")).toHaveLength(1);
  });
  it("rejeita mesma identidade com conteúdo diferente", async () => {
    await send();
    expect((await send({ ...payload(), content: "different" })).status).toBe(
      409,
    );
  });
  it("deduplica o mesmo evento recebido por webhook e AgentBot", async () => {
    await send();
    const body = payload();
    const bot = {
      event: body.event,
      conversation: body.conversation,
      message: {
        id: body.id,
        message_type: body.message_type,
        content: body.content,
        sender: body.sender,
      },
    };
    expect(
      (await send(bot, {}, "/internal/chatwoot/agent-bot")).body.status,
    ).toBe("DUPLICATE_IGNORED");
  });
  it("falha de reserva não executa bot ou retorna sucesso", async () => {
    fail = "reserve_webhook";
    expect((await send()).status).toBe(503);
    expect(agentBotService.handleIncomingMessage).not.toHaveBeenCalled();
  });
  it("falha após reserva fica incerta e não reenvia efeito automaticamente", async () => {
    fail = "sync_webhook";
    expect((await send()).status).toBe(503);
    fail = "";
    expect((await send()).status).toBe(409);
    expect(agentBotService.handleIncomingMessage).not.toHaveBeenCalled();
  });
  it("falha externa do bot não é sucesso", async () => {
    vi.mocked(agentBotService.handleIncomingMessage).mockRejectedValue(
      new Error("SEND_FAILED"),
    );
    expect((await send()).status).toBe(503);
    expect((await send()).status).toBe(409);
  });
  it("rotas duplicadas do serviço não contornam autorização do Hub", async () => {
    expect((await send({}, {}, "/api/conversations/101/claim")).status).toBe(
      410,
    );
  });
});

it("health exige credencial interna e não inventa conexão de canais", async () => {
  expect((await send({}, {}, "/internal/health")).status).toBe(401);
  const res = await send(
    {},
    { authorization: "Bearer " + secret },
    "/internal/health",
  );
  expect(res.status).toBe(200);
  expect(res.body.channels).toBe("not_checked");
});
it("rejeita estrutura assinada inválida antes de reservar evento", async () => {
  expect((await send({ ...payload(), attachments: "invalid" })).status).toBe(
    400,
  );
  expect(calls).toEqual([]);
});

it("rejeita anexo nulo e revisão não escalar sem lançar erro fora do handler", async () => {
  expect((await send({ ...payload(), attachments: [null] })).status).toBe(400);
  expect(
    (
      await send({
        ...payload(),
        event: "conversation_updated",
        updated_at: { toString: null },
      })
    ).status,
  ).toBe(400);
});

it("não aceita sucesso simulado fora do ambiente de testes",async()=>{CONFIG.NODE_ENV="production";expect((await send()).status).toBe(503);expect(calls).toEqual([]);});
