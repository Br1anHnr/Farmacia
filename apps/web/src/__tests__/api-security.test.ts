import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as products } from "../app/api/products/route";
import { POST as sale } from "../app/api/sales/route";
import {
  GET as chatGet,
  POST as chatPost,
} from "../app/api/chat/messages/route";
import { GET as suggestions } from "../app/api/conversations/[id]/suggestions/route";
import {
  GET as claimGet,
  POST as claimPost,
} from "../app/api/conversations/[id]/claim/route";
import { httpFixture, user } from "../../../../tests/support/http";
let state: ReturnType<typeof httpFixture>;
beforeEach(() => {
  state = httpFixture();
});
const handlers = [
  ["products", products, "GET"],
  ["sale", sale, "POST"],
  ["chatGet", chatGet, "GET"],
  ["chatPost", chatPost, "POST"],
  ["suggestions", suggestions, "GET"],
  ["claimGet", claimGet, "GET"],
  ["claimPost", claimPost, "POST"],
] as const;
describe("Todas as APIs sensíveis — autenticação, escopo, CSRF e falhas", () => {
  it.each(handlers)(
    "%s recusa papel forjado sem sessão",
    async (_name, handler, method) => {
      const req = new NextRequest("http://localhost:3000/api/test", {
        method,
        headers: { "x-user-role": "manager" },
      });
      const res = await handler(req, { params: { id: "101" } });
      expect(res.status).toBe(401);
      expect(state.calls).toHaveLength(0);
    },
  );
  it.each([suggestions, claimGet, claimPost])(
    "não acessa conversa invisível",
    async (handler) => {
      state.conversation = false;
      const req = new NextRequest("http://localhost:3000/api/test", {
        headers: { authorization: "Bearer verified" },
      });
      expect((await handler(req, { params: { id: "101" } })).status).toBe(404);
      expect(
        state.calls.some((c) => c.url.hostname === "chatwoot.invalid"),
      ).toBe(false);
    },
  );
  it.each([sale, chatPost, claimPost])(
    "rejeita CSRF antes de acessar dados",
    async (handler) => {
      const req = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          cookie: "sb_access_token=verified",
          origin: "https://evil.invalid",
        },
        body: "{}",
      });
      expect((await handler(req, { params: { id: "101" } })).status).toBe(403);
      expect(state.calls).toHaveLength(0);
    },
  );
  it("chat rejeita sala sem vínculo", async () => {
    state.room = false;
    expect(
      (
        await chatGet(
          new NextRequest("http://localhost:3000/api/chat/messages", {
            headers: { authorization: "Bearer verified" },
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("chat obtém remetente no servidor e confirma somente escrita real", async () => {
    const req = () =>
      new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "POST",
        headers: { authorization: "Bearer verified" },
        body: JSON.stringify({
          room: "geral",
          content: "local",
          sender_id: "forged",
        }),
      });
    expect((await (await chatPost(req())).json()).message.sender_id).toBe(user);
    state.fail = "internal_messages";
    expect((await chatPost(req())).status).toBe(503);
  });
  it("claim não confirma sucesso quando Chatwoot falha", async () => {
    state.fail = "assignments";
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { authorization: "Bearer verified" },
    });
    expect((await claimPost(req, { params: { id: "101" } })).status).toBe(502);
  });
});
