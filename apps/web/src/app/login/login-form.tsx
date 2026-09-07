"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";

const DEMO_ACCOUNTS = [
  { name: "Carlos Mendes", role: "Gerente", email: "carlos.gerente@multifarma.com" },
  { name: "Ana Souza", role: "Atendente", email: "ana.atendente@multifarma.com" },
  { name: "Bruno Lima", role: "Atendente", email: "bruno.atendente@multifarma.com" },
];

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || "Não foi possível entrar. Confira seus dados.");
        return;
      }
      try { if (data.user) localStorage.setItem("mf_user_context", JSON.stringify(data.user)); } catch {}
      router.push(searchParams.get("redirect") || data.redirectTo || "/dashboard");
    } catch {
      setError("Não foi possível conectar ao sistema. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      <div className="border-b-4 border-red-600 px-7 pb-6 pt-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-white">
          <LockKeyhole className="h-7 w-7" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">MultiFarma Hub</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Acesse sua conta</h1>
        <p className="mt-1 text-sm text-slate-500">Entre para continuar o atendimento.</p>
      </div>

      <div className="space-y-5 p-7">
        {error && (
          <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-semibold text-slate-700">
            E-mail
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-100"
              placeholder="seu.email@multifarma.com"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Senha
            <span className="relative mt-1.5 block">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-11 font-normal outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-100"
                placeholder="Digite sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-600"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
        <p className="text-xs text-slate-500">
          Se o navegador bloquear o acesso dentro do Chatwoot, <a href={"/login?redirect=" + encodeURIComponent(searchParams.get("redirect") || "/chatwoot-widget")} target="_blank" rel="noopener noreferrer" className="font-semibold text-red-700">abra o Hub em outra aba</a>.
        </p>

        {demoMode && (
          <div className="border-t border-slate-200 pt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Acesso rápido de homologação
            </p>
            <div className="grid gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setEmail(account.email)}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:border-red-300 hover:bg-red-50"
                >
                  <span className="text-sm font-medium text-slate-800">{account.name}</span>
                  <span className="text-xs text-slate-500">{account.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
