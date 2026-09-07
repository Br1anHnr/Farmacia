"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Ban,
  Plus,
  Trash2,
  ShoppingBag,
  Truck,
  Store,
  Loader2,
  AlertCircle,
  X,
  ArrowRight,
} from "lucide-react";

export type ClosureOutcome = "sale" | "not_sold" | "resolved" | "cancelled";

export type NoSaleReason =
  | "price"
  | "product_unavailable"
  | "delivery_unavailable"
  | "customer_gave_up"
  | "no_response"
  | "other";

interface CartItem {
  product_id?: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
}

interface ProductCatalogItem {
  id: string;
  name: string;
  price: number;
}

interface ClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  accountId: number;
  organizationId: string;
  branchId: string;
  channel: string;
  customerName: string;
  customerPhone?: string;
  initialItems?: CartItem[];
  onSuccess: (result: { outcome: ClosureOutcome; data?: any }) => void;
}

export function ClosureModal({
  isOpen,
  onClose,
  conversationId,
  accountId,
  organizationId,
  branchId,
  channel,
  customerName,
  customerPhone,
  initialItems = [],
  onSuccess,
}: ClosureModalProps) {
  const [outcome, setOutcome] = useState<ClosureOutcome>("sale");
  const [step, setStep] = useState<"choose_outcome" | "details" | "confirm">("choose_outcome");

  // Venda state
  const [catalog, setCatalog] = useState<ProductCatalogItem[]>([]);
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [customItemQty, setCustomItemQty] = useState("1");
  const [discount, setDiscount] = useState<string>("0");
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"delivery" | "pickup">("delivery");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  // Não venda state
  const [reason, setReason] = useState<NoSaleReason | "">("");
  const [otherReasonText, setOtherReasonText] = useState("");

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep("choose_outcome");
      setError(null);
      setSuccess(false);
      setReason("");
      setOtherReasonText("");
      return;
    }

    if (initialItems.length > 0) {
      setItems(initialItems);
      setOutcome("sale");
    }

    // Carrega catalogo de produtos
    async function loadProducts() {
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          const data = await res.json();
          setCatalog(data.products || []);
        }
      } catch {
        // Ignora falha de catalogo; permite insercao manual
      }
    }
    loadProducts();
  }, [isOpen, initialItems]);

  if (!isOpen) return null;

  // Calculos de venda
  const subtotal = items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  const discountVal = parseFloat(discount) || 0;
  const totalAmount = Math.max(0, subtotal - discountVal);

  function addItemFromCatalog() {
    if (!selectedCatalogId) return;
    const prod = catalog.find((p) => p.id === selectedCatalogId);
    if (!prod) return;

    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === prod.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          product_id: prod.id,
          product_name: prod.name,
          unit_price: prod.price,
          quantity: 1,
        },
      ];
    });
    setSelectedCatalogId("");
  }

  function addCustomItem() {
    const name = customItemName.trim();
    const price = parseFloat(customItemPrice);
    const qty = parseInt(customItemQty, 10);
    if (!name || isNaN(price) || price < 0 || isNaN(qty) || qty <= 0) {
      setError("Informe o nome do item, quantidade e valor válidos.");
      return;
    }
    setError(null);
    setItems((prev) => [
      ...prev,
      {
        product_id: null,
        product_name: name,
        unit_price: price,
        quantity: qty,
      },
    ]);
    setCustomItemName("");
    setCustomItemPrice("");
    setCustomItemQty("1");
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConfirmClosure() {
    setError(null);
    setLoading(true);

    let payload: any;
    const idempotencyKey = crypto.randomUUID();

    if (outcome === "sale") {
      if (items.length === 0) {
        setError("Adicione pelo menos um produto para registrar a venda.");
        setLoading(false);
        return;
      }
      payload = {
        outcome: "sale",
        organization_id: organizationId,
        branch_id: branchId,
        chatwoot_account_id: accountId,
        chatwoot_conversation_id: conversationId,
        channel: channel || "whatsapp",
        customer_name: customerName || "Cliente",
        customer_phone: customerPhone || undefined,
        items: items.map((i) => ({
          product_id: i.product_id || null,
          product_name: i.product_name,
          unit_price: i.unit_price,
          quantity: i.quantity,
        })),
        discount: discountVal,
        fulfillment_method: fulfillmentMethod,
        origin_type: "manual",
        delivery_address: fulfillmentMethod === "delivery" ? deliveryAddress.trim() || undefined : undefined,
        notes: saleNotes.trim() || undefined,
      };
    } else if (outcome === "not_sold") {
      if (!reason) {
        setError("Selecione o motivo da não venda.");
        setLoading(false);
        return;
      }
      payload = {
        outcome: "not_sold",
        organization_id: organizationId,
        branch_id: branchId,
        chatwoot_account_id: accountId,
        chatwoot_conversation_id: conversationId,
        channel: channel || "whatsapp",
        reason,
        notes: reason === "other" ? otherReasonText.trim() || undefined : undefined,
      };
    } else {
      payload = {
        outcome,
        organization_id: organizationId,
        branch_id: branchId,
        chatwoot_account_id: accountId,
        chatwoot_conversation_id: conversationId,
        channel: channel || "whatsapp",
      };
    }

    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/close?account_id=${accountId}`,
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "CONVERSATION_NOT_FOUND" || data.error === "CONVERSATION_ACCESS_DENIED") {
          throw new Error("Conversa indisponível para seu usuário. Peça ao gerente para transferi-la para você pelo Hub e reabra o painel.");
        }
        throw new Error(data.message || data.error || "Falha ao encerrar atendimento.");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess({ outcome, data });
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Erro de comunicação ao encerrar atendimento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-base">Encerrar Atendimento</h3>
            <p className="text-xs text-slate-500">
              Conversa #{conversationId} • {customerName || "Cliente"}
            </p>
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

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-medium">Atenção</p>
                <p className="text-xs text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <p className="font-medium">Atendimento finalizado com sucesso!</p>
            </div>
          )}

          {/* Seleção do Desfecho */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Desfecho do Atendimento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setOutcome("sale");
                  setError(null);
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  outcome === "sale"
                    ? "border-red-600 bg-red-50/50 text-red-700 ring-2 ring-red-600/20 font-semibold shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <ShoppingBag className={`h-5 w-5 mb-1.5 ${outcome === "sale" ? "text-red-600" : "text-slate-400"}`} />
                <span className="text-xs">Venda realizada</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOutcome("not_sold");
                  setError(null);
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  outcome === "not_sold"
                    ? "border-amber-600 bg-amber-50/50 text-amber-800 ring-2 ring-amber-600/20 font-semibold shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <Ban className={`h-5 w-5 mb-1.5 ${outcome === "not_sold" ? "text-amber-600" : "text-slate-400"}`} />
                <span className="text-xs">Não venda</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOutcome("resolved");
                  setError(null);
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  outcome === "resolved"
                    ? "border-emerald-600 bg-emerald-50/50 text-emerald-800 ring-2 ring-emerald-600/20 font-semibold shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <CheckCircle2 className={`h-5 w-5 mb-1.5 ${outcome === "resolved" ? "text-emerald-600" : "text-slate-400"}`} />
                <span className="text-xs">Dúvida resolvida</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOutcome("cancelled");
                  setError(null);
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  outcome === "cancelled"
                    ? "border-slate-600 bg-slate-100 text-slate-900 ring-2 ring-slate-600/20 font-semibold shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <XCircle className={`h-5 w-5 mb-1.5 ${outcome === "cancelled" ? "text-slate-700" : "text-slate-400"}`} />
                <span className="text-xs">Cancelado</span>
              </button>
            </div>
          </div>

          {/* Formulario especifico de VENDA */}
          {outcome === "sale" && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Itens do Pedido ({items.length})
                </span>
              </div>

              {/* Seletor de catalogo */}
              {catalog.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => setSelectedCatalogId(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-red-600 focus:outline-none"
                  >
                    <option value="">Buscar produto no catálogo da farmácia...</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — R$ {c.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addItemFromCatalog}
                    disabled={!selectedCatalogId}
                    className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar
                  </button>
                </div>
              )}

              {/* Insercao rapida manual */}
              <div className="grid grid-cols-12 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="col-span-6">
                  <input
                    type="text"
                    placeholder="Nome do produto ou medicamento"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    value={customItemQty}
                    onChange={(e) => setCustomItemQty(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:outline-none text-center"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Preço (R$)"
                    value={customItemPrice}
                    onChange={(e) => setCustomItemPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <button
                    type="button"
                    onClick={addCustomItem}
                    className="w-full h-full rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center justify-center transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Lista de itens inseridos */}
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  Nenhum produto adicionado ao pedido.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-white text-xs">
                      <div className="flex-1 pr-2">
                        <p className="font-medium text-slate-800">{item.product_name}</p>
                        <p className="text-slate-400 text-[11px]">
                          {item.quantity} un × R$ {item.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">
                          R$ {(item.quantity * item.unit_price).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totais e Desconto */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Desconto (R$)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-xs font-medium text-slate-800 focus:border-red-600 focus:outline-none"
                  />
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-900 text-sm">Total da Venda</span>
                  <span className="font-bold text-red-600 text-lg">
                    R$ {totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Forma de Entrega */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Forma de Atendimento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod("delivery")}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-colors ${
                      fulfillmentMethod === "delivery"
                        ? "border-red-600 bg-red-50 text-red-700 ring-2 ring-red-600/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Truck className="h-4 w-4 text-red-600" />
                    Entrega (Delivery)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod("pickup")}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-colors ${
                      fulfillmentMethod === "pickup"
                        ? "border-red-600 bg-red-50 text-red-700 ring-2 ring-red-600/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Store className="h-4 w-4 text-red-600" />
                    Retirada no Balcão
                  </button>
                </div>
              </div>

              {fulfillmentMethod === "delivery" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Endereço de Entrega
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Rua, número, complemento, bairro"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Observações da Venda
                </label>
                <input
                  type="text"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="Ex: Pagamento no cartão na entrega / troco para 50..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Formulario especifico de NÃO VENDA */}
          {outcome === "not_sold" && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                  Motivo da Não Venda <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    { id: "price", label: "Preço alto / achou caro" },
                    { id: "product_unavailable", label: "Produto indisponível / falta de estoque" },
                    { id: "delivery_unavailable", label: "Entrega indisponível / fora da área" },
                    { id: "customer_gave_up", label: "Cliente desistiu da compra" },
                    { id: "no_response", label: "Cliente não respondeu" },
                    { id: "other", label: "Outro motivo" },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                        reason === opt.id
                          ? "border-amber-600 bg-amber-50/50 text-amber-900 font-semibold"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="not_sold_reason"
                        value={opt.id}
                        checked={reason === opt.id}
                        onChange={() => {
                          setReason(opt.id as NoSaleReason);
                          setError(null);
                        }}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {reason === "other" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Descreva o motivo <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={otherReasonText}
                    onChange={(e) => setOtherReasonText(e.target.value)}
                    placeholder="Descreva detalhadamente o motivo da desistência..."
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Formulario de DÚVIDA / CANCELADO */}
          {(outcome === "resolved" || outcome === "cancelled") && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-800 mb-1">
                {outcome === "resolved"
                  ? "Finalizar como Dúvida Resolvida"
                  : "Finalizar como Atendimento Cancelado"}
              </p>
              <p>
                {outcome === "resolved"
                  ? "Esta ação encerrará a conversa e registrará a resolução satisfatória no histórico de atendimentos da farmácia."
                  : "Esta ação registrará o cancelamento do contato no histórico operacional."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="text-xs text-slate-500">
            {outcome === "sale" && (
              <span>Total a confirmar: <strong className="text-slate-900">R$ {totalAmount.toFixed(2)}</strong></span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading || (outcome === "sale" && items.length === 0) || (outcome === "not_sold" && !reason)}
              onClick={handleConfirmClosure}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Encerrando...
                </>
              ) : (
                "Confirmar Encerramento"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
