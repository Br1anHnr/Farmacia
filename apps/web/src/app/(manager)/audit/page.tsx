'use client';

import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, Clock, CheckCircle2, UserCheck, ArrowRightLeft } from 'lucide-react';

export default function AuditPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Dados sintéticos de homologação
  const auditLogs = [
    {
      id: 'aud_101',
      timestamp: 'Hoje às 14:32:10',
      action: 'SALE_CONFIRMED',
      actor: 'Ana Souza (Atendente)',
      entity: 'Venda #6661 (R$ 29,00)',
      details: 'Venda confirmada via Dashboard App lateral no Chatwoot (Conv #101 - WhatsApp).',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'aud_102',
      timestamp: 'Hoje às 14:28:45',
      action: 'BOT_HANDOFF_TO_HUMAN',
      actor: 'AgentBot (Sistema)',
      entity: 'Conversa #101 (WhatsApp)',
      details: 'Triagem concluída com intenção BUY_PRODUCT. Desligamento atômico do bot acionado.',
      badgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    },
    {
      id: 'aud_103',
      timestamp: 'Hoje às 13:15:02',
      action: 'CONVERSATION_TRANSFERRED',
      actor: 'Bruno Lima (Atendente)',
      entity: 'Conversa #98 (Instagram)',
      details: 'Transferência de atendimento para Filial Jardins (Carla Prado).',
      badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    {
      id: 'aud_104',
      timestamp: 'Hoje às 11:05:18',
      action: 'AUTH_LOGIN',
      actor: 'Carlos Mendes (Gerente)',
      entity: 'Sessão Web',
      details: 'Login autenticado com sucesso via Supabase Auth.',
      badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    {
      id: 'aud_105',
      timestamp: 'Hoje às 09:40:12',
      action: 'SALE_CONFIRMED',
      actor: 'Bruno Lima (Atendente)',
      entity: 'Venda #6658 (R$ 78,50)',
      details: 'Confirmação humana de pedido com entrega em domicílio.',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
  ];

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Trilha de Auditoria Operacional
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registro imutável append-only de confirmações de vendas, transferências e acessos ao sistema.
          </p>
        </div>

        {/* Busca */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar evento, ator ou ação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tabela de Auditoria */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Horário (UTC)</th>
                <th className="py-3.5 px-4">Ação</th>
                <th className="py-3.5 px-4">Responsável</th>
                <th className="py-3.5 px-4">Entidade Relacionada</th>
                <th className="py-3.5 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${log.badgeClass}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-200 font-medium whitespace-nowrap">
                    {log.actor}
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                    {log.entity}
                  </td>
                  <td className="py-3 px-4 text-slate-400 max-w-md">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
