"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, ArrowRightLeft, AlertCircle, CheckCircle, Loader2, X } from "lucide-react";

interface AgentOption {
  id: string;
  name: string;
  role: string;
  branch_id: string;
  branch_name: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  accountId: number;
  currentAgentName: string;
  currentBranchName: string;
  currentBranchId: string;
  onSuccess: (info: { agentId: string; agentName: string; branchId: string; branchName: string; labels: string[] }) => void;
}

function transferErrorMessage(code: string) {
  const messages: Record<string, string> = {
    INDIVIDUAL_AGENT_MODE_REQUIRED: "O Hub exige agentes individuais do Chatwoot. Desative a configuração de operador compartilhado no Supabase antes de transferir.",
    SHARED_OPERATOR_NOT_ENABLED: "O usuário MultiFarma precisa estar habilitado nesta caixa de entrada.",
    OPERATION_CONFIGURATION_UNAVAILABLE: "Não foi possível carregar a configuração do atendimento. Tente novamente.",
    TARGET_NOT_AUTHORIZED: "O funcionário não está autorizado para esta filial.",
    TARGET_NOT_ENABLED_IN_INBOX: "O funcionário não está habilitado na inbox desta conversa.",
    TRANSFER_DATA_UNAVAILABLE: "Os vínculos do funcionário não puderam ser verificados.",
    TRANSFER_PERSISTENCE_FAILED: "A transferência não foi salva. O responsável anterior foi restaurado.",
    TRANSFER_RECONCILIATION_REQUIRED: "Chatwoot e Hub precisam ser reconciliados antes de tentar novamente.",
    CHATWOOT_REQUEST_FAILED: "O Chatwoot não confirmou a transferência.",
    CHATWOOT_UNAVAILABLE: "O Chatwoot está temporariamente indisponível.",
  };
  return messages[code] || code || "Falha ao realizar transferência.";
}

