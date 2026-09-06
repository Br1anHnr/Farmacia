import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/server-auth";
import { supabaseRest } from "@/lib/server/supabase";

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const { searchParams } = request.nextUrl;
  const contactId = searchParams.get("id");
  const search = searchParams.get("search")?.trim() || "";
  const channel = searchParams.get("channel") || "all";
  const branchId = searchParams.get("branch") || "all";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  // Carrega mapeamento de perfis para nao exibir UUIDs
  const profilesRes = await supabaseRest<any[]>("profiles", {
    accessToken: auth.context.accessToken,
    params: { select: "id,full_name" },
  });
  const profileMap = new Map<string, string>();
  (profilesRes.data || []).forEach((p) => {
    if (p.id && p.full_name) profileMap.set(p.id, p.full_name);
  });

  // Carrega mapeamento de filiais
  const branchesRes = await supabaseRest<any[]>("branches", {
    accessToken: auth.context.accessToken,
    params: { select: "id,name" },
  });
  const branchMap = new Map<string, string>();
  (branchesRes.data || []).forEach((b) => {
    if (b.id && b.name) branchMap.set(b.id, b.name);
  });

  // Se solicitou detalhes de um contato especifico
  if (contactId) {
    const customerRes = await supabaseRest<any[]>("customers", {
      accessToken: auth.context.accessToken,
      params: {
        id: `eq.${contactId}`,
        organization_id: `eq.${auth.context.organizationId}`,
        select: "id,name,phone,email,created_at,updated_at,customer_channels(channel_type,external_id)",
      },
    });

    if (customerRes.error || !customerRes.data || customerRes.data.length === 0) {
      return NextResponse.json({ error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
    }

    const customer = customerRes.data[0];

    // Busca conversas do contato
    const convsRes = await supabaseRest<any[]>("conversation_links", {
      accessToken: auth.context.accessToken,
      params: {
        customer_id: `eq.${contactId}`,
        organization_id: `eq.${auth.context.organizationId}`,
        select: "id,chatwoot_conversation_id,channel,status,branch_id,assigned_user_id,created_at,updated_at",
        order: "updated_at.desc",
      },
    });

    // Busca vendas do contato
    const salesRes = await supabaseRest<any[]>("sales", {
      accessToken: auth.context.accessToken,
      params: {
        customer_id: `eq.${contactId}`,
        organization_id: `eq.${auth.context.organizationId}`,
        select: "id,total_amount,status,fulfillment_method,confirmed_at,branch_id,agent_id,created_at",
        order: "created_at.desc",
      },
    });

    const conversations = (convsRes.data || []).map((c) => ({
      id: c.id,
      chatwoot_conversation_id: c.chatwoot_conversation_id,
      channel: c.channel || "whatsapp",
      status: c.status === "open" ? "Em aberto" : c.status === "closed" ? "Encerrado" : c.status,
      branch_name: branchMap.get(c.branch_id) || "Não disponível",
      agent_name: profileMap.get(c.assigned_user_id) || "Não atribuído",
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    const sales = (salesRes.data || []).map((s) => ({
      id: s.id,
      total_amount: parseFloat(s.total_amount) || 0,
      status: s.status === "confirmed" ? "Concluída" : s.status === "cancelled" ? "Cancelada" : "Rascunho",
      fulfillment_method: s.fulfillment_method === "delivery" ? "Entrega" : "Retirada",
      confirmed_at: s.confirmed_at || s.created_at,
      branch_name: branchMap.get(s.branch_id) || "Não disponível",
      agent_name: profileMap.get(s.agent_id) || "Não atribuído",
    }));

    return NextResponse.json({
      contact: {
        id: customer.id,
        name: customer.name || "Não disponível",
        phone: customer.phone || "Não disponível",
        email: customer.email || "Não disponível",
        channels: (customer.customer_channels || []).map((ch: any) => ch.channel_type),
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        conversations,
        sales,
      },
    });
  }

  // Listagem com filtros
  const customerParams: Record<string, string> = {
    organization_id: `eq.${auth.context.organizationId}`,
    select: "id,name,phone,email,created_at,updated_at,customer_channels(channel_type,external_id),conversation_links(id,chatwoot_conversation_id,channel,status,branch_id,assigned_user_id,updated_at)",
    order: "updated_at.desc",
    limit: String(limit),
    offset: String(offset),
  };

  if (search) {
    const sanitizedSearch = search.replace(/[%*]/g, "");
    customerParams.or = `(name.ilike.*${sanitizedSearch}*,phone.ilike.*${sanitizedSearch}*)`;
  }

  const customersRes = await supabaseRest<any[]>("customers", {
    accessToken: auth.context.accessToken,
    headers: { Prefer: "count=exact" },
    params: customerParams,
  });

  if (customersRes.error || !Array.isArray(customersRes.data)) {
    return NextResponse.json({ error: "CONTACTS_UNAVAILABLE" }, { status: 503 });
  }

  let contacts = customersRes.data.map((c) => {
    const convs = Array.isArray(c.conversation_links) ? c.conversation_links : [];
    const latestConv = convs.sort(
      (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0];

    const channelsSet = new Set<string>();
    (c.customer_channels || []).forEach((ch: any) => {
      if (ch.channel_type) channelsSet.add(ch.channel_type);
    });
    convs.forEach((cv: any) => {
      if (cv.channel) channelsSet.add(cv.channel);
    });

    const branchName = latestConv?.branch_id ? branchMap.get(latestConv.branch_id) || "Não disponível" : "Não disponível";
    const agentName = latestConv?.assigned_user_id ? profileMap.get(latestConv.assigned_user_id) || "Não atribuído" : "Não atribuído";
    const status = latestConv
      ? latestConv.status === "open"
        ? "Em atendimento"
        : "Encerrado"
      : "Cadastrado";

    return {
      id: c.id,
      name: c.name || "Não disponível",
      phone: c.phone || "Não disponível",
      email: c.email || "Não disponível",
      channels: Array.from(channelsSet).length > 0 ? Array.from(channelsSet) : ["whatsapp"],
      last_contact: latestConv?.updated_at || c.updated_at || c.created_at,
      branch_id: latestConv?.branch_id || null,
      branch_name: branchName,
      assigned_agent_id: latestConv?.assigned_user_id || null,
      assigned_agent_name: agentName,
      status,
      conversations_count: convs.length,
    };
  });

  // Filtragem pós-query se canal ou filial especificados
  if (channel !== "all") {
    contacts = contacts.filter((c) => c.channels.includes(channel));
  }
  if (branchId !== "all") {
    contacts = contacts.filter((c) => c.branch_id === branchId);
  }

  return NextResponse.json({
    contacts,
    total: customersRes.totalCount ?? contacts.length,
    page,
    limit,
  });
}
