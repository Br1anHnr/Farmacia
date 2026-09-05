"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  ShieldCheck,
  MessagesSquare,
  Users,
  Headphones,
  LogOut,
  Building2,
  Menu,
  X,
  Plus,
} from "lucide-react";
import { AUTH_COOKIE_NAME, type UserContext } from "@/lib/auth-store";

interface HubShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export function HubShell({
  children,
  title,
  subtitle,
  actionButton,
}: HubShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserContext | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // 1. Tenta carregar do localStorage imediatamente para evitar flash
    try {
      const stored = localStorage.getItem("mf_user_context");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {}

    // 2. Confirma com /api/auth/me
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setUser(d.user);
          localStorage.setItem("mf_user_context", JSON.stringify(d.user));
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0;`;
    localStorage.removeItem("mf_user_context");
    router.push("/login");
  };

  const isManager = user?.role === "manager";

  // Navegação para atendente
  const operationalItems = [
    { label: "Atendimento", href: "/chatwoot-widget", icon: Headphones },
    { label: "Contatos", href: "/contacts", icon: Users },
    { label: "Equipe", href: "/chat", icon: MessagesSquare },
  ];

  // Navegação gerencial (somente para gerente)
  const managerItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Relatórios", href: "/reports", icon: BarChart3 },
    { label: "Auditoria", href: "/audit", icon: ShieldCheck },
  ];

  const renderNavLinks = () => (
    <div className="flex flex-col gap-6">
      {/* Operacional - Todos os perfis */}
      <div>
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-red-200/80">
          Atendimento
        </p>
        <div className="space-y-1">
          {operationalItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white text-red-700 shadow-sm font-bold"
                    : "text-red-100 hover:bg-red-800/50 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-red-600" : "text-red-200"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Módulos de Gestão - Exclusivo Gerente */}
      {isManager && (
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-red-200/80">
            Gestão & Relatórios
          </p>
          <div className="space-y-1">
            {managerItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white text-red-700 shadow-sm font-bold"
                      : "text-red-100 hover:bg-red-800/50 hover:text-white"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-red-600" : "text-red-200"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 antialiased font-sans">
      {/* Sidebar Desktop Fixa Vermelha */}
      <aside className="hidden lg:flex w-64 bg-red-700 text-white flex-col shrink-0 border-r border-red-800 shadow-xl z-30">
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-red-800/80 flex items-center gap-3 bg-red-800/40">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-red-700 font-extrabold shadow-sm">
            <Plus className="w-5 h-5 stroke-[3]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white leading-none">
              MultiFarma Hub
            </h1>
            <p className="text-[11px] text-red-200 font-medium mt-1">
              Atendimento & Vendas
            </p>
          </div>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {renderNavLinks()}
        </nav>

        {/* Rodapé da Sidebar com Perfil */}
        <div className="p-3.5 border-t border-red-800/80 bg-red-800/30">
          <div className="flex items-center justify-between gap-2 bg-red-900/40 p-2.5 rounded-xl border border-red-800/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white text-red-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                {user?.full_name?.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.full_name || "Carregando..."}
                </p>
                <p className="text-[10px] text-red-200 font-medium truncate">
                  {isManager ? "Gerente Geral" : "Atendente"}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sair do sistema"
              className="p-1.5 rounded-lg text-red-200 hover:text-white hover:bg-red-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2.5 px-2 flex items-center gap-1.5 text-[11px] text-red-200/90">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Unidade Matriz Centro</span>
          </div>
        </div>
      </aside>

      {/* Drawer Mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 bg-red-700 text-white flex flex-col z-10 shadow-2xl">
            <div className="h-16 px-5 border-b border-red-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-red-700 font-black">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <span className="font-bold text-sm">MultiFarma Hub</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 text-red-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 overflow-y-auto">{renderNavLinks()}</nav>
            <div className="p-4 border-t border-red-800 bg-red-800/40 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold">{user?.full_name}</p>
                <p className="text-[10px] text-red-200">{isManager ? "Gerente" : "Atendente"}</p>
              </div>
              <button onClick={handleLogout} className="p-1 text-red-200 hover:text-white">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Topbar Clara */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                {title || "Central Integrada"}
              </h2>
              {subtitle && (
                <p className="text-[11px] text-slate-500 font-medium">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Conexão Operacional Ativa</span>
            </div>
            {actionButton && <div>{actionButton}</div>}
          </div>
        </header>

        {/* Conteúdo da Página */}
        <main className="flex-1 p-6 overflow-y-auto bg-slate-50">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
