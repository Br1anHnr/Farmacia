"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessagesSquare,
  Send,
  Users,
  Building2,
  Radio,
  Loader2,
  AlertCircle,
  Hash,
  ShieldAlert,
} from "lucide-react";
import { type UserContext } from "@/lib/auth-store";
import { HubShell } from "@/components/layout/hub-shell";

interface Message {
  id: string;
  sender: string;
  role: string;
  content: string;
  time: string;
  isMe: boolean;
}

export default function InternalChatPage() {
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

  const [selectedRoom, setSelectedRoom] = useState<"geral" | "jardins">("geral");
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const roomRef = useRef(selectedRoom);
  roomRef.current = selectedRoom;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Buscar mensagens do Supabase via API
  const fetchMessages = async (room: string) => {
    try {
      const res = await fetch(`/api/chat/messages?room=${room}`);
      if (!res.ok) throw new Error("MESSAGE_QUERY_FAILED");
      if (room === roomRef.current) {
        const data = await res.json();
        if (data.messages) {
          const currentUserId = currentUser?.user_id || (currentUser as any)?.id;
          const mapped = data.messages.map((m: any) => ({
            ...m,
            isMe:
              (currentUserId && m.sender_id === currentUserId) ||
              m.sender === currentUser?.full_name ||
              (currentUser?.full_name && m.sender?.includes(currentUser.full_name)),
          }));
          setMessages(mapped);
        }
      }
    } catch {
      if (room === roomRef.current) {
        setChatError("Não foi possível carregar o histórico de mensagens desta sala.");
      }
    }
  };

  useEffect(() => {
    setMessages([]);
    setChatError(null);
    fetchMessages(selectedRoom);
    const interval = setInterval(() => {
      fetchMessages(selectedRoom);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedRoom, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      setChatError("Mensagem não confirmada pela rede. O texto foi mantido para tentar novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <HubShell
      title="Chat Interno da Farmácia"
      subtitle="Comunicação em tempo real entre filiais e colaboradores (módulo separado do cliente)"
    >
      <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-180px)] min-h-[500px]">
        {/* Painel Esquerdo: Lista de Salas */}
        <div className="w-full lg:w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col shrink-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-red-600" />
              Salas da Farmácia
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>

          <div className="space-y-1.5 flex-1">
            <button
              type="button"
              onClick={() => setSelectedRoom("geral")}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all ${
                selectedRoom === "geral"
                  ? "bg-red-50 border border-red-200 text-red-900 font-bold shadow-2xs"
                  : "bg-slate-50 border border-transparent text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    selectedRoom === "geral"
                      ? "bg-red-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  <Hash className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-xs text-slate-900">Sala Geral</p>
                  <p className="text-[10px] text-slate-500">Toda a Rede MultiFarma</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRoom("jardins")}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all ${
                selectedRoom === "jardins"
                  ? "bg-red-50 border border-red-200 text-red-900 font-bold shadow-2xs"
                  : "bg-slate-50 border border-transparent text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    selectedRoom === "jardins"
                      ? "bg-red-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-xs text-slate-900">Filial Jardins</p>
                  <p className="text-[10px] text-slate-500">Equipe Local</p>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            <span className="font-medium text-slate-600 block mb-0.5">Segurança Interna</span>
            Mensagens privadas entre colaboradores da empresa. Clientes não possuem acesso.
          </div>
        </div>

        {/* Painel Direito: Janela de Mensagens */}
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
          {/* Header da Sala */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-700">
                {selectedRoom === "geral" ? (
                  <Hash className="h-4 w-4" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {selectedRoom === "geral" ? "Sala Geral" : "Filial Jardins"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedRoom === "geral"
                    ? "Canal geral de comunicação da equipe farmacêutica"
                    : "Comunicação restrita aos membros da unidade Jardins"}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Chat Interno
            </span>
          </div>

          {chatError && (
            <div className="m-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <p>{chatError}</p>
            </div>
          )}

          {/* Área de Rolagem de Mensagens */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                  <MessagesSquare className="h-6 w-6" />
                </div>
                <p className="font-semibold text-sm text-slate-700">Nenhuma mensagem nesta sala</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Seja o primeiro a enviar uma mensagem para a equipe neste canal.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${
                    msg.isMe ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-md rounded-2xl p-3.5 text-xs shadow-2xs ${
                      msg.isMe
                        ? "bg-red-600 text-white rounded-br-xs"
                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span
                        className={`font-bold text-[11px] ${
                          msg.isMe ? "text-red-100" : "text-slate-900"
                        }`}
                      >
                        {msg.isMe ? "Você" : msg.sender}
                      </span>
                      <span
                        className={`text-[10px] ${
                          msg.isMe ? "text-red-200" : "text-slate-400"
                        }`}
                      >
                        {msg.time}
                      </span>
                    </div>

                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    Mensagem interna
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Campo de Envio */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-slate-100 bg-white p-4 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={`Enviar mensagem interna na ${
                selectedRoom === "geral" ? "Sala Geral" : "Filial Jardins"
              }...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Enviar</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </HubShell>
  );
}
