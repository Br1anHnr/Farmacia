import { NextResponse, type NextRequest } from "next/server";
import { authorize } from "@/lib/server-auth";
import { supabaseRest } from "@/lib/supabase";

export interface AuditLogRow {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  entity: string;
  details: string;
  badgeClass: string;
}

function formatRelativeTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const secs = String(d.getSeconds()).padStart(2, "0");

    if (isToday) {
      return `Hoje às ${hours}:${mins}:${secs}`;
    }
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month} às ${hours}:${mins}`;
  } catch {
    return isoString;
  }
}

function getBadgeClass(action: string): string {
  switch (action) {
    case "SALE_CONFIRMED":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "BOT_HANDOFF_TO_HUMAN":
      return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    case "CONVERSATION_TRANSFERRED":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "AUTH_LOGIN":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request, true);
  if ("response" in auth) return auth.response;
  // Legacy audit rows have no reliable branch attribution. Until that is migrated,
  // only a manager explicitly linked to every organization branch can read them.
  const branches = await supabaseRest<any[]>("branches", {
    accessToken: auth.context.accessToken,
    headers: { Prefer: "return=representation,count=exact" },
    params: {
      organization_id: "eq." + auth.context.organizationId,
      select: "id",
    },
  });
  if (
    branches.error ||
    !branches.data ||
    branches.totalCount !== branches.data.length
  )
    return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503 });
  if (
    !branches.data.length ||
    branches.data.some((b) => !auth.context.branchIds.includes(b.id))
  )
    return NextResponse.json(
      { error: "AUDIT_BRANCH_SCOPE_REQUIRED" },
      { status: 403 },
    );
  const res = await supabaseRest<any[]>("audit_events", {
    accessToken: auth.context.accessToken,
    params: {
      organization_id: "eq." + auth.context.organizationId,
      select: "*",
      order: "created_at.desc",
      limit: "50",
    },
  });
  if (res.error || !Array.isArray(res.data))
    return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503 });
  const dbLogs = res.data;
  const logs: AuditLogRow[] = dbLogs.map((row) => {
    const meta = row.metadata || {};
    const totalFormatted =
      meta.total_amount || meta.total
        ? `(R$ ${Number(meta.total_amount || meta.total)
            .toFixed(2)
            .replace(".", ",")})`
        : "";

    let entityLabel = `${row.entity_type || "Registro"} #${row.entity_id ? String(row.entity_id).slice(0, 8) : ""}`;
    if (row.entity_type === "sale") {
      entityLabel =
        `Venda #${String(row.entity_id || "").slice(0, 8)} ${totalFormatted}`.trim();
    } else if (row.entity_type === "conversation") {
      entityLabel = `Conversa #${meta.conversation_id || row.entity_id || ""}`;
    }

    let actorLabel = "Sistema";
    if (row.actor_email) {
      const email = String(row.actor_email);
      const namePart = email.split("@")[0].replace(".", " ");
      const capName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      actorLabel = capName;
    }

    let detailsText = "";
    if (row.action === "SALE_CONFIRMED") {
      const conv = meta.conversation_id
        ? `Conv #${meta.conversation_id}`
        : "Chatwoot";
      const ch = meta.channel ? String(meta.channel).toUpperCase() : "WhatsApp";
      const items = meta.items_count ? `${meta.items_count} item(ns)` : "";
      detailsText = `Venda confirmada via Dashboard App lateral (${conv} - ${ch}${items ? ", " + items : ""}).`;
    } else if (row.action === "BOT_HANDOFF_TO_HUMAN") {
      detailsText =
        "Triagem concluída. Desligamento do bot e transferência para equipe humana.";
    } else if (row.action === "CONVERSATION_TRANSFERRED") {
      detailsText =
        "Transferência de atendimento efetuada entre atendentes/filiais.";
    } else if (row.action === "AUTH_LOGIN") {
      detailsText = "Login operacional autenticado no Hub MultiFarma.";
    } else {
      detailsText =
        typeof meta === "object" ? JSON.stringify(meta) : String(meta);
    }

    return {
      id: row.id || `aud_${Math.random()}`,
      timestamp: formatRelativeTimestamp(row.created_at),
      action: row.action,
      actor: actorLabel,
      entity: entityLabel,
      details: detailsText,
      badgeClass: getBadgeClass(row.action),
    };
  });

  return NextResponse.json({ logs });
}
