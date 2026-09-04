'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO_PERSONAS, AUTH_COOKIE_NAME } from '@/lib/auth-store';
import { ShieldCheck, UserCheck, Stethoscope, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string>('gerente');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const persona = DEMO_PERSONAS[selectedKey];
    if (!persona) return;

    // Grava cookie para o middleware e backend
    document.cookie = `${AUTH_COOKIE_NAME}=${persona.role}; path=/; max-age=86400; SameSite=Lax`;
    localStorage.setItem('mf_user_context', JSON.stringify(persona));

    if (persona.role === 'manager') {
      router.push('/dashboard');
    } else {
      router.push('/chatwoot-widget');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 px-4 py-12 relative overflow-hidden text-slate-100">
      {/* Background glowing effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Stethoscope className="w-3.5 h-3.5" />
            MultiFarma Omnichannel Hub
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Acesso ao Sistema
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Selecione um perfil de homologação para experimentar o fluxo operacional ou executivo.
          </p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="space-y-3 mb-6">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Selecione o Usuário de Demonstração
            </label>

            {Object.entries(DEMO_PERSONAS).map(([key, persona]) => {
              const isSelected = selectedKey === key;
              const isManager = persona.role === 'manager';

              return (
                <div
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className={`mt-0.5 p-2 rounded-lg ${isManager ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                    {isManager ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-200 truncate">
                        {persona.full_name}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isManager
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {persona.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{persona.email}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {isManager ? 'Acesso ao Dashboard, KPIs e Auditoria' : 'Acesso à Dashboard App (Chatwoot) e Vendas'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-600/30 active:scale-[0.99]"
          >
            <span>Entrar no Hub</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="mt-4 pt-4 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            Sessão segura com isolamento RLS e Supabase Auth
          </div>
        </form>
      </div>
    </div>
  );
}
