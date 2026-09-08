import { NextRequest, NextResponse } from "next/server";
import { conversationAccess } from "@/lib/conversation-access";
import { supabaseAdminRest, supabaseRest } from "@/lib/server/supabase";
import { uuid } from "@/lib/server-auth";
import { requireIndividualAssignment } from "@/lib/server/shared-operator";
import {
  assignChatwootConversation,
  responsibilityLabels,
  chatwootAssigneeId,
  chatwootErrorResponse,
  createChatwootPrivateNote,
  getChatwootConversation,
  getChatwootConversationLabels,
  listChatwootInboxAgents,
  replaceChatwootConversationLabels,
  setChatwootConversationAssignee,
} from "@/lib/server/chatwoot";

async function restoreChatwootState(input: {
  accountId: number;
  conversationId: number;
  assigneeId: number | null;
  labels: string[];
}) {
  try {
    await setChatwootConversationAssignee(
      input.accountId,
      input.conversationId,
      input.assigneeId,
    );
    await replaceChatwootConversationLabels(
      input.accountId,
      input.conversationId,
      input.labels,
    );
    return true;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
  if ("response" in auth) return auth.response;

  let body: any;
  let previousChatwootState: { assigneeId: number | null; labels: string[] } | null = null;
  let chatwootMutationStarted = false;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const { target_user_id: targetUserId, target_branch_id: targetBranchId, note } = body;
  if (!uuid.test(targetUserId || "")) {
    return NextResponse.json({ error: "INVALID_TARGET_USER" }, { status: 400 });
  }
  if (!uuid.test(targetBranchId || "")) {
    return NextResponse.json({ error: "INVALID_TARGET_BRANCH" }, { status: 400 });
  }

  const [mappingRes, membershipRes, profileRes] = await Promise.all([
    supabaseAdminRest<any[]>("chatwoot_agents", {
      params: {
        organization_id: `eq.${auth.context.organizationId}`,
        account_id: `eq.${auth.accountId}`,
        user_id: `eq.${targetUserId}`,
        active: "eq.true",
        select: "agent_id",
      },
    }),
    supabaseAdminRest<any[]>("branch_members", {
      params: {
        user_id: `eq.${targetUserId}`,
        branch_id: `eq.${targetBranchId}`,
        select: "branch_id,branches!inner(name,organization_id,active)",
        "branches.organization_id": `eq.${auth.context.organizationId}`,
        "branches.active": "eq.true",
      },
    }),
    supabaseAdminRest<any[]>("profiles", {
      params: { id: `eq.${targetUserId}`, select: "full_name" },
    }),
  ]);
  if (mappingRes.error || membershipRes.error || profileRes.error) {
    return NextResponse.json({ error: "TRANSFER_DATA_UNAVAILABLE" }, { status: 503 });
  }
  try { await requireIndividualAssignment(auth.context, auth.accountId); }
  catch (error) {
    const failure = chatwootErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  const targetAgentId = Number(mappingRes.data?.[0]?.agent_id);
  const targetName = profileRes.data?.[0]?.full_name;
  if (!Number.isSafeInteger(targetAgentId) || !membershipRes.data?.length || !targetName) {
    return NextResponse.json({ error: "TARGET_NOT_AUTHORIZED" }, { status: 403 });
  }

  try {
    const conversation = await getChatwootConversation(auth.accountId, Number(params.id));
    const previousAssigneeId = chatwootAssigneeId(conversation);
    const enabledAgents = await listChatwootInboxAgents(auth.accountId, conversation.inbox_id);
    if (!enabledAgents.some((agent) => agent.id === targetAgentId)) {
      return NextResponse.json({ error: "TARGET_NOT_ENABLED_IN_INBOX", message: `${targetName} não está na inbox #${conversation.inbox_id}. No Chatwoot, abra Configurações → Caixas de entrada → Agentes, adicione o funcionário e clique em Atualizar.` }, { status: 403 });
    }

    const previousLabels = await getChatwootConversationLabels(auth.accountId, Number(params.id));
    previousChatwootState = { assigneeId: previousAssigneeId, labels: previousLabels };
    const nextLabels = responsibilityLabels(previousLabels, targetName);
    chatwootMutationStarted = true;
    await assignChatwootConversation(auth.accountId, Number(params.id), targetAgentId);
    await replaceChatwootConversationLabels(auth.accountId, Number(params.id), nextLabels);

    const completed = await supabaseRest<any>("rpc/complete_conversation_transfer", {
      accessToken: auth.context.accessToken,
      method: "POST",
      body: {
        p_org: auth.context.organizationId,
        p_account: auth.accountId,
        p_conv: Number(params.id),
        p_target_user: targetUserId,
        p_target_branch: targetBranchId,
        p_note: typeof note === "string" && note.trim() ? note.trim() : null,
      },
    });
    if (completed.error || !completed.data?.transferred) {
      const restored = await restoreChatwootState({
        accountId: auth.accountId,
        conversationId: Number(params.id),
        assigneeId: previousAssigneeId,
        labels: previousLabels,
      });
      if (!restored) {
        return NextResponse.json(
          { error: "TRANSFER_RECONCILIATION_REQUIRED" },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "TRANSFER_PERSISTENCE_FAILED" }, { status: 503 });
    }

    let note_saved = true;
    if (typeof note === "string" && note.trim()) {
      try {
        await createChatwootPrivateNote(
          auth.accountId,
          Number(params.id),
          `[Transferência de Atendimento]: ${note.trim()}`,
        );
      } catch {
        note_saved = false;
      }
    }

    return NextResponse.json({
      success: true,
      transferred_to: targetUserId,
      agent_name: targetName,
      branch_id: targetBranchId,
      branch_name: membershipRes.data[0].branches?.name || "Filial",
      chatwoot_assignee_id: targetAgentId,
      labels: nextLabels,
      note_saved,
    });
  } catch (error) {
    if (chatwootMutationStarted && previousChatwootState) {
      const restored = await restoreChatwootState({
        accountId: auth.accountId,
        conversationId: Number(params.id),
        ...previousChatwootState,
      });
      if (!restored) {
        return NextResponse.json(
          { error: "TRANSFER_RECONCILIATION_REQUIRED" },
          { status: 503 },
        );
      }
    }
    const failure = chatwootErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
