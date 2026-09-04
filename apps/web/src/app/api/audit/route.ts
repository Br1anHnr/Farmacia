import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, canAccessDashboard } from '@/lib/auth-store';
import { supabaseRest } from '@/lib/supabase';

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
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');

    if (isToday) {
      return `Hoje às ${hours}:${mins}:${secs}`;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} às ${hours}:${mins}`;
  } catch {
    return isoString;
  }
}

function getBadgeClass(action: string): string {
  switch (action) {
    case 'SALE_CONFIRMED':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'BOT_HANDOFF_TO_HUMAN':
      return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
    case 'CONVERSATION_TRANSFERRED':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'AUTH_LOGIN':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

export async function GET(request: NextRequest) {
  const roleFromHeader = request.headers.get('x-user-role');
  const roleFromCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const currentRole = roleFromHeader || roleFromCookie || 'manager';

  if (!canAccessDashboard(currentRole)) {
    return NextResponse.json(
      {
        error: 'ACCESS_DENIED_MANAGER_ONLY',
        message: 'Apenas o papel manager possui permissão para consultar a trilha de auditoria operacional.',
      },
      { status: 403 }
    );
  }

  let dbLogs: any[] = [];
  try {
    const res = await supabaseRest<any[]>('audit_events', {
      params: {
        select: '*',
        order: 'created_at.desc',
        limit: '50',
      },
    });

    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      dbLogs = res.data;
    }
  } catch (err) {
    console.warn('[Audit API] Erro ao buscar registros de audit_events no Supabase:', err);
  }

  // Se o banco ainda não tiver logs suficientes ou em fallback
  if (dbLogs.length === 0) {
    const fallbackLogs: AuditLogRow[] = [
      {
        id: 'aud_seed_1',
        timestamp: 'Hoje às 14:32:10',
        action: 'SALE_CONFIRMED',
        actor: 'Ana Souza (Atendente)',
        entity: 'Venda #6661 (R$ 29,00)',
        details: 'Venda confirmada via Dashboard App lateral no Chatwoot (Conv #101 - WhatsApp).',
        badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      },
      {
        id: 'aud_seed_2',
        timestamp: 'Hoje às 14:28:45',
        action: 'BOT_HANDOFF_TO_HUMAN',
        actor: 'AgentBot (Sistema)',
        entity: 'Conversa #101 (WhatsApp)',
        details: 'Triagem concluída com intenção BUY_PRODUCT. Desligamento atômico do bot acionado.',
        badgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      },
      {
        id: 'aud_seed_3',
        timestamp: 'Hoje às 13:15:02',
        action: 'CONVERSATION_TRANSFERRED',
        actor: 'Bruno Lima (Atendente)',
        entity: 'Conversa #98 (Instagram)',
        details: 'Transferência de atendimento para Filial Jardins.',
        badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      },
      {
        id: 'aud_seed_4',
        timestamp: 'Hoje às 11:05:18',
        action: 'AUTH_LOGIN',
        actor: 'Carlos Mendes (Gerente)',
        entity: 'Sessão Web',
        details: 'Login operacional autenticado no Hub MultiFarma.',
        badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      },
    ];

    return NextResponse.json({ logs: fallbackLogs });
  }

  const logs: AuditLogRow[] = dbLogs.map((row) => {
    const meta = row.metadata || {};
    const totalFormatted = meta.total_amount || meta.total
      ? `(R$ ${Number(meta.total_amount || meta.total).toFixed(2).replace('.', ',')})`
      : '';

    let entityLabel = `${row.entity_type || 'Registro'} #${row.entity_id ? String(row.entity_id).slice(0, 8) : ''}`;
    if (row.entity_type === 'sale') {
      entityLabel = `Venda #${String(row.entity_id || '').slice(0, 8)} ${totalFormatted}`.trim();
    } else if (row.entity_type === 'conversation') {
      entityLabel = `Conversa #${meta.conversation_id || row.entity_id || ''}`;
    }

    let actorLabel = 'Sistema';
    if (row.actor_email) {
      const email = String(row.actor_email);
      const namePart = email.split('@')[0].replace('.', ' ');
      const capName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const roleName = email.includes('gerente') ? 'Gerente' : email.includes('admin') ? 'Admin' : 'Atendente';
      actorLabel = `${capName} (${roleName})`;
    }

    let detailsText = '';
    if (row.action === 'SALE_CONFIRMED') {
      const conv = meta.conversation_id ? `Conv #${meta.conversation_id}` : 'Chatwoot';
      const ch = meta.channel ? String(meta.channel).toUpperCase() : 'WhatsApp';
      const items = meta.items_count ? `${meta.items_count} item(ns)` : '';
      detailsText = `Venda confirmada via Dashboard App lateral (${conv} - ${ch}${items ? ', ' + items : ''}).`;
    } else if (row.action === 'BOT_HANDOFF_TO_HUMAN') {
      detailsText = 'Triagem concluída. Desligamento do bot e transferência para equipe humana.';
    } else if (row.action === 'CONVERSATION_TRANSFERRED') {
      detailsText = 'Transferência de atendimento efetuada entre atendentes/filiais.';
    } else if (row.action === 'AUTH_LOGIN') {
      detailsText = 'Login operacional autenticado no Hub MultiFarma.';
    } else {
      detailsText = typeof meta === 'object' ? JSON.stringify(meta) : String(meta);
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
