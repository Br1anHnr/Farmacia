import { afterEach, expect, it, vi } from "vitest";
import { hubLoginDestination, watchHubSession } from "../lib/hub-session";
afterEach(() => { vi.unstubAllGlobals(); });
it("atualiza o gerente para atendente em outra aba e limpa sessão expirada", async () => {
  const windowTarget = new EventTarget();
  Object.assign(windowTarget, { setInterval: () => 1, clearInterval: () => {} });
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ user: { role: "manager" }, chatwoot_account_id: 1 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ user: { role: "agent" }, chatwoot_account_id: 1 })))
    .mockResolvedValueOnce(new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetcher);
  const update = vi.fn();
  const stop = watchHubSession(update);
  try {
    await vi.waitFor(() => expect(update.mock.lastCall?.[0].user?.role).toBe("manager"));
    windowTarget.dispatchEvent(new Event("mf:session-changed"));
    expect(update.mock.lastCall?.[0]).toMatchObject({ user: null, loading: true });
    await vi.waitFor(() => expect(update.mock.lastCall?.[0].user?.role).toBe("agent"));
    windowTarget.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(update.mock.lastCall?.[0]).toMatchObject({ user: null, loading: false }));
    expect(fetcher.mock.calls.every(call => call[0] === "/api/auth/me" && call[1].cache === "no-store")).toBe(true);
  } finally { stop(); }
});
it("não redireciona o login para domínio externo", () => {
  expect(hubLoginDestination("//evil.invalid", "/dashboard")).toBe("/dashboard");
  expect(hubLoginDestination("/dashboard", "/chatwoot-widget")).toBe("/dashboard");
});
