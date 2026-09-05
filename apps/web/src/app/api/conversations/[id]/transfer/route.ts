import { NextRequest, NextResponse } from "next/server";
import { conversationAccess } from "@/lib/conversation-access";
import { supabaseRest } from "@/lib/supabase";
import { uuid } from "@/lib/server-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
  if ("response" in auth) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const { target_user_id, target_branch_id, note } = body;
  if (!target_user_id || !uuid.test(target_user_id)) {
    return NextResponse.json(
      { error: "INVALID_TARGET_USER", message: "Colaborador de destino inválido." },
      { status: 400 },
    );
  }

  // 1. Busca mapeamento Chatwoot do agente destino
  const agentMapRes = await supabaseRest<any[]>("chatwoot_agents", {
    accessToken: auth.context.accessToken,
    params: {
      user_id: `eq.${target_user_id}`,
      organization_id: `eq.${auth.context.organizationId}`,
    },
  });

  const targetAgentId = agentMapRes.data?.[0]?.agent_id || null;

  // 2. Atualiza atribuicao na tabela conversation_links
  const updatePayload: Record<string, any> = {
    assigned_user_id: target_user_id,
    updated_at: new Date().toISOString(),
  };
  if (targetAgentId) {
    updatePayload.chatwoot_assignee_id = targetAgentId;
  }
  if (target_branch_id && uuid.test(target_branch_id)) {
    updatePayload.branch_id = target_branch_id;
  }

  const adminToken = process.env.SUPABASE_SECRET_KEY || auth.context.accessToken;

  const updateRes = await supabaseRest<any[]>("conversation_links", {
    accessToken: adminToken,
    method: "PATCH",
    params: {
      id: `eq.${auth.conversation.id}`,
    },
    body: updatePayload,
  });

  if (updateRes.error) {
    return NextResponse.json(
      { error: "TRANSFER_PERSISTENCE_FAILED", message: "Falha ao salvar transferência no banco." },
      { status: 503 },
    );
  }

  // 3. Sincroniza atribuicao no Chatwoot se servico disponivel
  const cwUrl = process.env.CHATWOOT_BASE_URL;
  const cwToken = process.env.CHATWOOT_API_TOKEN;
  const cwAccount = auth.conversation.chatwoot_account_id || Number(process.env.CHATWOOT_ACCOUNT_ID) || 1;

  if (cwUrl && cwToken && targetAgentId) {
    try {
      await fetch(
        `${cwUrl}/api/v1/accounts/${cwAccount}/conversations/${params.id}/assignments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            api_access_token: cwToken,
          },
          body: JSON.stringify({ assignee_id: targetAgentId }),
          signal: AbortSignal.timeout(6000),
        },
      );

      // Se houver nota interna de transferencia, grava como nota privada no Chatwoot
      if (typeof note === "string" && note.trim()) {
        await fetch(
          `${cwUrl}/api/v1/accounts/${cwAccount}/conversations/${params.id}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              api_access_token: cwToken,
            },
            body: JSON.stringify({
              content: `[Transferência de Atendimento]: ${note.trim()}`,
              private: true,
            }),
            signal: AbortSignal.timeout(6000),
          },
        );
      }
    } catch {
      // Nao falha a transferencia se a API externa do Chatwoot estiver temporariamente inacessivel
    }
  }

  // 4. Registra trilha de auditoria
  await supabaseRest("audit_events", {
    accessToken: adminToken,
    method: "POST",
    body: {
      organization_id: auth.context.organizationId,
      branch_id: auth.conversation.branch_id || auth.context.branchIds[0],
      actor_id: auth.context.userId,
      action: "CONVERSATION_TRANSFERRED",
      entity_type: "conversation",
      entity_id: params.id,
      metadata: {
        from_user_id: auth.context.userId,
        to_user_id: target_user_id,
        target_branch_id: target_branch_id || auth.conversation.branch_id,
        note: note ? String(note).trim() : null,
      },
    },
  });

  return NextResponse.json({
    success: true,
    transferred_to: target_user_id,
    branch_id: target_branch_id || auth.conversation.branch_id,
  });
}
