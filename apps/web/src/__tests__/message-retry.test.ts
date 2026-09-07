import { beforeEach, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/chat/messages/route";
import { submissionKey } from "../lib/submission-key";
import { httpFixture, otherAgentUser } from "../../../../tests/support/http";
let state: ReturnType<typeof httpFixture>;
beforeEach(() => { state = httpFixture(); });
const key = "12345678-1234-4234-8234-123456789abc";
const request = (content = "Mensagem teste", message_id = key) => new NextRequest("http://localhost:3000/api/chat/messages", {
  method: "POST", headers: { authorization: "Bearer verified" }, body: JSON.stringify({ room: "geral", content, message_id }),
});
it("repete mensagem sem duplicação após resposta perdida", async () => {
  expect((await POST(request())).status).toBe(201);
  const replay = await POST(request());
  expect(replay.status).toBe(200);
  expect((await replay.json()).replayed).toBe(true);
  expect(state.messages).toHaveLength(1);
});
it("não sobrescreve conteúdo com a mesma chave", async () => {
  await POST(request());
  expect((await POST(request("Texto diferente"))).status).toBe(409);
  expect(state.messages[0].content).toBe("Mensagem teste");
});
it("não devolve mensagem de outro remetente em conflito", async () => {
  await POST(request());
  state.messages[0].sender_id = otherAgentUser;
  expect((await POST(request())).status).toBe(409);
});
it("valida chave e persiste somente em sala autorizada", async () => {
  expect((await POST(request("Texto", "invalid"))).status).toBe(400);
  state.room = false;
  expect((await POST(request())).status).toBe(403);
  expect(state.messages).toHaveLength(0);
});
it("não confirma escrita indisponível", async () => {
  state.fail = "internal_messages";
  expect((await POST(request())).status).toBe(503);
});
it("reutiliza chave de envio e encerramento apenas para o mesmo payload", () => {
  const submission = submissionKey();
  const first = submission.forPayload({ room: 1, content: "Oi" });
  expect(submission.forPayload({ room: 1, content: "Oi" })).toBe(first);
  expect(submission.forPayload({ room: 2, content: "Oi" })).not.toBe(first);
  submission.reset();
  expect(submission.forPayload({ room: 1, content: "Oi" })).not.toBe(first);
});
