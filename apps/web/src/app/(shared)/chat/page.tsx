"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Building2, Hash, Loader2, MessagesSquare, Send, Users } from "lucide-react";
import { type UserContext } from "@/lib/auth-store";
import { HubShell } from "@/components/layout/hub-shell";

interface Room {
  id: string;
  name: string;
  branch_id: string | null;
  branch_name: string | null;
  is_general: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  sender: string;
  content: string;
  time: string;
  isMe: boolean;
}

export default function InternalChatPage() {
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const roomRef = useRef(selectedRoomId);
  roomRef.current = selectedRoomId;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/chat/rooms").then(async (response) => {
        if (!response.ok) throw new Error("ROOMS_UNAVAILABLE");
        return response.json();
      }),
    ])
      .then(([authData, roomsData]) => {
        if (authData?.user) {
          setCurrentUser(authData.user);
          localStorage.setItem("mf_user_context", JSON.stringify(authData.user));
        }
        const availableRooms: Room[] = roomsData?.rooms || [];
        setRooms(availableRooms);
        setSelectedRoomId(availableRooms[0]?.id || "");
        if (!availableRooms.length) setChatError("Nenhuma sala foi provisionada para o seu usuário.");
      })
      .catch(() => setChatError("Não foi possível carregar as salas autorizadas."))
      .finally(() => setLoadingRooms(false));
  }, []);

  const fetchMessages = async (roomId: string) => {
    if (!roomId) return;
    try {
      const response = await fetch(`/api/chat/messages?room=${encodeURIComponent(roomId)}`);
      if (!response.ok) throw new Error("MESSAGE_QUERY_FAILED");
      const data = await response.json();
      if (roomId === roomRef.current) {
        setMessages((data.messages || []).map((message: Omit<Message, "isMe">) => ({
          ...message,
          isMe: message.sender_id === currentUser?.user_id,
        })));
        setChatError(null);
      }
    } catch {
      if (roomId === roomRef.current) {
        setChatError("Não foi possível carregar o histórico de mensagens desta sala.");
      }
    }
  };

  useEffect(() => {
    if (!selectedRoomId) return;
    setMessages([]);
    setChatError(null);
    void fetchMessages(selectedRoomId);
    const interval = window.setInterval(() => void fetchMessages(selectedRoomId), 3000);
    return () => window.clearInterval(interval);
  }, [selectedRoomId, currentUser?.user_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage(event: React.FormEvent) {
    event.preventDefault();
    const content = inputText.trim();
    if (!content || !currentUser || !selectedRoomId || isLoading) return;
    setIsLoading(true);
    setChatError(null);
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: selectedRoomId, content }),
      });
      const data = await response.json();
      if (!response.ok || !data.message?.id) throw new Error("MESSAGE_NOT_PERSISTED");
      setInputText("");
      await fetchMessages(selectedRoomId);
    } catch {
      setChatError("Mensagem não confirmada pela rede. O texto foi mantido para tentar novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <HubShell title="Chat Interno da Farmácia" subtitle="Comunicação entre filiais e colaboradores">
      <div className="flex min-h-[500px] h-[calc(100vh-180px)] flex-col gap-5 lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-72">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Users className="h-3.5 w-3.5 text-red-600" /> Salas da Farmácia
            </span>
          </div>
          <div className="flex-1 space-y-1.5">
            {loadingRooms && <div className="flex items-center gap-2 p-3 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando salas...</div>}
            {rooms.map((room) => {
              const active = room.id === selectedRoomId;
              const Icon = room.is_general ? Hash : Building2;
              return (
                <button key={room.id} type="button" onClick={() => setSelectedRoomId(room.id)} className={`flex w-full items-center gap-2.5 rounded-xl border p-3 text-left text-xs transition-all ${active ? "border-red-200 bg-red-50 text-red-900" : "border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-red-600 text-white" : "bg-slate-200 text-slate-600"}`}><Icon className="h-4 w-4" /></span>
                  <span>
                    <span className="block font-semibold text-slate-900">{room.name}</span>
                    <span className="text-[10px] text-slate-500">{room.is_general ? "Toda a Rede MultiFarma" : room.branch_name || "Equipe local"}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
            <span className="mb-0.5 block font-medium text-slate-600">Segurança Interna</span>
            Acesso limitado aos colaboradores autorizados.
          </div>
        </aside>

        <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-700">{selectedRoom?.is_general ? <Hash className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}</span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedRoom?.name || "Chat interno"}</h3>
                <p className="text-[11px] text-slate-500">{selectedRoom?.is_general ? "Canal geral de comunicação da equipe farmacêutica" : selectedRoom ? `Comunicação restrita à ${selectedRoom.branch_name || "unidade"}` : "Selecione uma sala autorizada"}</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Chat interno</span>
          </header>

          {chatError && <div className="m-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"><AlertCircle className="h-4 w-4 shrink-0 text-red-600" /> {chatError}</div>}

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/30 p-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><MessagesSquare className="h-6 w-6" /></span>
                <p className="text-sm font-semibold text-slate-700">Nenhuma mensagem nesta sala</p>
                <p className="mt-1 text-xs text-slate-500">Envie a primeira mensagem para esta equipe.</p>
              </div>
            ) : messages.map((message) => (
              <div key={message.id} className={`flex flex-col ${message.isMe ? "items-end" : "items-start"}`}>
                <div className={`max-w-md rounded-2xl p-3.5 text-xs shadow-sm ${message.isMe ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className={`text-[11px] font-bold ${message.isMe ? "text-red-100" : "text-slate-900"}`}>{message.isMe ? "Você" : message.sender}</span>
                    <span className={`text-[10px] ${message.isMe ? "text-red-200" : "text-slate-400"}`}>{message.time}</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
                <span className="mt-1 px-1 text-[10px] text-slate-400">Mensagem interna</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t border-slate-100 bg-white p-4">
            <input type="text" placeholder={selectedRoom ? `Enviar mensagem em ${selectedRoom.name}...` : "Selecione uma sala"} value={inputText} onChange={(event) => setInputText(event.target.value)} disabled={isLoading || !selectedRoom} className="flex-1 rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20" />
            <button type="submit" disabled={!inputText.trim() || isLoading || !selectedRoom} className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5" /> Enviar</>}</button>
          </form>
        </section>
      </div>
    </HubShell>
  );
}
