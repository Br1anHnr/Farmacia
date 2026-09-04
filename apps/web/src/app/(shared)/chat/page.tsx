'use client';

import React, { useState } from 'react';
import { MessagesSquare, Send, Users, Building2, Radio, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  sender: string;
  role: string;
  content: string;
  time: string;
  isMe: boolean;
}

export default function InternalChatPage() {
  const [selectedRoom, setSelectedRoom] = useState<'geral' | 'jardins'>('geral');
  const [inputText, setInputText] = useState('');

  const [messagesGeral, setMessagesGeral] = useState<Message[]>([
    {
      id: '1',
      sender: 'Carlos Mendes (Gerente)',
      role: 'manager',
      content: 'Boas-vindas à equipe de atendimento no novo Hub da Farmácia!',
      time: '09:00',
      isMe: false,
    },
    {
      id: '2',
      sender: 'Ana Souza',
      role: 'agent',
      content: 'Bom dia Carlos! Já conectamos a linha de homologação do WhatsApp e os testes estão fluindo.',
      time: '09:12',
      isMe: true,
    },
    {
      id: '3',
      sender: 'Bruno Lima',
      role: 'agent',
      content: 'Aqui na Filial Jardins estamos a postos para receber as transferências de entregas da região.',
      time: '09:20',
      isMe: false,
    },
  ]);

  const [messagesJardins, setMessagesJardins] = useState<Message[]>([
    {
      id: '4',
      sender: 'Bruno Lima',
      role: 'agent',
      content: 'Aviso Filial Jardins: motoboy de plantão disponível até as 22h hoje.',
      time: '11:45',
      isMe: false,
    },
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: Message = {
      id: String(Date.now()),
      sender: 'Ana Souza',
      role: 'agent',
      content: inputText.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };

    if (selectedRoom === 'geral') {
      setMessagesGeral((prev) => [...prev, newMsg]);
    } else {
      setMessagesJardins((prev) => [...prev, newMsg]);
    }

    setInputText('');
  };

  const currentMessages = selectedRoom === 'geral' ? messagesGeral : messagesJardins;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Topbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/70 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <MessagesSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Comunicação Interna da Equipe</h1>
              <p className="text-[11px] text-slate-400">Salas independentes via Supabase Realtime</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>3 Atendentes Online</span>
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
              onClick={() => setSelectedRoom('geral')}
              className={`w-full p-3 rounded-xl text-left border transition-all flex items-center gap-3 ${
                selectedRoom === 'geral'
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold">Geral MultiFarma</p>
                <p className="text-[10px] text-slate-400">Toda a rede da farmácia</p>
              </div>
            </button>

            <button
              onClick={() => setSelectedRoom('jardins')}
              className={`w-full p-3 rounded-xl text-left border transition-all flex items-center gap-3 ${
                selectedRoom === 'jardins'
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold">Filial Jardins</p>
                <p className="text-[10px] text-slate-400">Equipe local da unidade</p>
              </div>
            </button>
          </div>

          <div className="mt-auto p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
            💡 <strong>Regra:</strong> Mensagens sobre um cliente específico devem ser mantidas como Notas Privadas no Chatwoot.
          </div>
        </aside>

        {/* Área de Mensagens da Sala */}
        <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {/* Header da Sala */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div>
              <h3 className="font-bold text-sm text-white">
                {selectedRoom === 'geral' ? 'Sala Geral MultiFarma' : 'Sala Filial Jardins'}
              </h3>
              <p className="text-[11px] text-slate-400">Histórico de avisos operacionais e recados</p>
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
                className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-slate-300">{msg.sender}</span>
                  <span className="text-[9px] text-slate-500">{msg.time}</span>
                </div>
                <div
                  className={`px-3.5 py-2 rounded-2xl max-w-md text-xs leading-relaxed ${
                    msg.isMe
                      ? 'bg-emerald-600 text-white rounded-tr-sm'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input de Envio */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-950/50 flex gap-2">
            <input
              type="text"
              placeholder={`Escrever mensagem em #${selectedRoom === 'geral' ? 'geral' : 'jardins'}...`}
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
