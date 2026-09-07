import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { middleware } from "../middleware";
import { POST as login } from "../app/api/auth/login/route";
import { POST as logout } from "../app/api/auth/logout/route";
import { GET as me } from "../app/api/auth/me/route";
import { NextRequest } from "next/server";
import { httpFixture } from "../../../../tests/support/http";
let state: ReturnType<typeof httpFixture>;
afterEach(() => vi.unstubAllEnvs());
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
  it("preserva conversa e conta ao redirecionar uma sessão ausente", async () => {
    const response = await middleware(new NextRequest("http://localhost:3000/chatwoot-widget?account_id=1&conversation_id=2"));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("redirect")).toBe("/chatwoot-widget?account_id=1&conversation_id=2");
  });
  it("retorna identidade e conta configurada somente com sessão validada", async () => {
    const response = await me(new NextRequest("http://localhost:3000/api/auth/me", { headers: { authorization: "Bearer verified" } }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const data = await response.json();
    expect(data.user.role).toBe("manager");
    expect(data.chatwoot_account_id).toBe(1);
    expect((await me(new NextRequest("http://localhost:3000/api/auth/me"))).status).toBe(401);
  });
  it("usa cookie seguro no iframe e remove o mesmo cookie na saída", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CHATWOOT_ORIGIN", "https://chatwoot.invalid");
    const response = await login(request("/api/auth/login", { email: "test@example.invalid", password: "synthetic" }));
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("SameSite=none");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    const signedOut = await logout(request("/api/auth/logout", {}, "sb_access_token=verified"));
    expect(signedOut.headers.get("set-cookie")).toContain("SameSite=none");
    expect(signedOut.headers.get("set-cookie")).toContain("Max-Age=0");
    const foreign = new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST", headers: { origin: "https://chatwoot.invalid", cookie: "sb_access_token=verified" } });
    expect((await logout(foreign)).status).toBe(403);
  });
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
