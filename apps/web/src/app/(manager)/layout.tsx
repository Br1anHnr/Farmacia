'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/navigation';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShieldCheck,
  MessagesSquare,
  ExternalLink,
  LogOut,
  Stethoscope,
  Building2,
  Radio,
} from 'lucide-react';
import { AUTH_COOKIE_NAME, type UserContext } from '@/lib/auth-store';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserContext | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('mf_user_context');
    if (raw) {
      try {
        setUser(JSON.parse(raw) as UserContext);
        return;
      } catch {
        // ignore
      }
    }
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setUser(d.user);
          localStorage.setItem('mf_user_context', JSON.stringify(d.user));
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0;`;
    localStorage.removeItem('mf_user_context');
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard Executivo', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Auditoria Operacional', href: '/audit', icon: ShieldCheck },
    { label: 'Chat da Equipe', href: '/chat', icon: MessagesSquare },
    { label: 'Painel do Atendente (Widget)', href: '/chatwoot-widget', icon: ExternalLink },
  ];

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 antialiased">
      {/* Sidebar Lateral */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">MultiFarma Hub</h2>
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gestão Omnichannel
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Módulos Gerenciais
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Status de Homologação */}
        <div className="p-4 mx-3 mb-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5 font-medium">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              WhatsApp Homolog
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
              ONLINE
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Evolution API conectada à caixa Chatwoot #1.
          </p>
        </div>

        {/* Perfil & Logout */}
        <div className="p-3 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
              {user?.full_name?.charAt(0) || 'G'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.full_name || 'Carlos Mendes'}
              </p>
              <p className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">
                {user?.role || 'manager'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sair / Trocar de usuário"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-300">
              Unidade: <span className="text-white">MultiFarma Matriz Centro & Filial Jardins</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Ambiente de Homologação
            </span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
