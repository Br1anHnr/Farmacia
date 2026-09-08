"use client";
import { useHubSession } from "@/lib/use-hub-session";

export default function AccessDeniedPage() {
  const { user, loading, error } = useHubSession();
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold">{loading ? "Verificando sua conta" : user?.role === "manager" ? "Sessão de gerente confirmada" : "Acesso gerencial"}</h1>
      {error ? <p role="alert">{error}</p> : loading ? <p>Aguarde a confirmação da sessão do Hub.</p> : <>
        <p>{user ? `Conta atual do Hub: ${user.full_name} (${user.email}).` : "Você não está conectado ao Hub."}</p>
        <p>{user?.role === "manager" ? "Reabra o dashboard para carregar a página com sua sessão atual." : "Esta área exige uma conta de gerente no Hub. O usuário do Chatwoot não determina esse acesso."}</p>
        {user?.role === "manager" && <a href="/dashboard" className="block rounded-xl bg-red-600 p-3 text-center font-semibold text-white">Abrir dashboard</a>}
        <a href="/login?redirect=%2Fdashboard" className="block text-red-700">{user ? "Trocar conta do Hub" : "Entrar no Hub"}</a>
        <a href="/chatwoot-widget" className="block text-slate-600">Voltar ao atendimento</a>
        <p className="text-xs text-slate-500">As abas do Hub podem compartilhar a sessão neste perfil do navegador. Para usar duas contas simultaneamente, utilize perfis separados.</p>
      </>}
    </section>
  </main>;
}
