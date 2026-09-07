import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as rooms } from "../app/api/chat/rooms/route";
import { GET as messages } from "../app/api/chat/messages/route";
import { httpFixture, user } from "../../../../tests/support/http";

let state: ReturnType<typeof httpFixture>;
beforeEach(() => {
  state = httpFixture();
});

function request(path: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { authorization: "Bearer verified" },
  });
}

describe("Chat interno operacional", () => {
  it("lista apenas salas autorizadas retornadas pelo banco", async () => {
    const response = await rooms(request("/api/chat/rooms"));
    expect(response.status).toBe(200);
    expect((await response.json()).rooms).toEqual([
      expect.objectContaining({ id: expect.any(String), name: "Sala Geral", is_general: true }),
    ]);
  });

  it("resolve o nome do remetente no servidor depois de validar a sala", async () => {
    state.messages = [{
      id: "message-1",
      sender_id: user,
      content: "Olá equipe",
      created_at: "2026-09-05T19:21:00Z",
    }];
    const response = await messages(request("/api/chat/messages?room=geral"));
    expect(response.status).toBe(200);
    expect((await response.json()).messages[0]).toMatchObject({
      sender_id: user,
      sender: "Test User",
    });
  });

  it("não mantém a filial Jardins fixa na interface", () => {
    const source = fs.readFileSync(
      path.resolve("apps/web/src/app/(shared)/chat/page.tsx"),
      "utf8",
    );
    expect(source).not.toContain("Filial Jardins");
    expect(source).toContain("/api/chat/rooms");
  });
});
