"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  RefreshCw,
  AlertCircle,
  Building2,
  Clock,
} from "lucide-react";
import { type DashboardKPIs } from "@hub-farmacia/contracts";

export default function ManagerDashboardPage() {
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        "/api/dashboard/summary?" +
          new URLSearchParams({
            period: filterPeriod,
            channel: filterChannel,
            branch: filterBranch,
          }),
        { cache: "no-store" }
      );
      if (!res.ok) {
        throw new Error(`Erro ao consultar dados (${res.status})`);
      }
      const data: DashboardKPIs = await res.json();
      setKpis(data);
      const now = new Date();
      setLastUpdated(
        now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados comerciais");
    } finally {
      setIsLoading(false);
    }
  }, [filterPeriod, filterChannel, filterBranch]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Função auxiliar para evitar exibição de UUIDs
  function formatDisplayName(name: string, fallback: string) {
    if (!name || name.includes("unknown") || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(name)) {
      return fallback;
    }
    if (name.startsWith("Unidade ") && name.length > 20) {
      return "Matriz Centro";
    }
    if (name.startsWith("Colaborador ") && name.length > 20) {
      return "Atendente Farmácia";
    }
    return name;
  }

  const totalRev = kpis?.total_revenue || 0;
  const deliveryCount = kpis?.delivery_vs_pickup?.delivery_count || 0;
  const pickupCount = kpis?.delivery_vs_pickup?.pickup_count || 0;
  const totalFulfillment = deliveryCount + pickupCount;

  const metrics = {
    totalRevenue: totalRev,
    confirmedSales: kpis?.confirmed_sales_count || 0,
    averageTicket: kpis?.average_ticket || 0,
    conversionRate:
      kpis?.conversion_rate == null
        ? "Não disponível"
        : kpis.conversion_rate + "%",
    totalConversations: kpis?.total_conversations ?? "Não disponível",
    avgResponseMinutes: "Não disponível",
    transfersCount: "Não disponível",
    channels: [
      {
        name: "WhatsApp",
        revenue: kpis?.sales_by_channel?.whatsapp || 0,
        share:
          totalRev > 0
            ? `${Math.round(((kpis?.sales_by_channel?.whatsapp || 0) / totalRev) * 100)}%`
            : "0%",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      {
        name: "Instagram Direct",
        revenue: kpis?.sales_by_channel?.instagram || 0,
        share:
          totalRev > 0
            ? `${Math.round(((kpis?.sales_by_channel?.instagram || 0) / totalRev) * 100)}%`
            : "0%",
        badgeColor: "bg-pink-50 text-pink-700 border-pink-200",
      },
      {
        name: "Messenger",
        revenue: kpis?.sales_by_channel?.messenger || 0,
        share:
          totalRev > 0
            ? `${Math.round(((kpis?.sales_by_channel?.messenger || 0) / totalRev) * 100)}%`
            : "0%",
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      },
    ],
    branches: (kpis?.sales_by_branch || []).map((b) => ({
      name: formatDisplayName(b.branch_name, "Matriz Centro"),
      sales: b.sales_count,
      revenue: b.total_revenue,
      share:
        totalRev > 0
          ? `${Math.round((b.total_revenue / totalRev) * 100)}%`
          : "0%",
    })),
    agents: (kpis?.sales_by_agent || []).map((a) => ({
      name: formatDisplayName(a.agent_name, "Atendente Farmácia"),
      sales: a.sales_count,
      revenue: a.total_revenue,
      conversion: "Não disponível",
    })),
    topProducts: (kpis?.top_products || []).map((p) => ({
      name: p.product_name,
      qty: p.quantity,
      revenue: p.total_revenue,
    })),
    fulfillment: {
      delivery: {
        count: deliveryCount,
        share:
          totalFulfillment > 0
            ? `${Math.round((deliveryCount / totalFulfillment) * 100)}%`
            : "0%",
      },
      pickup: {
        count: pickupCount,
        share:
          totalFulfillment > 0
            ? `${Math.round((pickupCount / totalFulfillment) * 100)}%`
            : "0%",
      },
    },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header com Filtros e Atualização */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Comercial e Operacional
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Vendas confirmadas no Hub, conforme o período e as unidades autorizadas.
            {lastUpdated && (
              <span className="text-slate-700 font-medium ml-2">
                ● Atualizado às {lastUpdated}
              </span>
            )}
          </p>
        </div>

        {/* Barra de Filtros e Botão de Atualizar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs">
            <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-500">
              <Filter className="w-3.5 h-3.5 text-red-600" />
              <span>Filtros:</span>
            </div>

            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="rounded-lg border-0 bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Todo o período</option>
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>

            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="rounded-lg border-0 bg-transparent text-xs font-medium text-slate-700 focus:outline-none border-l border-slate-200 pl-2"
            >
              <option value="all">Todos os Canais</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Messenger</option>
            </select>

            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="rounded-lg border-0 bg-transparent text-xs font-medium text-slate-700 focus:outline-none border-l border-slate-200 pl-2"
            >
              <option value="all">Todas as Filiais</option>
              {kpis?.sales_by_branch.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>
                  {formatDisplayName(b.branch_name, "Unidade")}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-red-600" : ""}`}
            />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid de KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vendas registradas no Hub */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vendas Registradas
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">
              R${" "}
              {metrics.totalRevenue.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Confirmadas por atendentes humanos</span>
            </div>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ticket Médio
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">
              R${" "}
              {metrics.averageTicket.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Média por pedido fechado
            </p>
          </div>
        </div>

        {/* Taxa de Conversão */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Taxa de Conversão
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">
              {metrics.conversionRate}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Conversas elegíveis: {metrics.totalConversations}
            </p>
          </div>
        </div>

        {/* Tempo de Resposta */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tempo 1ª Resposta
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">
              {metrics.avgResponseMinutes}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Transferências: {metrics.transfersCount}
            </p>
          </div>
        </div>
      </div>

      {/* Linha Secundária: Canais & Entrega/Retirada */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Desempenho por Canal */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-red-600" />
            Vendas registradas por canal
          </h3>

          <div className="space-y-4">
            {metrics.channels.map((ch) => (
              <div key={ch.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-700">{ch.name}</span>
                  <span className="font-semibold text-slate-900">
                    R$ {ch.revenue.toFixed(2)} ({ch.share})
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-600 transition-all duration-500"
                    style={{ width: ch.share }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Canal principal de validação: WhatsApp</span>
            <span className="font-semibold text-emerald-700">
              Operação Normal
            </span>
          </div>
        </div>

        {/* Modalidade de Entrega vs Retirada */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-red-600" />
              Modalidade de Atendimento
            </h3>

            <div className="space-y-3 my-auto">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Entrega / Delivery
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {metrics.fulfillment.delivery.count} pedidos
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {metrics.fulfillment.delivery.share}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Retirada no Balcão
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {metrics.fulfillment.pickup.count} pedidos
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {metrics.fulfillment.pickup.share}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-4 text-center">
            Dados coletados diretamente no fechamento dos atendimentos.
          </p>
        </div>
      </div>

      {/* Terceira Linha: Produtos Mais Vendidos e Desempenho da Equipe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Produtos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Top Produtos Mais Vendidos
          </h3>

          <div className="space-y-2.5">
            {metrics.topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Nenhum produto registrado ainda no período.
              </p>
            ) : (
              metrics.topProducts.map((prod, index) => (
                <div
                  key={prod.name}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {prod.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {prod.qty} unidades vendidas
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-red-600">
                    R$ {prod.revenue.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Desempenho da Equipe */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-red-600" />
            Desempenho da Equipe de Atendimento
          </h3>

          <div className="space-y-2.5">
            {metrics.agents.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Nenhum atendente com vendas registradas ainda.
              </p>
            ) : (
              metrics.agents.map((agent) => (
                <div
                  key={agent.name}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                      {agent.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {agent.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {agent.sales} pedidos fechados
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900">
                      R$ {agent.revenue.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Conversão: {agent.conversion}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
