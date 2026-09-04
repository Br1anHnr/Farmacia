'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  UserCheck,
  Stethoscope,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Sparkles,
  KeyRound,
} from 'lucide-react';

const QUICK_ACCOUNTS = [
  {
    key: 'gerente',
    name: 'Carlos Mendes',
    role: 'manager',
    roleLabel: 'Gerente Geral',
    email: 'carlos.gerente@multifarma.com',
    password: 'MultiFarma@2026',
    desc: 'Acesso completo ao Dashboard, KPIs e Auditoria',
  },
  {
    key: 'ana',
    name: 'Ana Souza',
    role: 'agent',
    roleLabel: 'Atendente',
    email: 'ana.atendente@multifarma.com',
    password: 'MultiFarma@2026',
    desc: 'Atendimento Chatwoot, vendas e sugestões por IA',
  },
  {
    key: 'bruno',
    name: 'Bruno Lima',
    role: 'agent',
    roleLabel: 'Atendente (Jardins)',
    email: 'bruno.atendente@multifarma.com',
    password: 'MultiFarma@2026',
    desc: 'Atendimento na unidade filial Jardins',
  },
  {
    key: 'admin',
    name: 'Marcos Tech',
    role: 'admin',
    roleLabel: 'Admin Técnico',
    email: 'marcos.admin@multifarma.com',
    password: 'MultiFarma@2026',
    desc: 'Administração técnica do sistema e configurações',
  },
];

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  const [email, setEmail] = useState('carlos.gerente@multifarma.com');
  const [password, setPassword] = useState('MultiFarma@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executeLogin = async (loginEmail: string, loginPass: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Falha ao autenticar. Verifique e-mail e senha.');
        setIsLoading(false);
        return;
      }

      // Salva contexto no localStorage para a interface do cliente
      if (data.user) {
        localStorage.setItem('mf_user_context', JSON.stringify(data.user));
      }

      // Redireciona para o destino solicitado ou conforme o papel
      const destination = redirectTarget || data.redirectTo || '/dashboard';
      router.push(destination);
    } catch (err) {
      console.error('[Login] Erro na requisição:', err);
      setErrorMessage('Erro de conexão com o servidor. Tente novamente.');
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Por favor, informe o e-mail e a senha.');
      return;
    }
    executeLogin(email, password);
  };

  const handleQuickLogin = (acc: typeof QUICK_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    executeLogin(acc.email, acc.password);
  };

  return (
    <div className="max-w-md w-full relative z-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4 shadow-sm shadow-emerald-900/30">
          <Stethoscope className="w-3.5 h-3.5" />
          MultiFarma Omnichannel Hub
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Acesso Seguro ao Sistema
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Autenticação real via Supabase Auth com isolamento por papéis (RBAC).
        </p>
      </div>

      {/* Card Principal de Login */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              E-mail Profissional
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              placeholder="seu.email@multifarma.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Senha de Acesso
              </label>
              <span className="text-[11px] text-slate-500">Padrão: MultiFarma@2026</span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors pr-10 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-600/30 active:scale-[0.99] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando no Supabase...</span>
              </>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divisor */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <span className="relative px-3 bg-slate-900 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            Acesso Rápido de Homologação
          </span>
        </div>

        {/* Botões de Acesso Rápido */}
        <div className="space-y-2">
          {QUICK_ACCOUNTS.map((acc) => {
            const isManager = acc.role === 'manager';
            const isSelected = email.toLowerCase() === acc.email.toLowerCase();

            return (
              <button
                key={acc.key}
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickLogin(acc)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 disabled:opacity-50 ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/70 shadow-sm ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
              >
                <div
                  className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                    isManager
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {isManager ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {acc.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isManager
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {acc.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{acc.email}</p>
                </div>

                <div className="self-center text-slate-500 hover:text-emerald-400">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          Sessão com token JWT assinado e RLS no Supabase PostgreSQL
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 px-4 py-12 relative overflow-hidden text-slate-100">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            Carregando sistema de autenticação...
          </div>
        }
      >
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
