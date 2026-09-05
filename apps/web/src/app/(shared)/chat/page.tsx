"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessagesSquare,
  Send,
  Users,
  Building2,
  Radio,
  ArrowLeft,
  LogOut,
  LayoutDashboard,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AUTH_COOKIE_NAME, type UserContext } from "@/lib/auth-store";

interface Message {
  id: string;
  sender: string;
  role: string;
  content: string;
  time: string;
  isMe: boolean;
}

export default function InternalChatPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setCurrentUser(d.user);
          localStorage.setItem("mf_user_context", JSON.stringify(d.user));
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0;`;
    localStorage.removeItem("mf_user_context");
    router.push("/login");
  };

  const [selectedRoom, setSelectedRoom] = useState<"geral" | "jardins">(
    "geral",
  );
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const roomRef = useRef(selectedRoom);
  roomRef.current = selectedRoom;

  // Buscar mensagens do Supabase via API
  const fetchMessages = async (room: string) => {
    try {
      const res = await fetch(`/api/chat/messages?room=${room}`);
      if (!res.ok) throw new Error("MESSAGE_QUERY_FAILED");
      if (room === roomRef.current) {
        const data = await res.json();
        if (data.messages) {
          const currentUserId =
            currentUser?.user_id || (currentUser as any)?.id;
          const mapped = data.messages.map((m: any) => ({
            ...m,
            isMe:
              (currentUserId && m.sender_id === currentUserId) ||
              m.sender === currentUser?.full_name ||
              (currentUser?.full_name &&
                m.sender?.includes(currentUser.full_name)),
          }));
          setMessages(mapped);
        }
      }
    } catch (err) {
      if (room === roomRef.current)
        setChatError("Não foi possível carregar esta sala.");
    }
  };

  // Carrega ao trocar de sala ou usuário e mantém polling de 3 segundos
  useEffect(() => {
    setMessages([]);
    setChatError(null);
    fetchMessages(selectedRoom);
    const interval = setInterval(() => {
      fetchMessages(selectedRoom);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedRoom, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputText.trim();
    if (!content || !currentUser || isLoading) return;
    setIsLoading(true);
    setChatError(null);
    const sentRoom = selectedRoom;
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: sentRoom, content }),
      });
      if (!res.ok) throw new Error("MESSAGE_NOT_PERSISTED");
      const data = await res.json();
      if (!data.message?.id) throw new Error("MESSAGE_NOT_PERSISTED");
      if (sentRoom === roomRef.current) {
        setInputText("");
        await fetchMessages(sentRoom);
      }
    } catch {
      setChatError(
        "Mensagem não confirmada. O texto foi mantido para tentar novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const currentMessages = messages;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {chatError && (
        <p role="alert" className="text-red-300 p-3">
          {chatError}
        </p>
      )}
      {/* Topbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/70 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={
              currentUser?.role === "manager"
                ? "/dashboard"
                : "/chatwoot-widget"
            }
            title={
              currentUser?.role === "manager"
                ? "Voltar ao Dashboard"
                : "Voltar ao Painel do Atendente"
            }
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">
              {currentUser?.role === "manager"
                ? "Dashboard"
                : "Painel de Vendas"}
            </span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <MessagesSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">
                Comunicação Interna da Equipe
              </h1>
              <p className="text-[11px] text-slate-400">Mensagens da equipe</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden lg:flex items-center gap-2 text-slate-400 mr-1">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Equipe</span>
          </div>

          <Link
            href="/chatwoot-widget"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            <span>Painel do Atendente</span>
          </Link>

          {currentUser?.role === "manager" && (
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-slate-200 text-[11px] leading-none">
                {currentUser?.full_name || "Ana Clara"}
              </p>
              <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold mt-0.5">
                {currentUser?.role || "agent"}
              </p>
            </div>

            <button
              onClick={handleLogout}
              title="Sair / Trocar de Usuário"
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">
                Sair
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Layout de 2 colunas: Salas + Mensagens */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-6 gap-6 min-h-0">
        {/* Lista de Salas */}
        <aside className="w-72 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Salas Disponíveis
          </h2>

          <div className="space-y-2">
            <button
              onClick={() => setSelectedRoom("geral")}
              className={`w-full p-3 rounded-xl text-left border transition-all flex items-center gap-3 ${
                selectedRoom === "geral"
                  ? "bg-emerald-950/40 border-emerald-500/60 text-white"
                  : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold">Geral MultiFarma</p>
                <p className="text-[10px] text-slate-400">
                  Toda a rede da farmácia
                </p>
              </div>
            </button>

            <button
              onClick={() => setSelectedRoom("jardins")}
              className={`w-full p-3 rounded-xl text-left border transition-all flex items-center gap-3 ${
                selectedRoom === "jardins"
                  ? "bg-emerald-950/40 border-emerald-500/60 text-white"
                  : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold">Filial Jardins</p>
                <p className="text-[10px] text-slate-400">
                  Equipe local da unidade
                </p>
              </div>
            </button>
          </div>

          <div className="mt-auto p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
            💡 <strong>Regra:</strong> Mensagens sobre um cliente específico
            devem ser mantidas como Notas Privadas no Chatwoot.
          </div>
        </aside>

        {/* Área de Mensagens da Sala */}
        <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {/* Header da Sala */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div>
              <h3 className="font-bold text-sm text-white">
                {selectedRoom === "geral"
                  ? "Sala Geral MultiFarma"
                  : "Sala Filial Jardins"}
              </h3>
              <p className="text-[11px] text-slate-400">
                Histórico de avisos operacionais e recados
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              PostgreSQL Realtime
            </span>
          </div>

          {/* Mensagens */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {currentMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-slate-300">
                    {msg.sender}
                  </span>
                  <span className="text-[9px] text-slate-500">{msg.time}</span>
                </div>
                <div
                  className={`px-3.5 py-2 rounded-2xl max-w-md text-xs leading-relaxed ${
                    msg.isMe
                      ? "bg-emerald-600 text-white rounded-tr-sm"
                      : "bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input de Envio */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-800 bg-slate-950/50 flex gap-2"
          >
            <input
              type="text"
              placeholder={`Escrever mensagem em #${selectedRoom === "geral" ? "geral" : "jardins"}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5 shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
