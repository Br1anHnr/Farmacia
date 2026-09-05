"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Search, Clock, RefreshCw, AlertCircle } from "lucide-react";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/audit", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Falha ao carregar auditoria (${res.status})`);
      }
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão com o banco de dados");
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-red-600" />
            Trilha de Auditoria Operacional
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Registro imutável de confirmações de vendas, transferências e acessos no Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Busca */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar evento, atendente ou ação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
            />
          </div>

          <button
            type="button"
            onClick={fetchAuditLogs}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Atualizar trilha de auditoria"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-red-600" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabela de Auditoria */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Horário</th>
                <th className="py-3.5 px-4">Ação</th>
                <th className="py-3.5 px-4">Responsável</th>
                <th className="py-3.5 px-4">Entidade</th>
                <th className="py-3.5 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading && auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-red-600" />
                    Carregando eventos de auditoria...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum registro de auditoria encontrado para a busca informada.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-semibold whitespace-nowrap">
                      {log.actor}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {log.entity}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-md">
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