export function TransferModal({
  isOpen,
  onClose,
  conversationId,
  accountId,
  currentAgentName,
  currentBranchName,
  currentBranchId,
  onSuccess,
}: TransferModalProps) {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [configurationWarnings, setConfigurationWarnings] = useState<string[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState(currentBranchId);
  const [note, setNote] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingAgents, setFetchingAgents] = useState(false);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsConfirming(false);
      setError(null);
      setSuccess(false);
      setNote("");
      setSelectedAgentId("");
      setUnmappedCount(0);
      return;
    }

    async function loadAgents() {
      setFetchingAgents(true);
      setAgents([]);
      setSelectedAgentId("");
      setConfigurationWarnings([]);
      setError(null);
      try {
        const res = await fetch(
          `/api/agents?conversation_id=${conversationId}&account_id=${accountId}`,
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(transferErrorMessage(data.error));
        }
        const loaded = data.agents || [];
        setConfigurationWarnings((data.configuration_required || []).map((item: { message: string }) => item.message));
        setAgents(loaded);
        setUnmappedCount(Array.isArray(data.unmapped) ? data.unmapped.length : 0);
        if (
          loaded[0]?.branch_id &&
          !loaded.some((agent: AgentOption) => agent.branch_id === selectedBranchId)
        ) {
          setSelectedBranchId(loaded[0].branch_id);
        }
      } catch (err: any) {
        setError(err.message || "Erro de conexão ao buscar atendentes.");
      } finally {
        setFetchingAgents(false);
      }
    }

    loadAgents();
  }, [accountId, conversationId, isOpen]);

  if (!isOpen) return null;

  const eligibleAgents = agents.filter((agent) => agent.branch_id === selectedBranchId);
  const selectedAgent = eligibleAgents.find((a) => a.id === selectedAgentId);

  // Extrair lista unica de filiais dos agentes
  const branchOptions = Array.from(
    new Map(agents.map((a) => [a.branch_id, { id: a.branch_id, name: a.branch_name }])).values()
  );

  async function handleTransfer() {
    if (!selectedAgentId) {
      setError("Por favor, selecione o funcionário de destino.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/transfer?account_id=${accountId}`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: selectedAgentId,
          target_branch_id: selectedBranchId || selectedAgent?.branch_id,
          note: note.trim() || undefined,
        }),
        },
      );

      const data = await res.json();

      if (!res.ok || data.success !== true) {
        throw new Error(data.message || transferErrorMessage(data.error));
      }

      setSuccess(true);
      onSuccess({
          agentId: data.transferred_to,
          agentName: data.agent_name,
          branchId: data.branch_id,
          branchName: data.branch_name,
          labels: data.labels || [],
      });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao transferir o atendimento.");
      setIsConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Transferir Atendimento</h3>
              <p className="text-xs text-slate-500">Conversa #{conversationId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {configurationWarnings.map((message) => <p key={message} className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{message}</p>)}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-medium">Falha na transferência</p>
                <p className="text-xs text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <p className="font-medium">Atendimento transferido com sucesso!</p>
            </div>
          )}

          {/* Atendente Atual */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Atendente Atual
            </span>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-slate-500" />
                {currentAgentName || "Não atribuído"}
              </span>
              <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs text-slate-700">
                {currentBranchName || "Unidade"}
              </span>
            </div>
          </div>

          {!isConfirming ? (
            <>
              {/* Seleção do Funcionário */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Funcionário de Destino <span className="text-red-500">*</span>
                </label>
                {fetchingAgents ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                    Carregando atendentes...
                  </div>
                ) : (
                  <>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => {
                      setSelectedAgentId(e.target.value);
                      const a = agents.find((ag) => ag.id === e.target.value);
                      if (a?.branch_id) setSelectedBranchId(a.branch_id);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  >
                    <option value="">Selecione o atendente ou gerente</option>
                    {eligibleAgents.map((agent) => (
                      <option key={`${agent.id}:${agent.branch_id}`} value={agent.id}>
                        {agent.name} — {agent.role} ({agent.branch_name})
                      </option>
                    ))}
                  </select>
                  {eligibleAgents.length === 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      Nenhum funcionário habilitado nesta inbox e filial.
                    </p>
                  )}
                  {unmappedCount > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {unmappedCount} agente(s) do Chatwoot ainda precisam de cadastro correspondente no Hub.
                    </p>
                  )}
                  </>
                )}
              </div>

              {/* Seleção de Filial */}
              {branchOptions.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Filial / Unidade de Atendimento
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value);
                      setSelectedAgentId("");
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  >
                    {branchOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nota Interna Opcional */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Motivo ou Nota Interna (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex: Cliente solicita orçamento para manipulação / transferido para especialista..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>
            </>
          ) : (
            /* Tela de Confirmação */
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
              <p className="font-semibold text-amber-950">Confirmar transferência?</p>
              <p className="mt-1 text-xs text-amber-800">
                A conversa será reatribuída no sistema e no atendimento ao colaborador:
              </p>
              <div className="mt-2 rounded-lg bg-white p-3 shadow-xs border border-amber-200/70 text-slate-800">
                <p className="font-medium text-sm">{selectedAgent?.name}</p>
                <p className="text-xs text-slate-500">{selectedAgent?.role} • {selectedAgent?.branch_name}</p>
                {note && <p className="mt-1.5 text-xs text-slate-600 italic">"{note}"</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <button
            type="button"
            onClick={() => {
              if (isConfirming) setIsConfirming(false);
              else onClose();
            }}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
          >
            {isConfirming ? "Voltar" : "Cancelar"}
          </button>

          {!isConfirming ? (
            <button
              type="button"
              disabled={!selectedAgentId || fetchingAgents || loading}
              onClick={() => setIsConfirming(true)}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Avançar
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleTransfer}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transferindo...
                </>
              ) : (
                "Confirmar Transferência"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
