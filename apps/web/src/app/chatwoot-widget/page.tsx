'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { AUTH_COOKIE_NAME, type UserContext } from '@/lib/auth-store';

interface CartItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export default function ChatwootWidgetPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('mf_user_context');
    if (raw) {
      try {
        setCurrentUser(JSON.parse(raw) as UserContext);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleLogout = () => {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0;`;
    localStorage.removeItem('mf_user_context');
    router.push('/login');
  };

  // Contexto da conversa do Chatwoot (recebido via postMessage ou parâmetros de URL)
  const [conversationId, setConversationId] = useState<number>(101);
  const [customerName, setCustomerName] = useState<string>('João da Silva');
  const [customerPhone, setCustomerPhone] = useState<string>('+55 (11) 98888-7777');
  const [channel, setChannel] = useState<string>('whatsapp');
  const [branchName, setBranchName] = useState<string>('Matriz Centro');

  // Sugestões extraídas silenciosamente pela IA
  const [aiSuggestion, setAiSuggestion] = useState<{
    product: string;
    qty: number;
    price: number;
    fulfillment: 'delivery' | 'pickup';
    address?: string;
    confidence: number;
  } | null>({
    product: 'Dipirona 500mg 20 comp',
    qty: 2,
    price: 8.50,
    fulfillment: 'delivery',
    address: 'Rua das Flores, 123 - Centro',
    confidence: 0.88,
  });

  // Estado do formulário de venda
  const [cart, setCart] = useState<CartItem[]>([
    { id: '1', name: 'Dipirona 500mg 20 comp', unitPrice: 8.50, quantity: 2 },
  ]);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('Rua das Flores, 123 - Centro');
  const [discount, setDiscount] = useState<number>(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedSaleId, setConfirmedSaleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catálogo provisório para seleção rápida
  const catalog = [
    { name: 'Dipirona 500mg 20 comp', price: 8.50 },
    { name: 'Paracetamol 750mg 20 comp', price: 12.00 },
    { name: 'Amoxicilina 500mg 21 cápsulas', price: 28.90 },
    { name: 'Dorflex 36 comprimidos', price: 22.50 },
    { name: 'Omeprazol 20mg 28 cápsulas', price: 15.00 },
    { name: 'Vitamina C 1g efervescente', price: 19.90 },
  ];

  // Escuta evento postMessage do Chatwoot no iframe
  useEffect(() => {
    const handleChatwootMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.event === 'chatwoot:ready' || data.event === 'appContext') {
          if (data.data?.conversation?.id) {
            setConversationId(data.data.conversation.id);
          }
          if (data.data?.contact?.name) {
            setCustomerName(data.data.contact.name);
          }
          if (data.data?.contact?.phone_number) {
            setCustomerPhone(data.data.contact.phone_number);
          }
        }
      } catch {
        // ignora mensagens que não sejam JSON do chatwoot
      }
    };

    window.addEventListener('message', handleChatwootMessage);
    return () => window.removeEventListener('message', handleChatwootMessage);
  }, []);

  // Cálculos financeiros
  const subtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
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
  };

  const handleAddItem = (item: { name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.name === item.name);
      if (existing) {
        return prev.map((p) =>
          p.name === item.name ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [...prev, { id: String(Date.now()), name: item.name, unitPrice: item.price, quantity: 1 }];
    });
  };

  const handleRemoveItem = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const handleConfirmSale = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      // Simula confirmação com chamada ao Supabase / API
      const fakeSaleId = `sale_${Math.floor(1000 + Math.random() * 9000)}`;
      
      const payload = {
        organization_id: '11111111-1111-1111-1111-111111111111',
        branch_id: '22222222-2222-2222-2222-222222222221',
        chatwoot_conversation_id: conversationId,
        channel,
        customer_name: customerName,
        customer_phone: customerPhone,
        items: cart.map((c) => ({
          product_name: c.name,
          unit_price: c.unitPrice,
          quantity: c.quantity,
        })),
        subtotal,
        discount,
        total_amount: totalAmount,
        fulfillment_method: fulfillmentMethod,
        delivery_address: fulfillmentMethod === 'delivery' ? deliveryAddress : undefined,
        status: 'confirmed',
        origin_type: aiSuggestion ? 'ai_suggested' : 'manual',
      };

      console.log('[Dashboard App] Confirmando venda no Supabase:', payload);

      // Simulação de delay de gravação e registro de auditoria
      await new Promise((r) => setTimeout(r, 600));

      setConfirmedSaleId(fakeSaleId);
      setIsConfirmed(true);
    } catch (err) {
      console.error('Erro ao confirmar venda:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans text-xs antialiased">
      {/* Barra de Navegação Superior e Troca de Usuário */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 mb-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs">MultiFarma Hub</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold uppercase tracking-wider">
                {currentUser?.role || 'Atendente'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {currentUser?.full_name || 'Ana Clara'}
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

          {currentUser?.role === 'manager' && (
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
            <h1 className="font-bold text-slate-100 text-sm">Painel da Farmácia</h1>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-400" />
              {branchName} • Conv #{conversationId}
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px] uppercase">
          {channel}
        </span>
      </div>

      {/* Cartão de Contexto do Cliente */}
      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 mb-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-200">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{customerName}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">ID: 4441</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <Phone className="w-3 h-3 text-slate-500" />
          <span>{customerPhone}</span>
        </div>
      </div>

      {/* Cartão de Sugestão Silenciosa de IA */}
      {aiSuggestion && !isConfirmed && (
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
            Identificado: <strong className="text-white">{aiSuggestion.qty}x {aiSuggestion.product}</strong> para{' '}
            <span className="text-emerald-300">{aiSuggestion.fulfillment === 'delivery' ? 'Entrega' : 'Retirada'}</span>.
          </p>

          <button
            onClick={handleApplySuggestion}
            className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>Preencher Formulário com Sugestão</span>
          </button>
        </div>
      )}

      {/* Formulário Operacional de Finalização da Venda */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="font-bold text-slate-200 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            Itens da Venda
          </h2>
          <span className="text-[10px] text-slate-500">Confirmação Humana</span>
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
                  <p className="font-medium text-slate-200 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {item.quantity} un x R$ {item.unitPrice.toFixed(2)} ={' '}
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
              onClick={() => setFulfillmentMethod('delivery')}
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition-all ${
                fulfillmentMethod === 'delivery'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Entrega</span>
            </button>

            <button
              disabled={isConfirmed}
              onClick={() => setFulfillmentMethod('pickup')}
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition-all ${
                fulfillmentMethod === 'pickup'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Retirada Balcão</span>
            </button>
          </div>

          {fulfillmentMethod === 'delivery' && (
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
            <span className="text-emerald-400">R$ {totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Botão de Confirmação da Venda */}
        {isConfirmed ? (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              Venda #{confirmedSaleId} Confirmada!
            </div>
            <p className="text-[10px] text-slate-400">
              Registrada no Supabase e contabilizada no faturamento gerencial.
            </p>
            <button
              onClick={() => {
                setIsConfirmed(false);
                setCart([]);
                setConfirmedSaleId(null);
              }}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] transition-colors"
            >
              Nova Venda para este Cliente
            </button>
          </div>
        ) : (
          <button
            onClick={handleConfirmSale}
            disabled={cart.length === 0 || isSubmitting}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>Confirmar Venda (Humano)</span>
          </button>
        )}
      </div>

      <div className="mt-4 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
        <span>🔒 Conformidade LGPD • Dados isolados no Supabase</span>
      </div>
    </div>
  );
}
