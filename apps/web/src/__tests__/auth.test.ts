import { describe, it, expect, beforeEach } from "vitest";
import { POST as login } from "../app/api/auth/login/route";
import { POST as logout } from "../app/api/auth/logout/route";
import { GET as me } from "../app/api/auth/me/route";
import { NextRequest } from "next/server";
import { httpFixture } from "../../../../tests/support/http";
let state: ReturnType<typeof httpFixture>;
beforeEach(() => {
  state = httpFixture("manager");
});
function request(path: string, body: any = {}, cookie = "") {
  return new NextRequest("http://localhost:3000" + path, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
}
describe("Autenticação — HTTP isolado, não homologação GoTrue", () => {
  it.each(["manager", "agent", "admin"])(
    "login %s usa vínculo servidor e cookies HttpOnly",
    async (role) => {
      state.role = role;
      const res = await login(
        request("/api/auth/login", {
          email: "test@example.invalid",
          password: "synthetic",
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.role).toBe(role);
      expect(body.redirectTo).toBe(
        role === "manager" ? "/dashboard" : "/chatwoot-widget",
      );
      expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    },
  );
  it("rejeita senha incorreta", async () => {
    expect(
      (
        await login(
          request("/api/auth/login", {
            email: "test@example.invalid",
            password: "wrong",
          }),
        )
      ).status,
    ).toBe(401);
  });
  it("não inventa organização ou filial no login", async () => {
    state.members = false;
    expect(
      (
        await login(
          request("/api/auth/login", {
            email: "test@example.invalid",
            password: "synthetic",
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("me valida token e recusa falta de vínculo", async () => {
    state.branches = false;
    expect(
      (
        await me(
          new NextRequest("http://localhost:3000/api/auth/me", {
            headers: { authorization: "Bearer verified" },
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("logout verifica retorno remoto e expira cookies", async () => {
    const res = await logout(
      request("/api/auth/logout", {}, "sb_access_token=verified"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("logout não relata revogação bem-sucedida se serviço falhar", async () => {
    state.fail = "logout";
    const res = await logout(
      request("/api/auth/logout", {}, "sb_access_token=verified"),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).success).toBe(false);
  });
  it("bloqueia login com origem cruzada", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { origin: "https://evil.invalid" },
      body: "{}",
    });
    expect((await login(req)).status).toBe(403);
    expect(state.calls).toHaveLength(0);
  });
});
