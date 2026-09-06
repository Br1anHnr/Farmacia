import { NextResponse, type NextRequest } from "next/server";
import { conversationAccess } from "@/lib/conversation-access";
import { supabaseAdminRest, supabaseRest } from "@/lib/server/supabase";
import {
  assignChatwootConversation,
  chatwootErrorResponse,
  getChatwootConversation,
  listChatwootInboxAgents,
} from "@/lib/server/chatwoot";
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
  if ("response" in auth) return auth.response;
  if (
    auth.conversation.assigned_user_id &&
    auth.conversation.assigned_user_id !== auth.context.userId
  ) {
    return NextResponse.json({ error: "ALREADY_ASSIGNED" }, { status: 409 });
  }

  let claimedByName: string | null = null;
  let branchName = "Unidade";

  if (auth.conversation.assigned_user_id) {
    const profileRes = await supabaseRest<any[]>("profiles", {
      accessToken: auth.context.accessToken,
      params: {
        id: `eq.${auth.conversation.assigned_user_id}`,
        select: "full_name",
      },
    });
    if (profileRes.data?.[0]?.full_name) {
      claimedByName = profileRes.data[0].full_name;
    }
  }

  if (auth.conversation.branch_id) {
    const branchRes = await supabaseRest<any[]>("branches", {
      accessToken: auth.context.accessToken,
      params: {
        id: `eq.${auth.conversation.branch_id}`,
        select: "name",
      },
    });
    if (branchRes.data?.[0]?.name) {
      branchName = branchRes.data[0].name;
    }
  }

  return NextResponse.json({
    is_claimed:
      !!auth.conversation.assigned_user_id ||
      !!auth.conversation.chatwoot_assignee_id,
    claimed_by: claimedByName || auth.conversation.assigned_user_id,
    claimed_user_id: auth.conversation.assigned_user_id,
    branch: branchName,
    branch_id: auth.conversation.branch_id,
  });
}
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
  if ("response" in auth) return auth.response;
  try {
    const mapping = await supabaseAdminRest<any[]>("chatwoot_agents", {
      params: {
        organization_id: `eq.${auth.context.organizationId}`,
        account_id: `eq.${auth.accountId}`,
        user_id: `eq.${auth.context.userId}`,
        active: "eq.true",
        select: "agent_id",
      },
    });
    const agentId = Number(mapping.data?.[0]?.agent_id);
    if (mapping.error || !Number.isSafeInteger(agentId)) {
      return NextResponse.json({ error: "CHATWOOT_MAPPING_REQUIRED" }, { status: 403 });
    }
    const conversation = await getChatwootConversation(auth.accountId, Number(params.id));
    const enabledAgents = await listChatwootInboxAgents(auth.accountId, conversation.inbox_id);
    if (!enabledAgents.some((agent) => agent.id === agentId && agent.confirmed !== false)) {
      return NextResponse.json({ error: "AGENT_NOT_ENABLED_IN_INBOX" }, { status: 403 });
    }
    await assignChatwootConversation(auth.accountId, Number(params.id), agentId);

    const claim = await supabaseRest<any>("rpc/claim_conversation", {
      accessToken: auth.context.accessToken,
      method: "POST",
      body: {
        p_org: auth.context.organizationId,
        p_account: auth.accountId,
        p_conv: Number(params.id),
      },
    });
    if (claim.error || !claim.data?.agent_id) {
      return NextResponse.json(
        { error: "CLAIM_NOT_PERSISTED" },
        { status: [403, 409].includes(claim.status) ? claim.status : 503 },
      );
    }

    let branchName = "Unidade";
    if (claim.data.branch_id) {
      const branchRes = await supabaseRest<any[]>("branches", {
        accessToken: auth.context.accessToken,
        params: {
          id: `eq.${claim.data.branch_id}`,
          select: "name",
        },
      });
      if (branchRes.data?.[0]?.name) {
        branchName = branchRes.data[0].name;
      }
    }

    return NextResponse.json({
      success: true,
      is_claimed: true,
      claimed_by: auth.context.fullName,
      claimed_user_id: auth.context.userId,
      branch: branchName,
      branch_id: claim.data.branch_id,
    });
  } catch (error) {
    const failure = chatwootErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
