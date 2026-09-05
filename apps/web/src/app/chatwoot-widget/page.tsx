"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  CheckCircle2,
  Sparkles,
  Truck,
  Store,
  Plus,
  Trash2,
  Phone,
  User,
  AlertCircle,
  Stethoscope,
  Building2,
  ShieldCheck,
  RefreshCw,
  LogOut,
  MessagesSquare,
  LayoutDashboard,
  UserCheck,
} from "lucide-react";
import { AUTH_COOKIE_NAME, type UserContext } from "@/lib/auth-store";

interface CartItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

type ClosureOutcome = "sale" | "not_sold" | "resolved" | "cancelled";

const noSaleReasons = [
  ["price", "Preço"],
  ["product_unavailable", "Produto indisponível"],
  ["delivery_unavailable", "Entrega indisponível"],
  ["customer_gave_up", "Cliente desistiu"],
  ["no_response", "Sem resposta do cliente"],
  ["other", "Outro motivo"],
] as const;

export default function ChatwootWidgetPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setCurrentUser(d.user);
          localStorage.setItem("mf_user_context", JSON.stringify(d.user));
          if (d.user.full_name)
            setActiveAgentName(d.user.full_name.split(" (")[0]);
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

  // Contexto da conversa do Chatwoot (recebido via postMessage ou parâmetros de URL)
  const [conversationId, setConversationId] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [channel, setChannel] = useState<string>("whatsapp");
  const [branchName, setBranchName] = useState<string>("Matriz Centro");
  const [appliedFeedback, setAppliedFeedback] = useState(false);

  // Estado de atribuição de atendimento e filial
  const [claimState, setClaimState] = useState<{
    isClaimed: boolean;
    claimedBy: string;
    branch: string;
  }>({
    isClaimed: false,
    claimedBy: "",
    branch: "",
  });
  const [isClaiming, setIsClaiming] = useState(false);
  const [activeAgentName, setActiveAgentName] = useState("");
  const [activeBranchName, setActiveBranchName] = useState(
    "Unidade Guaratinguetá",
  );

  // Sugestões extraídas silenciosamente pela IA
  const [aiSuggestion, setAiSuggestion] = useState<{
    product: string;
    qty: number;
    price: number;
    fulfillment: "delivery" | "pickup";
    address?: string;
    confidence: number;
  } | null>(null);

  // Estado do formulário de venda (inicia limpo para feedback claro do usuário)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "delivery" | "pickup"
  >("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("Retirada no Balcão");
  const [discount, setDiscount] = useState<number>(0);
  const [closureOutcome, setClosureOutcome] =
    useState<ClosureOutcome>("sale");
  const [noSaleReason, setNoSaleReason] = useState("");
  const [closureLabel, setClosureLabel] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedSaleId, setConfirmedSaleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [catalog, setCatalog] = useState<
    Array<{ name: string; price: number }>
  >([]);
  const [conversationBranchId, setConversationBranchId] = useState("");
  const [saleError, setSaleError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCatalog(d.products || []))
      .catch(() => setSaleError("Não foi possível carregar o catálogo."));
  }, []);

  // Handshake bidirecional com o Chatwoot no iframe
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Verificar parâmetros na URL (se existirem)
    const params = new URLSearchParams(window.location.search);
    const qConv = params.get("conversation_id") || params.get("id");
    const qName = params.get("contact_name") || params.get("name");
    const qPhone = params.get("contact_phone") || params.get("phone");
    const qChannel = params.get("channel");
    if (qConv) setConversationId(parseInt(qConv, 10));
    if (qName) setCustomerName(qName);
    if (qPhone) setCustomerPhone(qPhone);
    if (qChannel) setChannel(qChannel.toLowerCase());

    // 2. Solicitar contexto ao Chatwoot via postMessage
    const requestContext = () => {
      if (
        window.parent &&
        window.parent !== window &&
        process.env.NEXT_PUBLIC_CHATWOOT_ORIGIN
      ) {
        window.parent.postMessage(
          "chatwoot-dashboard-app:fetch-info",
          process.env.NEXT_PUBLIC_CHATWOOT_ORIGIN!,
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
          const contact = data.data?.contact;
          const inbox = data.data?.inbox || conv?.inbox;
          if (conv?.id) setConversationId(conv.id);
          if (contact?.name) setCustomerName(contact.name);
          if (contact?.phone_number) setCustomerPhone(contact.phone_number);

          // Detecta canal da conversa (WhatsApp, Instagram, Messenger)
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
      } catch {
        // ignora mensagens que não sejam JSON do chatwoot
      }
    };

    window.addEventListener("message", handleChatwootMessage);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("message", handleChatwootMessage);
    };
  }, []);

  // Busca sugestões reais e status de atendimento da conversa
  useEffect(() => {
    setCart([]);
    setIsConfirmed(false);
    setConfirmedSaleId(null);
    setClosureOutcome("sale");
    setNoSaleReason("");
    setClosureLabel("");
    setConversationBranchId("");
    setAiSuggestion(null);
    setClaimState({ isClaimed: false, claimedBy: "", branch: "" });
    if (!conversationId) return;
    let active = true;

    const fetchSuggestions = async () => {
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/suggestions`,
        );
        if (active && res.ok) {
          const data = await res.json();
          if (data?.suggestions && data.suggestions.length > 0) {
            const latest = data.suggestions[data.suggestions.length - 1];
            setAiSuggestion({
              product:
                latest.suggested_product_name || "Dipirona 500mg 20 comp",
              qty: latest.suggested_quantity || 1,
              price: latest.suggested_unit_price || 8.5,
              fulfillment: latest.suggested_fulfillment || "pickup",
              address: latest.suggested_address || "Retirada no Balcão",
              confidence: latest.confidence || 0.95,
            });
            setFulfillmentMethod(latest.suggested_fulfillment || "pickup");
            if (latest.suggested_address)
              setDeliveryAddress(latest.suggested_address);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar sugestão de IA:", err);
      }
    };

    const fetchClaimStatus = async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/claim`);
        if (active && res.ok) {
          const data = await res.json();
          setConversationBranchId(data.branch || "");
          if (data?.is_claimed) {
            setClaimState({
              isClaimed: true,
              claimedBy: data.claimed_by || "Atendente",
              branch: data.branch || "Unidade Guaratinguetá",
            });
          }
        }
      } catch (err) {
        console.warn("Erro ao consultar status de atendimento:", err);
      }
    };

    fetchSuggestions();
    fetchClaimStatus();
    return () => {
      active = false;
    };
  }, [conversationId]);

  const handleClaimAttendance = async () => {
    if (!conversationId) return;
    setIsClaiming(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: activeAgentName,
          branch_name: activeBranchName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setClaimState({
          isClaimed: true,
          claimedBy: data.claimed_by || activeAgentName,
          branch: data.branch || activeBranchName,
        });
      }
    } catch (err) {
      console.error("Erro ao assumir atendimento:", err);
    } finally {
      setIsClaiming(false);
    }
  };

  // Cálculos financeiros
  const subtotal = cart.reduce(
    (acc, item) => acc + item.unitPrice * item.quantity,
    0,
  );
  const totalAmount = Math.max(0, subtotal - discount);

  const handleApplySuggestion = () => {
    if (!aiSuggestion) return;
    setCart([
      {
        id: String(Date.now()),
        name: aiSuggestion.product,
        unitPrice: aiSuggestion.price,
        quantity: aiSuggestion.qty,
      },
    ]);
    setFulfillmentMethod(aiSuggestion.fulfillment);
    if (aiSuggestion.address) setDeliveryAddress(aiSuggestion.address);
    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 3000);
  };

  const handleAddItem = (item: { name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.name === item.name);
      if (existing) {
        return prev.map((p) =>
          p.name === item.name ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }
      return [
        ...prev,
        {
          id: String(Date.now()),
          name: item.name,
          unitPrice: item.price,
          quantity: 1,
        },
      ];
    });
  };

  const handleRemoveItem = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const closureAttempt = useRef<{ payload: string; key: string } | null>(null);
  const handleCloseConversation = async () => {
    if (
      isSubmitting ||
      isConfirmed ||
      (closureOutcome === "sale" && cart.length === 0) ||
      (closureOutcome === "not_sold" && !noSaleReason)
    )
      return;
    if (!currentUser || !conversationId || !conversationBranchId) {
      setSaleError("Confirme a sessão e o contexto do atendimento.");
      return;
    }
    setSaleError(null);
    setIsSubmitting(true);

    try {
      const assignedBranchId = conversationBranchId;

      const context = {
        organization_id: currentUser?.organization_id,
        branch_id: assignedBranchId,
        chatwoot_conversation_id: conversationId,
        channel,
      };
      const payload =
        closureOutcome === "sale"
          ? {
              ...context,
              outcome: closureOutcome,
        customer_name: customerName,
        customer_phone: customerPhone,
        agent_name: claimState.isClaimed
          ? claimState.claimedBy
          : activeAgentName,
        items: cart.map((c) => ({
          product_name: c.name,
          unit_price: c.unitPrice,
          quantity: c.quantity,
        })),
        subtotal,
        discount,
        total_amount: totalAmount,
        fulfillment_method: fulfillmentMethod,
        delivery_address:
          fulfillmentMethod === "delivery" ? deliveryAddress : undefined,
        origin_type: aiSuggestion ? "ai_suggested" : "manual",
            }
          : closureOutcome === "not_sold"
            ? { ...context, outcome: closureOutcome, reason: noSaleReason }
            : { ...context, outcome: closureOutcome };

      const serialized = JSON.stringify(payload);
      const storageKey =
        "mf_closure_attempt:" +
        currentUser.user_id +
        ":" +
        conversationId +
        ":" +
        closureOutcome;
      const stored = sessionStorage.getItem(storageKey);
      const previous = stored
        ? (JSON.parse(stored) as { payload: string; key: string })
        : null;
      const key =
        previous?.payload === serialized ? previous.key : crypto.randomUUID();
      closureAttempt.current = { payload: serialized, key };
      sessionStorage.setItem(storageKey, JSON.stringify(closureAttempt.current));

      const res = await fetch(`/api/conversations/${conversationId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": closureAttempt.current.key,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Erro na API de encerramento: ${res.statusText}`);
      }

      const savedClosure = await res.json();
      if (
        savedClosure.persisted !== true ||
        savedClosure.outcome !== closureOutcome ||
        (closureOutcome === "sale" && !savedClosure.sale_id)
      )
        throw new Error("Encerramento não persistido");
      sessionStorage.removeItem(storageKey);
      setConfirmedSaleId(savedClosure.sale_id || null);
      setClosureLabel(
        closureOutcome === "sale"
          ? "Venda realizada"
          : closureOutcome === "not_sold"
            ? "Não venda registrada"
            : closureOutcome === "resolved"
              ? "Dúvida resolvida"
              : "Atendimento cancelado",
      );
      setIsConfirmed(true);
    } catch (err) {
      setSaleError(
        "Atendimento não encerrado. Tente novamente; a mesma solicitação não será duplicada.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans text-xs antialiased">
      {saleError && (
        <p role="alert" className="text-red-300 mb-3">
          {saleError}
        </p>
      )}
      {/* Barra de Navegação Superior e Troca de Usuário */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 mb-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs">
                MultiFarma Hub
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold uppercase tracking-wider">
                {currentUser?.role || "Atendente"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {currentUser?.full_name || "Sessão não confirmada"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <MessagesSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chat da Equipe</span>
          </Link>

          {currentUser?.role === "manager" && (
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
          )}

          <button
            onClick={handleLogout}
            title="Sair / Trocar Usuário"
            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Header do Widget Lateral */}
      <div className="border-b border-slate-800 pb-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm">
              Painel da Farmácia
            </h1>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-400" />
              {branchName} • Conv #{conversationId}
            </p>
          </div>
        </div>
        {channel === "instagram" ? (
          <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30 font-bold text-[10px] uppercase flex items-center gap-1 shadow-sm">
            <span>📸</span> Instagram
          </span>
        ) : channel === "messenger" || channel === "facebook" ? (
          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold text-[10px] uppercase flex items-center gap-1 shadow-sm">
            <span>💬</span> Messenger
          </span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] uppercase flex items-center gap-1 shadow-sm">
            <span>📱</span> WhatsApp
          </span>
        )}
      </div>

      {/* Barra de Controle e Atribuição de Atendimento */}
      {!claimState.isClaimed ? (
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 mb-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Fila de Atendimento (Não Atribuído)
            </span>
            <span className="text-[10px] text-slate-500">
              Clique para assumir
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <select
              value={activeAgentName}
              onChange={(e) => setActiveAgentName(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 flex-1 focus:outline-none focus:border-emerald-500"
            >
              <option value="Ana Souza">Ana Souza (Atendente)</option>
              <option value="Bruno Lima">Bruno Lima (Atendente)</option>
              <option value="Carlos Mendes">Carlos Mendes (Gerente)</option>
            </select>

            <select
              value={activeBranchName}
              onChange={(e) => setActiveBranchName(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 flex-1 focus:outline-none focus:border-emerald-500"
            >
              <option value="Unidade Guaratinguetá">
                Unidade Guaratinguetá
              </option>
              <option value="Matriz Centro">Matriz Centro</option>
              <option value="Filial Jardins">Filial Jardins</option>
            </select>

            <button
              onClick={handleClaimAttendance}
              disabled={isClaiming}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isClaiming ? "Assumindo..." : "Assumir Atendimento"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 mb-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-emerald-300 text-xs">
                  Atendimento em Andamento
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Responsável:{" "}
                <strong className="text-white">{claimState.claimedBy}</strong> •{" "}
                {claimState.branch}
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Assumido
          </span>
        </div>
      )}

      {/* Cartão de Contexto do Cliente */}
      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 mb-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-200">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{customerName}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Contato do atendimento
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <Phone className="w-3 h-3 text-slate-500" />
          <span>{customerPhone}</span>
        </div>
      </div>

      {/* Cartão de Sugestão Silenciosa de IA */}
      {aiSuggestion && closureOutcome === "sale" && !isConfirmed && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 mb-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 font-bold text-emerald-300 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Sugestão Extraída do Chat
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
              {Math.round(aiSuggestion.confidence * 100)}% conf.
            </span>
          </div>

          <p className="text-slate-300 text-[11px] mb-2 leading-relaxed">
            Identificado:{" "}
            <strong className="text-white">
              {aiSuggestion.qty}x {aiSuggestion.product}
            </strong>{" "}
            para{" "}
            <span className="text-emerald-300">
              {aiSuggestion.fulfillment === "delivery" ? "Entrega" : "Retirada"}
            </span>
            .
          </p>

          <button
            onClick={handleApplySuggestion}
            className={`w-full py-2 rounded-lg font-semibold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow-sm ${
              appliedFeedback
                ? "bg-emerald-500 text-white ring-2 ring-emerald-400 animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {appliedFeedback ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sugestão Aplicada ao Carrinho!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Preencher Formulário com Sugestão</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Formulário Operacional de Encerramento */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="font-bold text-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Encerrar atendimento
          </h2>
          <span className="text-[10px] text-slate-500">Confirmação Humana</span>
        </div>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Resultado do atendimento">
          {(
            [
              ["sale", "Venda realizada"],
              ["not_sold", "Não venda"],
              ["resolved", "Dúvida resolvida"],
              ["cancelled", "Cancelado"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={closureOutcome === value}
              disabled={isConfirmed || isSubmitting}
              onClick={() => {
                setClosureOutcome(value);
                setSaleError(null);
              }}
              className={`rounded-lg border px-2.5 py-2 text-left font-semibold transition-colors ${
                closureOutcome === value
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                  : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {closureOutcome === "sale" && (
          <>
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 font-bold text-slate-200">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              Produtos e valor
            </div>

        {/* Lista do Carrinho Atual */}
        <div className="space-y-2">
          {cart.length === 0 ? (
            <div className="p-4 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
              Nenhum item selecionado. Adicione abaixo.
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-200 truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {item.quantity} un x R$ {item.unitPrice.toFixed(2)} ={" "}
                    <strong className="text-emerald-400">
                      R$ {(item.quantity * item.unitPrice).toFixed(2)}
                    </strong>
                  </p>
                </div>
                {!isConfirmed && (
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Seletor Rápido de Catálogo */}
        {!isConfirmed && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Adicionar do Catálogo
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {catalog.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => handleAddItem(cat)}
                  className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                >
                  <p className="text-[11px] font-medium text-slate-300 group-hover:text-white truncate">
                    {cat.name}
                  </p>
                  <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                    R$ {cat.price.toFixed(2)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modalidade de Entrega vs Retirada */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            Forma de Atendimento
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={isConfirmed}
              onClick={() => setFulfillmentMethod("delivery")}
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition-all ${
                fulfillmentMethod === "delivery"
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Entrega</span>
            </button>

            <button
              disabled={isConfirmed}
              onClick={() => setFulfillmentMethod("pickup")}
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition-all ${
                fulfillmentMethod === "pickup"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Retirada Balcão</span>
            </button>
          </div>

          {fulfillmentMethod === "delivery" && (
            <input
              type="text"
              disabled={isConfirmed}
              placeholder="Endereço de entrega..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          )}
        </div>

        {/* Resumo Financeiro */}
        <div className="pt-2 border-t border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal:</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Desconto:</span>
            <span>R$ {discount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-100 font-bold text-sm pt-1 border-t border-slate-800/80">
            <span>Total da Venda:</span>
            <span className="text-emerald-400">
              R$ {totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

          </>
        )}

        {closureOutcome === "not_sold" && !isConfirmed && (
          <div className="space-y-1.5">
            <label
              htmlFor="no-sale-reason"
              className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block"
            >
              Motivo da não venda <span className="text-red-400">*</span>
            </label>
            <select
              id="no-sale-reason"
              required
              value={noSaleReason}
              onChange={(event) => setNoSaleReason(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Selecione o motivo</option>
              {noSaleReasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {(closureOutcome === "resolved" || closureOutcome === "cancelled") &&
          !isConfirmed && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-300">
              {closureOutcome === "resolved"
                ? "Registra que a dúvida do cliente foi resolvida."
                : "Registra que este atendimento foi cancelado."}
            </div>
          )}

        {/* Confirmação exibida somente depois da persistência */}
        {isConfirmed ? (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              {closureLabel}
              {confirmedSaleId ? ` • Venda #${confirmedSaleId}` : ""}
            </div>
            <p className="text-[10px] text-slate-400">
              Encerramento salvo com sucesso.
            </p>
          </div>
        ) : (
          <button
            onClick={handleCloseConversation}
            disabled={
              isSubmitting ||
              (closureOutcome === "sale" && cart.length === 0) ||
              (closureOutcome === "not_sold" && !noSaleReason)
            }
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>{isSubmitting ? "Salvando..." : "Salvar e encerrar"}</span>
          </button>
        )}
      </div>

      <div className="mt-4 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
        <span>🔒 Conformidade LGPD • Dados isolados no Supabase</span>
      </div>
    </div>
  );
}
