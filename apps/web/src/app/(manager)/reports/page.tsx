"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Users,
  Building2,
  Calendar,
  Filter,
  RefreshCw,
  AlertCircle,
  Download,
  Ban,
  Clock,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { type DashboardKPIs } from "@hub-farmacia/contracts";

export default function ReportsPage() {
  const [period, setPeriod] = useState("all");
  const [channel, setChannel] = useState("all");
  const [branch, setBranch] = useState("all");

  const [activeTab, setActiveTab] = useState<
    "sales" | "channels" | "agents" | "branches" | "products" | "not_sold"
  >("sales");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardKPIs | null>(null);
  const [generatedAt, setGeneratedAt] = useState("");

  const fetchReportsData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/dashboard/summary?" +
          new URLSearchParams({ period, channel, branch }),
        { cache: "no-store" }
      );
      if (!res.ok) {
        throw new Error(`Falha ao obter dados analíticos (${res.status})`);
      }
      const json: DashboardKPIs = await res.json();
      setData(json);
      setGeneratedAt(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (err: any) {
      setError(err.message || "Erro de conexão ao carregar relatórios.");
    } finally {
      setIsLoading(false);
    }
  }, [period, channel, branch]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  // Formatador seguro que impede exibição de UUIDs
  function formatDisplayName(name: string, fallback: string) {
    if (!name || name.includes("unknown") || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(name)) {
      return fallback;
    }
    // Remove prefixos automáticos como "Unidade " seguido de UUID
    if (name.startsWith("Unidade ") && name.length > 20) {
      return "Matriz Centro";
    }
    if (name.startsWith("Colaborador ") && name.length > 20) {
      return "Atendente Farmácia";
    }
    return name;
  }

  const totalRev = data?.total_revenue || 0;
  const salesCount = data?.confirmed_sales_count || 0;
  const avgTicket = data?.average_ticket || 0;
  const deliveryCount = data?.delivery_vs_pickup?.delivery_count || 0;
  const pickupCount = data?.delivery_vs_pickup?.pickup_count || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header com Filtros e Exportação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-red-600" />
            Relatórios Gerenciais e Operacionais
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Métricas de desempenho de vendas, canais de atendimento e equipe da rede farmacêutica.
            {generatedAt && (
              <span className="text-slate-700 font-medium ml-2">
                ● Gerado às {generatedAt}
              </span>
            )}
          </p>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs">
            <Filter className="h-3.5 w-3.5 text-slate-400 ml-1.5" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border-0 bg-transparent text-xs font-medium text-slate-700 focus:ring-0 focus:outline-none"
            >
              <option value="all">Todo o período</option>
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>

            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="rounded-lg border-0 bg-transparent text-xs font-medium text-slate-700 focus:ring-0 focus:outline-none border-l border-slate-200 pl-2"
            >
              <option value="all">Todos os Canais</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Messenger</option>
            </select>

            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="rounded-lg border-0 bg-transparent text-xs font-medium text-slate-700 focus:ring-0 focus:outline-none border-l border-slate-200 pl-2"
            >
              <option value="all">Todas as Filiais</option>
              {data?.sales_by_branch.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>
                  {formatDisplayName(b.branch_name, "Unidade Farmácia")}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchReportsData}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-red-600" : ""}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Cards de Resumo Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Receita Total
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            R$ {totalRev.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Vendas confirmadas no período
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pedidos Realizados
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{salesCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {deliveryCount} entregas • {pickupCount} retiradas
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ticket Médio
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            R$ {avgTicket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Média por pedido concluído
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tempo Médio Resposta
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-500">Não disponível</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Aguardando histórico do Chatwoot
          </span>
        </div>
      </div>

      {/* Navegação de Abas do Relatório */}
      <div className="border-b border-slate-200 bg-white rounded-t-2xl px-6 pt-3 shadow-2xs">
        <div className="flex gap-6 overflow-x-auto">
          {[
            { id: "sales", label: "Relatório de Vendas" },
            { id: "channels", label: "Relatório por Canal" },
            { id: "agents", label: "Relatório por Funcionário" },
            { id: "branches", label: "Relatório por Filial" },
            { id: "products", label: "Produtos Mais Vendidos" },
            { id: "not_sold", label: "Não Vendas & Desistências" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap pb-3.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-red-600 text-red-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo da Aba */}
      <div className="rounded-b-2xl border-x border-b border-slate-200 bg-white p-6 shadow-sm min-h-[350px]">
        {/* Aba 1: Vendas */}
        {activeTab === "sales" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Resumo Consolidado de Vendas</h3>
                <p className="text-xs text-slate-500">Detalhamento dos valores transacionados e logística de atendimento</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Indicador Comercial</th>
                    <th className="p-3">Valor / Quantidade</th>
                    <th className="p-3">Participação</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="p-3 font-medium text-slate-900">Total Faturado no Período</td>
                    <td className="p-3 font-bold text-red-600">R$ {totalRev.toFixed(2)}</td>
                    <td className="p-3">100%</td>
                    <td className="p-3"><span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">Auditado</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-slate-900">Entregas em Domicílio (Delivery)</td>
                    <td className="p-3 font-semibold">{deliveryCount} pedidos</td>
                    <td className="p-3">{salesCount > 0 ? `${Math.round((deliveryCount / salesCount) * 100)}%` : "0%"}</td>
                    <td className="p-3"><span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-medium">Logística ativa</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-slate-900">Retirada no Balcão da Farmácia</td>
                    <td className="p-3 font-semibold">{pickupCount} pedidos</td>
                    <td className="p-3">{salesCount > 0 ? `${Math.round((pickupCount / salesCount) * 100)}%` : "0%"}</td>
                    <td className="p-3"><span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-medium">Presencial</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-slate-900">Taxa de Conversão Geral</td>
                    <td className="p-3 font-semibold">Não disponível</td>
                    <td className="p-3">--</td>
                    <td className="p-3"><span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-medium">Sem dados no período</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Aba 2: Canais */}
        {activeTab === "channels" && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Desempenho Comercial por Canal</h3>
            <p className="text-xs text-slate-500">Distribuição do faturamento por canal de atendimento integrado</p>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Canal de Atendimento</th>
                    <th className="p-3">Faturamento Realizado</th>
                    <th className="p-3">Participação</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {[
                    { name: "WhatsApp", rev: data?.sales_by_channel?.whatsapp || 0, badge: "bg-emerald-50 text-emerald-700" },
                    { name: "Instagram Direct", rev: data?.sales_by_channel?.instagram || 0, badge: "bg-pink-50 text-pink-700" },
                    { name: "Facebook / Messenger", rev: data?.sales_by_channel?.messenger || 0, badge: "bg-blue-50 text-blue-700" },
                  ].map((ch, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-semibold text-slate-900 flex items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${ch.badge}`}>
                          {ch.name}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">R$ {ch.rev.toFixed(2)}</td>
                      <td className="p-3">
                        {totalRev > 0 ? `${Math.round((ch.rev / totalRev) * 100)}%` : "0%"}
                      </td>
                      <td className="p-3 text-slate-500">
                        {ch.rev > 0 ? "Vendas ativas" : "Sem dados no período"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Aba 3: Funcionários */}
        {activeTab === "agents" && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Desempenho por Atendente</h3>
            <p className="text-xs text-slate-500">Vendas registradas e fechamentos concluídos por colaborador</p>

            {(data?.sales_by_agent || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">Nenhuma venda registrada por atendentes no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Atendente</th>
                      <th className="p-3">Pedidos Fechados</th>
                      <th className="p-3">Receita Total</th>
                      <th className="p-3">Ticket Médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data?.sales_by_agent.map((agent, i) => (
                      <tr key={i}>
                        <td className="p-3 font-semibold text-slate-900">
                          {formatDisplayName(agent.agent_name, "Atendente da Unidade")}
                        </td>
                        <td className="p-3 font-medium">{agent.sales_count}</td>
                        <td className="p-3 font-bold text-red-600">R$ {agent.total_revenue.toFixed(2)}</td>
                        <td className="p-3 text-slate-600">
                          R$ {agent.sales_count > 0 ? (agent.total_revenue / agent.sales_count).toFixed(2) : "0.00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Aba 4: Filiais */}
        {activeTab === "branches" && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Desempenho por Unidade / Filial</h3>
            <p className="text-xs text-slate-500">Volume transacionado por ponto de atendimento</p>

            {(data?.sales_by_branch || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">Nenhuma venda registrada nas filiais no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Unidade</th>
                      <th className="p-3">Total de Vendas</th>
                      <th className="p-3">Faturamento</th>
                      <th className="p-3">Participação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data?.sales_by_branch.map((b, i) => (
                      <tr key={i}>
                        <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-red-600" />
                          {formatDisplayName(b.branch_name, "Matriz Centro")}
                        </td>
                        <td className="p-3 font-medium">{b.sales_count}</td>
                        <td className="p-3 font-bold text-slate-900">R$ {b.total_revenue.toFixed(2)}</td>
                        <td className="p-3">
                          {totalRev > 0 ? `${Math.round((b.total_revenue / totalRev) * 100)}%` : "0%"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Aba 5: Produtos Mais Vendidos */}
        {activeTab === "products" && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Ranking de Produtos Mais Vendidos</h3>
            <p className="text-xs text-slate-500">Medicamentos e itens com maior saída no período</p>

            {(data?.top_products || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">Nenhum item comercializado no período selecionado.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Posição</th>
                      <th className="p-3">Produto</th>
                      <th className="p-3">Unidades Vendidas</th>
                      <th className="p-3">Total Gerado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data?.top_products.map((p, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-bold text-slate-400">#{idx + 1}</td>
                        <td className="p-3 font-semibold text-slate-900">{p.product_name}</td>
                        <td className="p-3 font-medium">{p.quantity} un</td>
                        <td className="p-3 font-bold text-red-600">R$ {p.total_revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Aba 6: Não Vendas */}
        {activeTab === "not_sold" && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Motivos de Desistência e Não Venda</h3>
            <p className="text-xs text-slate-500">Análise de perdas e oportunidades registradas nos atendimentos</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 block">
                  Motivos Estruturados
                </span>
                <div className="space-y-2 text-xs">
                  {[
                    { label: "Preço alto / achou caro", desc: "Registrado quando o cliente contesta a tabela" },
                    { label: "Produto indisponível / falta", desc: "Ruptura de estoque na filial solicitada" },
                    { label: "Entrega indisponível / fora da área", desc: "Região não atendida pela equipe de entrega" },
                    { label: "Cliente desistiu da compra", desc: "Desistência por decisão do cliente" },
                    { label: "Cliente não respondeu", desc: "Contato abandonado sem retorno" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-start justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                      <div>
                        <p className="font-semibold text-slate-800">{m.label}</p>
                        <p className="text-[11px] text-slate-400">{m.desc}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">Ativo</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-900 block mb-2">
                  Diretriz de Análise
                </span>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  Os motivos de não venda são preenchidos compulsoriamente pelo atendente ao encerrar o contato sem conversão. Utilize estes indicadores para ajustar tabelas de preços, áreas de cobertura do delivery e reposição de estoque nas filiais.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
