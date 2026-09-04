'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-slate-100 mb-2">
          Acesso Restrito ao Gerente
        </h1>
        
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Conforme as regras de segurança do produto, o dashboard comercial, indicadores agregados e auditoria são acessíveis exclusivamente por usuários com o papel <span className="font-semibold text-emerald-400">manager</span>.
        </p>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-left text-slate-400 mb-6 space-y-1 font-mono">
          <div className="text-red-400 font-semibold">HTTP 403 Forbidden</div>
          <div>Isolamento: Row Level Security (PostgreSQL) + Edge Guard</div>
          <div>Visualização negada: Faturamento, conversão e ranking</div>
        </div>

        <div className="space-y-3">
          <Link
            href="/chatwoot-widget"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors shadow-lg shadow-emerald-600/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Ir para Painel do Atendente (Dashboard App)
          </Link>

          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors border border-slate-700"
          >
            <LogIn className="w-4 h-4" />
            Alternar Usuário / Entrar como Gerente
          </Link>
        </div>
      </div>
    </div>
  );
}
