'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, Clock, RefreshCw, AlertCircle } from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  entity: string;
  details: string;
  badgeClass: string;
}

export default function AuditPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/audit', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Falha ao carregar auditoria (${res.status})`);
      }
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      }
    } catch (err: any) {
      console.error('Erro ao consultar trilha de auditoria:', err);
      setError(err.message || 'Erro de conexão com o banco de dados');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchTerm.toLowerCase())
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
            Registro imutável append-only de confirmações de vendas, transferências e acessos no Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

          <button
            onClick={fetchAuditLogs}
            disabled={isLoading}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold px-3"
            title="Atualizar trilha de auditoria"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabela de Auditoria */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Horário</th>
                <th className="py-3.5 px-4">Ação</th>
                <th className="py-3.5 px-4">Responsável</th>
                <th className="py-3.5 px-4">Entidade Relacionada</th>
                <th className="py-3.5 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading && auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Carregando eventos do Supabase...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    Nenhum registro de auditoria encontrado para a busca.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
