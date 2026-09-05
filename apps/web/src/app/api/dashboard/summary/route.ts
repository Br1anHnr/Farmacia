import { NextResponse, type NextRequest } from "next/server";
import { authorize } from "@/lib/server-auth";
import { type DashboardKPIs } from "@hub-farmacia/contracts";
import { supabaseRest } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const auth = await authorize(request, true);
  if ("response" in auth) return auth.response;
  const { organizationId, branchIds } = auth.context;
  const search = request.nextUrl.searchParams;
  const period = search.get("period") || "all";
  const channel = search.get("channel") || "all";
  const branch = search.get("branch") || "all";
  if (
    !["all", "today", "7d", "30d"].includes(period) ||
    !["all", "whatsapp", "instagram", "facebook", "messenger"].includes(channel)
  )
    return NextResponse.json({ error: "INVALID_FILTER" }, { status: 400 });
  if (branch !== "all" && !branchIds.includes(branch))
    return NextResponse.json(
      { error: "BRANCH_ACCESS_DENIED" },
      { status: 403 },
    );
  const filters: Record<string, string> = {};
  if (channel !== "all")
    filters.channel =
      channel === "facebook" || channel === "messenger"
        ? "in.(facebook,messenger)"
        : "eq." + channel;
  if (period !== "all") {
    const now = new Date();
    const start =
      period === "today"
        ? new Date(
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Sao_Paulo",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(now) + "T00:00:00-03:00",
          )
        : new Date(now.getTime() - (period === "7d" ? 7 : 30) * 86400000);
    filters.confirmed_at = "gte." + start.toISOString();
  }
  const res = await supabaseRest<any[]>("sales", {
    accessToken: auth.context.accessToken,
    headers: { Prefer: "return=representation,count=exact" },
    params: {
      organization_id: "eq." + organizationId,
      branch_id:
        branch === "all" ? "in.(" + branchIds.join(",") + ")" : "eq." + branch,
      ...filters,
      status: "eq.confirmed",
      select:
        "id,total_amount,status,channel,branch_id,agent_id,fulfillment_method,confirmed_at,sale_items(product_name_snapshot,quantity,total_item_price)",
      order: "confirmed_at.desc",
    },
  });
  if (res.error || !Array.isArray(res.data))
    return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503 });
  // Avoid silently reporting truncated PostgREST aggregates as complete totals.
  if (res.totalCount === undefined || res.totalCount !== res.data.length)
    return NextResponse.json(
      { error: "AGGREGATION_REQUIRED" },
      { status: 503 },
    );
  const sales = res.data;
  const confirmedSalesCount = sales.length;
  const totalRevenue = sales.reduce(
    (acc, s) => acc + (parseFloat(s.total_amount) || 0),
    0,
  );
  const averageTicket =
    confirmedSalesCount > 0 ? totalRevenue / confirmedSalesCount : 0;
  const totalConversations = null;
  const conversionRate = null;

  const salesByChannel: Record<string, number> = {
    whatsapp: 0,
    instagram: 0,
    messenger: 0,
  };

  const branchMap: Record<
    string,
    { total: number; count: number; name: string }
  > = {};

  const agentMap: Record<
    string,
    { total: number; count: number; name: string }
  > = {};

  const productMap: Record<string, { qty: number; revenue: number }> = {};
  let deliveryCount = 0;
  let pickupCount = 0;

  sales.forEach((s) => {
    const val = parseFloat(s.total_amount) || 0;
    const ch = (s.channel || "").toLowerCase();
    if (ch.includes("whats")) salesByChannel.whatsapp += val;
    else if (ch.includes("insta")) salesByChannel.instagram += val;
    else if (ch === "messenger" || ch === "facebook")
      salesByChannel.messenger += val;

    const bId = s.branch_id || "unknown";
    if (!branchMap[bId]) {
      branchMap[bId] = { total: 0, count: 0, name: "Unidade " + bId };
    }
    branchMap[bId].total += val;
    branchMap[bId].count += 1;

    const aId = s.agent_id || "unknown";
    if (!agentMap[aId]) {
      agentMap[aId] = { total: 0, count: 0, name: "Colaborador " + aId };
    }
    agentMap[aId].total += val;
    agentMap[aId].count += 1;

    if (s.fulfillment_method === "pickup") {
      pickupCount += 1;
    } else if (s.fulfillment_method === "delivery") {
      deliveryCount += 1;
    }

    if (Array.isArray(s.sale_items)) {
      s.sale_items.forEach((item: any) => {
        const pName = item.product_name_snapshot || "Medicamento";
        const pQty = parseFloat(item.quantity) || 1;
        const pPrice = parseFloat(item.total_item_price) || 0;
        if (!productMap[pName]) {
          productMap[pName] = { qty: 0, revenue: 0 };
        }
        productMap[pName].qty += pQty;
        productMap[pName].revenue += pPrice;
      });
    }
  });

  const topProducts = Object.entries(productMap)
    .map(([name, stat]) => ({
      product_name: name,
      quantity: stat.qty,
      total_revenue: stat.revenue,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 5);

  const kpis: DashboardKPIs = {
    total_revenue: Math.round(totalRevenue * 100) / 100,
    confirmed_sales_count: confirmedSalesCount,
    average_ticket: Math.round(averageTicket * 100) / 100,
    conversion_rate: conversionRate,
    total_conversations: totalConversations,
    sales_by_channel: {
      whatsapp: Math.round(salesByChannel.whatsapp * 100) / 100,
      instagram: Math.round(salesByChannel.instagram * 100) / 100,
      messenger: Math.round(salesByChannel.messenger * 100) / 100,
    },
    sales_by_branch: Object.entries(branchMap).map(([id, b]) => ({
      branch_id: id,
      branch_name: b.name,
      total_revenue: Math.round(b.total * 100) / 100,
      sales_count: b.count,
    })),
    sales_by_agent: Object.entries(agentMap).map(([id, a]) => ({
      agent_id: id,
      agent_name: a.name,
      total_revenue: Math.round(a.total * 100) / 100,
      sales_count: a.count,
    })),
    top_products: topProducts,
    delivery_vs_pickup: {
      delivery_count: deliveryCount,
      pickup_count: pickupCount,
    },
  };

  return NextResponse.json(kpis, { status: 200 });
}
