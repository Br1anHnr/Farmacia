"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  Phone,
  Mail,
  Calendar,
  Building2,
  UserCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShoppingBag,
  MessagesSquare,
  X,
  Loader2,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { HubShell } from "@/components/layout/hub-shell";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  channels: string[];
  last_contact: string;
  branch_name: string;
  assigned_agent_name: string;
  status: string;
  conversations_count: number;
}

interface ContactDetail {
  id: string;
  name: string;
  phone: string;
  email: string;
  channels: string[];
  created_at: string;
  updated_at: string;
  conversations: Array<{
    id: string;
    chatwoot_conversation_id: number;
    channel: string;
    status: string;
    branch_name: string;
    agent_name: string;
    created_at: string;
    updated_at: string;
  }>;
  sales: Array<{
    id: string;
    total_amount: number;
    status: string;
    fulfillment_method: string;
    confirmed_at: string;
    branch_name: string;
    agent_name: string;
  }>;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Drawer de detalhes
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactDetail, setContactDetail] = useState<ContactDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"conversations" | "sales">("conversations");

  // Carrega contatos
  async function loadContacts() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) params.set("search", search.trim());
      if (channelFilter !== "all") params.set("channel", channelFilter);

      const res = await fetch(`/api/contacts?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Não foi possível carregar a lista de contatos.");
      }
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Erro de conexão ao buscar contatos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, [page, channelFilter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadContacts();
  }

  // Carrega detalhes do contato selecionado
  async function openContactDrawer(id: string) {
    setSelectedContactId(id);
    setLoadingDetail(true);
    setDrawerTab("conversations");
    try {
      const res = await fetch(`/api/contacts?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setContactDetail(data.contact);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <HubShell
      title="Gestão de Contatos"
      subtitle="Base de clientes, histórico de interações e canais de atendimento"
    >
      <div className="space-y-5">
        {/* Barra de Busca e Filtros */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Campo de Busca */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-20 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-red-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-red-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Buscar
              </button>
            </form>

            {/* Filtros de Canal */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Canal:
              </span>
              {[
                { id: "all", label: "Todos" },
                { id: "whatsapp", label: "WhatsApp" },
                { id: "instagram", label: "Instagram" },
                { id: "facebook", label: "Facebook" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setChannelFilter(c.id);
                    setPage(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    channelFilter === c.id
                      ? "bg-red-600 text-white shadow-xs font-semibold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alerta de Erro */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold">Erro ao carregar contatos</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Tabela de Contatos */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-red-600 mb-3" />
              <p className="text-xs font-medium">Carregando contatos...</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <FolderOpen className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Nenhum contato encontrado</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Não localizamos registros com os critérios informados. Ajuste a busca ou o filtro de canal.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Cliente</th>
                    <th className="py-3.5 px-4">Telefone</th>
                    <th className="py-3.5 px-4">Canais</th>
                    <th className="py-3.5 px-4">Unidade</th>
                    <th className="py-3.5 px-4">Responsável</th>
                    <th className="py-3.5 px-4">Último Contato</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{contact.name}</div>
                        {contact.email && contact.email !== "Não disponível" && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {contact.email}
                          </div>
                        )}
                      </td>

                      {/* Telefone */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {contact.phone}
                      </td>

                      {/* Canais */}
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {contact.channels.map((ch, idx) => (
                            <span
                              key={idx}
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                ch === "instagram"
                                  ? "bg-pink-100 text-pink-700"
                                  : ch === "facebook"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Filial */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {contact.branch_name}
                      </td>

                      {/* Atendente Responsavel */}
                      <td className="py-3 px-4 text-slate-600">
                        {contact.assigned_agent_name}
                      </td>

                      {/* Ultimo Contato */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {contact.last_contact
                          ? new Date(contact.last_contact).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "Não disponível"}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            contact.status === "Em atendimento"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : contact.status === "Encerrado"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {contact.status}
                        </span>
                      </td>

                      {/* Ação */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openContactDrawer(contact.id)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:border-red-600 hover:text-red-700 transition-colors"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {!loading && contacts.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-600">
              <span>
                Mostrando <strong className="text-slate-800">{contacts.length}</strong> de{" "}
                <strong className="text-slate-800">{total}</strong> contatos
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] font-medium text-slate-700">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Lateral de Histórico e Detalhes */}
      {selectedContactId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header Drawer */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Perfil do Cliente</h3>
                <p className="text-[11px] text-slate-500">Histórico completo e dados cadastrais</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedContactId(null);
                  setContactDetail(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteudo Drawer */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {loadingDetail ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-red-600 mb-2" />
                  <p className="text-xs">Carregando perfil...</p>
                </div>
              ) : contactDetail ? (
                <>
                  {/* Cartao Resumo */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <h4 className="font-bold text-slate-900 text-base">{contactDetail.name}</h4>
                    <div className="space-y-1 text-xs text-slate-600">
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{contactDetail.phone}</span>
                      </p>
                      {contactDetail.email && contactDetail.email !== "Não disponível" && (
                        <p className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span>{contactDetail.email}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Abas */}
                  <div className="flex border-b border-slate-200 gap-4">
                    <button
                      type="button"
                      onClick={() => setDrawerTab("conversations")}
                      className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                        drawerTab === "conversations"
                          ? "border-red-600 text-red-700"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Conversas ({contactDetail.conversations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerTab("sales")}
                      className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                        drawerTab === "sales"
                          ? "border-red-600 text-red-700"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Compras ({contactDetail.sales.length})
                    </button>
                  </div>

                  {/* Tab Conversas */}
                  {drawerTab === "conversations" && (
                    <div className="space-y-2.5">
                      {contactDetail.conversations.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">
                          Nenhum atendimento registrado para este cliente.
                        </p>
                      ) : (
                        contactDetail.conversations.map((c) => (
                          <div
                            key={c.id}
                            className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">
                                Atendimento #{c.chatwoot_conversation_id}
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {c.channel}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px]">
                              {c.branch_name} • Resp: {c.agent_name}
                            </p>
                            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                              <span>Status: {c.status}</span>
                              <span>{new Date(c.updated_at).toLocaleDateString("pt-BR")}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tab Compras */}
                  {drawerTab === "sales" && (
                    <div className="space-y-2.5">
                      {contactDetail.sales.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">
                          Nenhuma compra concluída para este cliente.
                        </p>
                      ) : (
                        contactDetail.sales.map((s) => (
                          <div
                            key={s.id}
                            className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-700 text-sm">
                                R$ {s.total_amount.toFixed(2)}
                              </span>
                              <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold border border-emerald-200">
                                {s.status}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px]">
                              {s.fulfillment_method} • {s.branch_name}
                            </p>
                            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                              <span>Atendente: {s.agent_name}</span>
                              <span>{new Date(s.confirmed_at).toLocaleDateString("pt-BR")}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-red-600">Não foi possível carregar os dados.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </HubShell>
  );
}
