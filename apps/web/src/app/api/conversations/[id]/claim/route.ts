import { NextResponse, type NextRequest } from 'next/server';
import { supabaseRest } from '@/lib/supabase';

const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL || 'https://chatwoot.projectvalemind.com';
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN || 'ZJ8tc1X45yjCtFygYaUpky4C';
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || '1';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const conversationId = parseInt(params.id, 10);
  if (!conversationId) {
    return NextResponse.json({ error: 'INVALID_CONVERSATION_ID' }, { status: 400 });
  }

  try {
    // 1. Consulta etiquetas da conversa no Chatwoot
    const res = await fetch(
      `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/labels`,
      {
        headers: { api_access_token: CHATWOOT_API_TOKEN },
        cache: 'no-store',
      }
    );

    let labels: string[] = [];
    if (res.ok) {
      const data = await res.json();
      labels = data?.payload || [];
    }

    const claimedLabel = labels.find((l) => l.startsWith('atendido-por:'));
    const branchLabel = labels.find((l) => l.startsWith('unidade:'));

    if (claimedLabel) {
      const agentRaw = claimedLabel.replace('atendido-por:', '').replace(/-/g, ' ');
      const branchRaw = branchLabel ? branchLabel.replace('unidade:', '').replace(/-/g, ' ') : 'Matriz Centro';

      return NextResponse.json({
        is_claimed: true,
        claimed_by: agentRaw.charAt(0).toUpperCase() + agentRaw.slice(1),
        branch: branchRaw.charAt(0).toUpperCase() + branchRaw.slice(1),
        labels,
      });
    }

    return NextResponse.json({
      is_claimed: false,
      labels,
    });
  } catch (err: any) {
    return NextResponse.json({ is_claimed: false, error: err.message });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const conversationId = parseInt(params.id, 10);
  if (!conversationId) {
    return NextResponse.json({ error: 'INVALID_CONVERSATION_ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const agentName = body.agent_name || 'Ana Souza';
    const branchName = body.branch_name || 'Unidade Guaratinguetá';

    const cleanAgentSlug = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanBranchSlug = branchName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // 1. Busca etiquetas existentes para não sobrescrever
    let existingLabels: string[] = [];
    try {
      const getLabelsRes = await fetch(
        `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/labels`,
        {
          headers: { api_access_token: CHATWOOT_API_TOKEN },
          cache: 'no-store',
        }
      );
      if (getLabelsRes.ok) {
        const data = await getLabelsRes.json();
        existingLabels = (data?.payload || []).filter(
          (l: string) => !l.startsWith('atendido-por:') && !l.startsWith('unidade:') && l !== 'triagem-bot'
        );
      }
    } catch {
      // continua com array limpo
    }

    const newLabels = Array.from(
      new Set([
        ...existingLabels,
        'em-atendimento',
        `atendido-por:${cleanAgentSlug}`,
        `unidade:${cleanBranchSlug}`,
      ])
    );

    // 2. Aplica as novas etiquetas no Chatwoot
    const labelRes = await fetch(
      `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/labels`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          api_access_token: CHATWOOT_API_TOKEN,
        },
        body: JSON.stringify({ labels: newLabels }),
      }
    );

    if (!labelRes.ok) {
      console.warn('[Claim Conversation] Aviso ao aplicar labels no Chatwoot:', labelRes.status);
    }

    // 3. Registrar evento de auditoria no Supabase
    await supabaseRest('audit_events', {
      method: 'POST',
      body: {
        organization_id: '11111111-1111-1111-1111-111111111111',
        actor_email: `${cleanAgentSlug}@multifarma.com`,
        action: 'AGENT_CLAIMED_CONVERSATION',
        entity_type: 'conversation',
        entity_id: String(conversationId),
        metadata: {
          conversation_id: conversationId,
          agent_name: agentName,
          branch_name: branchName,
          claimed_at: new Date().toISOString(),
        },
      },
    });

    console.log(`[Claim Conversation] Atendimento da conv #${conversationId} assumido por ${agentName} (${branchName})`);

    return NextResponse.json({
      success: true,
      is_claimed: true,
      claimed_by: agentName,
      branch: branchName,
      claimed_at: new Date().toISOString(),
      labels: newLabels,
    });
  } catch (err: any) {
    console.error('[Claim API] Erro ao assumir atendimento:', err);
    return NextResponse.json(
      { error: 'FAILED_TO_CLAIM', message: err.message },
      { status: 500 }
    );
  }
}
