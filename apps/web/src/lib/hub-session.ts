import type { UserContext } from "./auth-store";

const changeKey = "mf_session_changed";
const changeEvent = "mf:session-changed";
export type HubSession = { user: UserContext | null; accountId: number; loading: boolean; error: string | null };

/** Broadcast invalidation only. Roles and tokens are never trusted from browser storage. */
export function notifyHubSessionChanged() {
  try {
    localStorage.removeItem("mf_user_context");
    localStorage.setItem(changeKey, crypto.randomUUID());
  } catch {}
  window.dispatchEvent(new Event(changeEvent));
}

export function watchHubSession(update: (session: HubSession) => void) {
  let sequence = 0;
  let stopped = false;
  let controller: AbortController | undefined;
  const refresh = async () => {
    const version = ++sequence;
    controller?.abort();
    controller = new AbortController();
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store", signal: controller.signal });
      const data = response.ok ? await response.json() : null;
      if (stopped || version !== sequence) return;
      update({ user: data?.user || null, accountId: data?.chatwoot_account_id || 0, loading: false,
        error: response.ok || response.status === 401 ? null : "Não foi possível validar o acesso desta conta ao Hub." });
    } catch {
      if (!stopped && version === sequence) update({ user: null, accountId: 0, loading: false, error: "Não foi possível verificar a sessão. Tente novamente." });
    }
  };
  const changed = () => {
    update({ user: null, accountId: 0, loading: true, error: null });
    void refresh();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === changeKey || event.key === "mf_user_context" || event.key === null) changed();
  };
  const visible = () => { if (document.visibilityState === "visible") void refresh(); };
  window.addEventListener("storage", storage);
  window.addEventListener(changeEvent, changed);
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", visible);
  // Cookies can be partitioned or storage disabled; verify visible sessions independently.
  const timer = window.setInterval(visible, 60000);
  void refresh();
  return () => {
    stopped = true;
    controller?.abort();
    window.clearInterval(timer);
    window.removeEventListener("storage", storage);
    window.removeEventListener(changeEvent, changed);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("pageshow", refresh);
    document.removeEventListener("visibilitychange", visible);
  };
}

export function hubLoginDestination(redirect: string | null, fallback: string) {
  return redirect?.startsWith("/") && !redirect.startsWith("//") && !redirect.includes("\\") ? redirect : fallback;
}
