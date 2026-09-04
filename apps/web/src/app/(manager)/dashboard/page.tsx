'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Percent,
  MessageSquare,
  Truck,
  Store,
  Filter,
  Users,
  Award,
  Calendar,
} from 'lucide-react';

export default function ManagerDashboardPage() {
  const [filterPeriod, setFilterPeriod] = useState('7d');
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');

  // Dados sintéticos de homologação
  const metrics = {
    totalRevenue: 3489.50,
    confirmedSales: 84,
    averageTicket: 41.54,
    conversionRate: 68.2,
    totalConversations: 123,
    avgResponseMinutes: 4.2,
    transfersCount: 18,
    channels: [
      { name: 'WhatsApp', count: 96, revenue: 2840.00, share: '78%' },
      { name: 'Instagram', count: 18, revenue: 430.50, share: '15%' },
      { name: 'Messenger', count: 9, revenue: 219.00, share: '7%' },
    ],
    branches: [
      { name: 'Matriz Centro', sales: 52, revenue: 2210.00, share: '63%' },
      { name: 'Filial Jardins', sales: 32, revenue: 1279.50, share: '37%' },
    ],
    agents: [
      { name: 'Ana Souza', sales: 38, revenue: 1620.00, conversion: '72%' },
      { name: 'Bruno Lima', sales: 27, revenue: 1140.50, conversion: '66%' },
      { name: 'Carla Prado', sales: 19, revenue: 729.00, conversion: '64%' },
    ],
    topProducts: [
      { name: 'Dipirona 500mg 20 comp', qty: 64, revenue: 544.00 },
      { name: 'Dorflex 36 comp', qty: 42, revenue: 945.00 },
      { name: 'Paracetamol 750mg 20 comp', qty: 38, revenue: 456.00 },
      { name: 'Amoxicilina 500mg 21 cáps', qty: 26, revenue: 751.40 },
      { name: 'Omeprazol 20mg 28 cáps', qty: 18, revenue: 270.00 },
    ],
    fulfillment: {
      delivery: { count: 58, share: '69%' },
      pickup: { count: 26, share: '31%' },
    },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Dashboard Comercial e Operacional
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visão consolidada de conversões, faturamento e desempenho dos canais de atendimento.
          </p>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center gap-2.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl">
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 font-medium">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Filtros:</span>
          </div>

          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 dias (MVP)</option>
            <option value="30d">Últimos 30 dias</option>
          </select>

          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Todos os Canais</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Messenger</option>
          </select>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Todas as Filiais</option>
            <option value="matriz">Matriz Centro</option>
            <option value="jardins">Filial Jardins</option>
          </select>
        </div>
      </div>

      {/* Grid de KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento Total */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Faturamento Total</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              R$ {metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3 h-3" />
              <span>Somente vendas confirmadas por humanos</span>
            </div>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-sky-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticket Médio</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              R$ {metrics.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Média por pedido fechado</p>
          </div>
        </div>

        {/* Taxa de Conversão */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Taxa de Conversão</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {metrics.conversionRate}%
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {metrics.confirmedSales} vendas em {metrics.totalConversations} conversas
            </p>
          </div>
        </div>

        {/* Tempo de Resposta e Eficiência */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tempo 1ª Resposta</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {metrics.avgResponseMinutes} min
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {metrics.transfersCount} transferências registradas
            </p>
          </div>
        </div>
      </div>

      {/* Linha Secundária: Canais & Entrega/Retirada */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Desempenho por Canal */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            Conversas e Faturamento por Canal
          </h3>

          <div className="space-y-4">
            {metrics.channels.map((ch) => (
              <div key={ch.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-300">{ch.name} ({ch.count} conversas)</span>
                  <span className="text-emerald-400 font-semibold">
                    R$ {ch.revenue.toFixed(2)} ({ch.share})
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400"
                    style={{ width: ch.share }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Canal principal de validação: WhatsApp (Evolution API)</span>
            <span className="text-emerald-400 font-semibold">Meta Integrada</span>
          </div>
        </div>

        {/* Modalidade de Entrega vs Retirada */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-400" />
              Modalidade de Atendimento
            </h3>

            <div className="space-y-4 my-auto">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Entrega / Motoboy</p>
                    <p className="text-[10px] text-slate-400">{metrics.fulfillment.delivery.count} pedidos</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-sky-400">{metrics.fulfillment.delivery.share}</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Retirada no Balcão</p>
                    <p className="text-[10px] text-slate-400">{metrics.fulfillment.pickup.count} pedidos</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-amber-400">{metrics.fulfillment.pickup.share}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-4 text-center">
            Dados estruturados coletados na Dashboard App do Chatwoot.
          </p>
        </div>
      </div>

      {/* Linha Terciária: Ranking de Produtos & Desempenho dos Atendentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Produtos Mais Vendidos */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Top Produtos Mais Vendidos
          </h3>

          <div className="divide-y divide-slate-800/80">
            {metrics.topProducts.map((prod, idx) => (
              <div key={prod.name} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="text-slate-200 font-medium truncate">{prod.name}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-slate-100 font-semibold">R$ {prod.revenue.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-400">{prod.qty} unidades</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desempenho por Atendente */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Desempenho da Equipe de Atendimento
          </h3>

          <div className="divide-y divide-slate-800/80">
            {metrics.agents.map((ag) => (
              <div key={ag.name} className="py-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                    {ag.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200">{ag.name}</p>
                    <p className="text-[10px] text-slate-400">{ag.sales} vendas fechadas</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-emerald-400">R$ {ag.revenue.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400">Conversão: {ag.conversion}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
            🔒 <strong className="text-slate-300">Privacidade:</strong> Este ranking e os dados individuais de atendentes são visíveis estritamente pelo papel <span className="text-amber-400 font-semibold">manager</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
