"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Sparkles,
  Phone,
  User,
  AlertCircle,
  Building2,
  RefreshCw,
  LogOut,
  MessagesSquare,
  LayoutDashboard,
  UserCheck,
  ArrowRightLeft,
  CheckCircle2,
  Tag,
  Clock,
  Send,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  X,
} from "lucide-react";
import { AUTH_COOKIE_NAME, type UserContext } from "@/lib/auth-store";
import { HubShell } from "@/components/layout/hub-shell";
import { TransferModal } from "@/components/attendance/transfer-modal";
import { ClosureModal } from "@/components/attendance/closure-modal";

export default function ChatwootWidgetPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  // Modais
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isClosureOpen, setIsClosureOpen] = useState(false);
  const [contextReady, setContextReady] = useState(false);

  // Contexto da conversa
  const [conversationId, setConversationId] = useState<number>(0);
  const [accountId, setAccountId] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [channel, setChannel] = useState<string>("whatsapp");
  const [branchName, setBranchName] = useState<string>("Unidade");
  const [branchId, setBranchId] = useState<string>("");
  const [labels, setLabels] = useState<string[]>([]);

  // Estado de atribuicao
  const [claimState, setClaimState] = useState<{
    isClaimed: boolean;
    claimedBy: string;
    claimedUserId?: string;
    branch: string;
  }>({
    isClaimed: false,
    claimedBy: "",
    branch: "",
  });
  const [isClaiming, setIsClaiming] = useState(false);

  // Sugestao de IA
  const [aiSuggestion, setAiSuggestion] = useState<{
    product: string;
    qty: number;
    price: number;
    fulfillment: "delivery" | "pickup";
    address?: string;
    confidence: number;
  } | null>(null);
  const [prefilledItems, setPrefilledItems] = useState<any[]>([]);

  // Notas internas
  interface NoteItem {
    id: string;
    content: string;
    sender: string;
    created_at?: string;
  }
  const [internalNote, setInternalNote] = useState("");
  const [notesList, setNotesList] = useState<NoteItem[]>([]);
  const [sendingNote, setSendingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Status de encerramento
  const [closureCompleted, setClosureCompleted] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function formatErrorMessage(codeOrMsg: string) {
    if (!codeOrMsg) return "";
    const map: Record<string, string> = {
      CONVERSATION_NOT_FOUND:
        "Conversa não vinculada ao sistema da farmácia.",
      UNAUTHENTICATED: "Sua sessão expirou ou não está disponível neste painel. Entre novamente ou abra o painel em outra aba.",
      CHATWOOT_CONVERSATION_NOT_FOUND: "A conversa não foi encontrada no Chatwoot.",
      CONVERSATION_ACCESS_DENIED: "Esta conversa pertence a outro colaborador. Peça ao gerente para transferi-la para você pelo Hub.",
      CHATWOOT_REQUEST_FAILED: "O Chatwoot não confirmou a operação.",
      CHATWOOT_UNAVAILABLE: "O Chatwoot está temporariamente indisponível.",
      INBOX_CONFIGURATION_REQUIRED: "A inbox desta conversa ainda não está vinculada a uma filial.",
      ACCESS_DENIED: "Acesso negado para este atendimento.",
      ALREADY_ASSIGNED: "Esta conversa já foi assumida por outro atendente.",
      CHATWOOT_CONFIGURATION_REQUIRED:
        "Configuração de sincronização com o Chatwoot pendente no servidor.",
      CHATWOOT_SYNC_PENDING:
        "Atendimento assumido localmente, mas a sincronização com o Chatwoot está pendente.",
      CHATWOOT_MAPPING_REQUIRED:
        "Seu usuário ainda não possui mapeamento correspondente no Chatwoot.",
      AGENT_NOT_ENABLED_IN_INBOX:
        "Seu usuário não está habilitado na inbox desta conversa.",
      CLAIM_NOT_PERSISTED:
        "O atendimento não foi salvo no Hub. A atribuição no Chatwoot foi desfeita.",
      CLAIM_RECONCILIATION_REQUIRED:
        "Não foi possível manter Chatwoot e Hub sincronizados. Solicite revisão do atendimento.",
      TRANSFER_PERSISTENCE_FAILED:
        "A transferência não foi salva no Hub. O responsável anterior foi restaurado.",
      TRANSFER_RECONCILIATION_REQUIRED:
        "A transferência ficou pendente de reconciliação entre Chatwoot e Hub.",
      DATA_UNAVAILABLE: "Serviço temporariamente indisponível. Tente novamente em instantes.",
      CLOSURE_ACCESS_DENIED:
        "Você não possui permissão para encerrar este atendimento nesta unidade.",
    };
    return map[codeOrMsg] || codeOrMsg;
  }

  useEffect(() => {
    setIsEmbedded(window.self !== window.top);

    setAuthLoading(true);
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setCurrentUser(d.user);
          if (d.chatwoot_account_id) setAccountId((previous) => previous || d.chatwoot_account_id);
          if (d.user.primary_branch_id) {
            setBranchId(d.user.primary_branch_id);
          } else if (d.user.branch_ids?.[0]) {
            setBranchId(d.user.branch_ids[0]);
          }
        } else { setCurrentUser(null); setContextReady(false); }
      })
      .catch(() => { setCurrentUser(null); setErrorMsg("Não foi possível verificar sua sessão. Tente novamente."); })
      .finally(() => setAuthLoading(false));
  }, [reloadKey]);

  const loginUrl = () => "/login?redirect=" + encodeURIComponent(window.location.pathname + window.location.search);
  const handleLogout = async () => {
    setSigningOut(true);
    setContextReady(false);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível confirmar a saída. Tente novamente.");
      setCurrentUser(null);
      try { localStorage.removeItem("mf_user_context"); } catch {}
      router.push(loginUrl());
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Falha ao sair.");
    } finally { setSigningOut(false); }
  };

  // Handshake com Chatwoot via URL e postMessage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const qConv = params.get("conversation_id") || params.get("id");
    const qAccount = params.get("account_id");
    const qName = params.get("contact_name") || params.get("name");
    const qPhone = params.get("contact_phone") || params.get("phone");
    const qChannel = params.get("channel");
    if (qConv) setConversationId(parseInt(qConv, 10));
    if (qAccount) setAccountId(parseInt(qAccount, 10));
    if (qName) setCustomerName(qName);
    if (qPhone) setCustomerPhone(qPhone);
    if (qChannel) setChannel(qChannel.toLowerCase());

    const requestContext = () => {
      if (
        window.parent &&
        window.parent !== window &&
        process.env.NEXT_PUBLIC_CHATWOOT_ORIGIN
      ) {
        window.parent.postMessage(
          "chatwoot-dashboard-app:fetch-info",
          process.env.NEXT_PUBLIC_CHATWOOT_ORIGIN
        );
      }
    };

    requestContext();
    const t1 = setTimeout(requestContext, 800);
    const t2 = setTimeout(requestContext, 2000);

    const handleChatwootMessage = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        !process.env.NEXT_PUBLIC_CHATWOOT_ORIGIN ||
        event.origin !== process.env.NEXT_PUBLIC_CHATWOOT_ORIGIN
      )
        return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.event === "chatwoot:ready" || data?.event === "appContext") {
          const conv = data.data?.conversation;
          const account = data.data?.account;
          const contact = data.data?.contact;
          const inbox = data.data?.inbox || conv?.inbox;
          if (conv?.id) setConversationId(conv.id);
          if (conv?.account_id || account?.id) setAccountId(conv?.account_id || account.id);
          if (contact?.name) setCustomerName(contact.name);
          if (contact?.phone_number) setCustomerPhone(contact.phone_number);

          const chStr = (
            inbox?.channel_type ||
            conv?.channel ||
            inbox?.name ||
            ""
          ).toLowerCase();
          if (inbox?.id === 2 || chStr.includes("instagram")) {
            setChannel("instagram");
          } else if (
            inbox?.id === 3 ||
            chStr.includes("facebook") ||
            chStr.includes("messenger")
          ) {
            setChannel("facebook");
          } else if (chStr.includes("whats") || inbox?.id === 1) {
            setChannel("whatsapp");
          }
        }
      } catch {}
    };

    window.addEventListener("message", handleChatwootMessage);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("message", handleChatwootMessage);
    };
  }, []);

  // Busca sugestões e status de atendimento
  useEffect(() => {
    setContextReady(false);
    if (!conversationId || !accountId || !currentUser || authLoading) return;
    setErrorMsg(null);
    let active = true;
    const scopedUrl = (suffix: string) =>
      `/api/conversations/${conversationId}/${suffix}?account_id=${accountId}`;
    (async () => {
      try {
        const sync = await fetch(scopedUrl("sync-context"), { method: "POST" });
        const syncData = await sync.json();
        if (!sync.ok) throw new Error(syncData.error || "CONVERSATION_NOT_FOUND");
        if (!active) return;
        setLabels(syncData.labels || []);
        setCustomerName(syncData.contact?.name || "");
        setCustomerPhone(syncData.contact?.phone || "");
        const [suggestionsRes, claimRes, notesRes] = await Promise.all([
          fetch(scopedUrl("suggestions")),
          fetch(scopedUrl("claim")),
          fetch(scopedUrl("notes")),
        ]);
        if (!active) return;
        if (suggestionsRes.ok) {
          const data = await suggestionsRes.json();
          if (data?.suggestions?.length > 0) {
            const latest = data.suggestions[data.suggestions.length - 1];
            setAiSuggestion({
              product: latest.suggested_product_name || "Medicamento",
              qty: latest.suggested_quantity || 1,
              price: latest.suggested_unit_price || 0,
              fulfillment: latest.suggested_fulfillment || "delivery",
              address: latest.suggested_address,
              confidence: latest.confidence || 0.9,
            });
          }
        }
        if (claimRes.ok) {
          const data = await claimRes.json();
          if (data.branch_id) setBranchId(data.branch_id);
          if (data.branch) setBranchName(data.branch);
          setClaimState({
            isClaimed: Boolean(data.is_claimed),
            claimedBy: data.claimed_by || "",
            claimedUserId: data.claimed_user_id,
            branch: data.branch || branchName,
          });
          setContextReady(true);
        } else {
          const failure = await claimRes.json();
          throw new Error(failure.error || "Não foi possível carregar o atendimento. Tente novamente.");
        }
        if (notesRes.ok) {
          const data = await notesRes.json();
          setNotesList(data.notes || []);
        }
      } catch (error) {
        if (active) setErrorMsg(error instanceof Error ? error.message : "DATA_UNAVAILABLE");
      }
    })();

    return () => {
      active = false;
    };
  }, [accountId, conversationId, currentUser, authLoading, reloadKey]);

  const handleClaim = async () => {
    if (!conversationId || !accountId) return;
    setIsClaiming(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/claim?account_id=${accountId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: currentUser?.full_name?.split(" (")[0] || "Atendente",
          branch_name: branchName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLabels(data.labels || []);
        setClaimState({
          isClaimed: true,
          claimedBy: data.claimed_by || currentUser?.full_name || "Você",
          claimedUserId: data.claimed_user_id || currentUser?.user_id,
          branch: data.branch || branchName,
        });
      } else {
        const err = await res.json();
        setErrorMsg(err.message || err.error || "Não foi possível assumir este atendimento.");
      }
    } catch (err: any) {
      setErrorMsg("Erro de conexão ao assumir atendimento.");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleApplyAiSuggestion = () => {
    if (!aiSuggestion) return;
    setPrefilledItems([
      {
        product_id: null,
        product_name: aiSuggestion.product,
        unit_price: aiSuggestion.price,
        quantity: aiSuggestion.qty,
      },
    ]);
    setIsClosureOpen(true);
  };

  const handleSendInternalNote = async () => {
    if (!internalNote.trim() || !conversationId || !accountId) return;
    setSendingNote(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/notes?account_id=${accountId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: internalNote.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotesList((prev) => [
          data.note || {
            id: String(Date.now()),
            content: internalNote.trim(),
            sender: currentUser?.full_name?.split(" ")[0] || "Você",
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setInternalNote("");
        setNoteSuccess(true);
        setTimeout(() => setNoteSuccess(false), 2500);
      } else {
        const err = await res.json();
        setErrorMsg(err.message || err.error || "Não foi possível registrar a anotação.");
      }
    } catch {
      setErrorMsg("Erro de conexão ao salvar nota interna.");
    } finally {
      setSendingNote(false);
    }
  };

  // Render do painel compacto de atendimento
  const content = (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <div>
          <p className="font-semibold">{authLoading ? "Verificando sessão do Hub..." : currentUser ? currentUser.full_name : "Você não está conectado ao Hub neste painel"}</p>
          {currentUser && <p className="text-slate-500">{currentUser.email} · {currentUser.role === "manager" ? "Gerente" : currentUser.role === "agent" ? "Atendente" : currentUser.role}</p>}
          <p className="text-slate-500">Hub: sessão individual · Conta Chatwoot #{accountId || "não identificada"}. A transferência atribui o agente selecionado no Chatwoot.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {currentUser ? <button onClick={handleLogout} disabled={signingOut} className="text-red-700 font-semibold">{signingOut ? "Saindo..." : "Sair / trocar colaborador"}</button> : <button onClick={() => router.push(loginUrl())} className="text-red-700 font-semibold">Entrar no Hub</button>}
          <button onClick={() => setReloadKey((key) => key + 1)} className="text-red-700">Tentar novamente</button>
          <a href={`/chatwoot-widget?conversation_id=${conversationId}&account_id=${accountId}`} target="_blank" rel="noopener noreferrer" className="text-red-700">Abrir em outra aba</a>
        </div>
      </div>
      {!contextReady && currentUser && <p role="status" className="text-xs text-slate-600">{!conversationId ? "Selecione uma conversa no Chatwoot." : !accountId ? "Identificação da conta Chatwoot indisponível. Verifique a configuração da integração." : errorMsg ? "Ações indisponíveis até recarregar o atendimento com sucesso." : "Carregando atendimento..."}</p>}
      {/* Alerta de erro formatado e amigável */}
      {errorMsg && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <p>{formatErrorMessage(errorMsg)}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:text-red-700 p-0.5"
            aria-label="Fechar alerta"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Alerta de encerramento concluido */}
      {closureCompleted && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold">Atendimento Finalizado</p>
            <p className="text-xs text-emerald-700 mt-0.5">{closureCompleted}</p>
          </div>
        </div>
      )}

      {/* Top Action Bar (Ações Rápidas em destaque) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status e Contexto */}
          <div className="flex items-center gap-2.5">
            <span
              className={`h-3 w-3 rounded-full ${
                claimState.isClaimed ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-amber-400 ring-4 ring-amber-100 animate-pulse"
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  {claimState.isClaimed ? `Em Atendimento` : `Aguardando Atendente`}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                  #{conversationId > 0 ? conversationId : "Sem conversa ativa"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {claimState.isClaimed
                  ? `Responsável: ${claimState.claimedBy}`
                  : "Nenhum atendente assumiu esta conversa"}
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2">
            {!claimState.isClaimed && (
              <button
                type="button"
                onClick={handleClaim}
                disabled={isClaiming || conversationId === 0 || !contextReady}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <UserCheck className="h-4 w-4" />
                {isClaiming ? "Assumindo..." : "Assumir Atendimento"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsTransferOpen(true)}
              disabled={conversationId === 0 || !contextReady}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-colors"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500" />
              Transferir
            </button>

            <button
              type="button"
              onClick={() => {
                setPrefilledItems([]);
                setIsClosureOpen(true);
              }}
              disabled={conversationId === 0 || !contextReady}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Encerrar Atendimento
            </button>
          </div>
        </div>
      </div>

      {/* Grid Principal Compacto */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Painel do Contato (Esquerda) */}
        <div className="md:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-700 font-bold">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Dados do Cliente</h3>
                  <p className="text-[11px] text-slate-500">Identificação no Chatwoot</p>
                </div>
              </div>

              {/* Canal de Origem */}
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 ${
                  channel === "instagram"
                    ? "bg-pink-50 text-pink-700 border border-pink-200"
                    : channel === "facebook"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                <span>●</span>
                {channel === "instagram"
                  ? "Instagram"
                  : channel === "facebook"
                  ? "Facebook"
                  : "WhatsApp"}
              </span>
            </div>

            {/* Informações detalhadas */}
            {conversationId > 0 ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Nome
                    </span>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5 truncate">
                      {customerName || "Dados do contato indisponíveis"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Telefone
                    </span>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-slate-400" />
                      {customerPhone || "Não informado"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Unidade de Atendimento
                    </span>
                    <p className="font-medium text-slate-700 mt-0.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-red-600" />
                      {claimState.branch || branchName}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Atendente Atual
                    </span>
                    <p className="font-medium text-slate-700 mt-0.5">
                      {claimState.claimedBy || "Não atribuído"}
                    </p>
                  </div>
                </div>

                {/* Etiquetas */}
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Etiquetas da Conversa
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map((label) => <span key={label} className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-700"><Tag className="h-3 w-3" />{label}</span>)}
                    {!labels.length && <span className="text-slate-500">Sem etiquetas</span>}
                  </div>
                </div>

                {/* Botão Ver Contato Completo */}
                <div className="pt-2 border-t border-slate-100">
                  <Link
                    href={`/contacts?search=${encodeURIComponent(customerName || customerPhone)}`}
                    className="flex items-center justify-between text-xs font-semibold text-red-700 hover:text-red-800 p-2 rounded-xl bg-red-50/50 hover:bg-red-50 transition-colors"
                  >
                    <span>Ver contato completo e histórico</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                <p className="font-medium text-slate-600">Nenhuma conversa selecionada</p>
                <p className="text-[11px] mt-1">Abra uma conversa no Chatwoot para visualizar o contexto.</p>
              </div>
            )}
          </div>

          {/* Sugestão de IA (quando presente) */}
          {aiSuggestion && (
            <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-white to-red-50/30 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                  <Sparkles className="h-4 w-4 text-red-600" />
                  Item Identificado na Conversa
                </span>
                <span className="text-[10px] font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  Confiança {Math.round(aiSuggestion.confidence * 100)}%
                </span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-red-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 text-xs">{aiSuggestion.product}</p>
                  <p className="text-[11px] text-slate-500">
                    {aiSuggestion.qty} un • R$ {aiSuggestion.price.toFixed(2)} cada • {aiSuggestion.fulfillment === "delivery" ? "Entrega" : "Retirada"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAiSuggestion}
                  className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                >
                  Encerrar com este Item
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notas Internas e Histórico (Direita) */}
        <div className="md:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-sm mb-1">Notas Internas</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Visíveis apenas para a equipe da farmácia
            </p>

            <div className="space-y-2">
              <textarea
                rows={3}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Adicionar anotação para o próximo atendente..."
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:outline-none"
              />
              <div className="flex items-center justify-between">
                {noteSuccess && (
                  <span className="text-[11px] text-emerald-600 font-medium">
                    Nota salva!
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSendInternalNote}
                  disabled={!internalNote.trim() || sendingNote || !contextReady}
                  className="ml-auto flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
                >
                  <Send className="h-3 w-3" />
                  Gravar Nota
                </button>
              </div>
            </div>

            {/* Lista de notas gravadas */}
            {notesList.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 max-h-64 overflow-y-auto">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                  Anotações Recentes ({notesList.length})
                </span>
                {notesList.map((n) => (
                  <div key={n.id} className="rounded-xl bg-amber-50/70 border border-amber-200/70 p-2.5 text-xs text-amber-950 shadow-2xs">
                    <p className="whitespace-pre-wrap">{n.content}</p>
                    <span className="text-[10px] text-amber-800/80 block mt-1 font-medium">
                      {n.sender}
                      {n.created_at ? ` • ${new Date(n.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modais Integrados */}
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        conversationId={conversationId}
        accountId={accountId}
        currentAgentName={claimState.claimedBy || "Não atribuído"}
        currentBranchName={claimState.branch || branchName}
        currentBranchId={branchId}
        onSuccess={(info) => {
          setLabels(info.labels);
          setClaimState({
            isClaimed: true,
            claimedBy: info.agentName,
            claimedUserId: info.agentId,
            branch: info.branchName,
          });
          setBranchName(info.branchName);
          setBranchId(info.branchId);
        }}
      />

      <ClosureModal
        isOpen={isClosureOpen}
        onClose={() => setIsClosureOpen(false)}
        conversationId={conversationId}
        accountId={accountId}
        organizationId={currentUser?.organization_id || ""}
        branchId={branchId || currentUser?.primary_branch_id || currentUser?.branch_ids?.[0] || ""}
        channel={channel}
        customerName={customerName || "Cliente"}
        customerPhone={customerPhone}
        initialItems={prefilledItems}
        onSuccess={({ outcome }) => {
          const outcomeText =
            outcome === "sale"
              ? "Venda confirmada e registrada com sucesso."
              : outcome === "not_sold"
              ? "Não venda registrada no sistema."
              : outcome === "resolved"
              ? "Dúvida resolvida e atendimento finalizado."
              : "Atendimento cancelado.";
          setClosureCompleted(outcomeText);
        }}
      />
    </div>
  );

  // Se estiver embutido no iframe do Chatwoot, renderiza direto sem a barra lateral dupla
  if (isEmbedded) {
    return (
      <div className="min-h-screen bg-slate-50 p-3 text-slate-900 font-sans antialiased">
        {content}
      </div>
    );
  }

  // Se estiver sendo acessado diretamente no Hub, encapsula no HubShell com menu lateral
  return (
    <HubShell
      title="Painel de Atendimento"
      subtitle="Contexto da conversa, dados do cliente e ações operacionais"
    >
      {content}
    </HubShell>
  );
}
