import { NextResponse, type NextRequest } from "next/server";
import { conversationAccess } from "@/lib/conversation-access";
import { supabaseRest } from "@/lib/supabase";
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
  if ("response" in auth) return auth.response;
  return NextResponse.json({
    is_claimed:
      !!auth.conversation.assigned_user_id ||
      !!auth.conversation.chatwoot_assignee_id,
    claimed_by: auth.conversation.assigned_user_id,
    branch: auth.conversation.branch_id,
  });
}
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
  if ("response" in auth) return auth.response;
  const url = process.env.CHATWOOT_BASE_URL,
    token = process.env.CHATWOOT_API_TOKEN,
    account = Number(process.env.CHATWOOT_ACCOUNT_ID);
  if (
    !url ||
    !token ||
    !account ||
    account !== auth.conversation.chatwoot_account_id
  )
    return NextResponse.json(
      { error: "CHATWOOT_CONFIGURATION_REQUIRED" },
      { status: 503 },
    );
  const claim = await supabaseRest<any>("rpc/claim_conversation", {
    accessToken: auth.context.accessToken,
    method: "POST",
    body: { p_org: auth.context.organizationId, p_conv: Number(params.id) },
  });
  if (claim.error || !claim.data?.agent_id)
    return NextResponse.json(
      { error: "CLAIM_NOT_PERSISTED" },
      { status: [403, 409].includes(claim.status) ? claim.status : 503 },
    );
  try {
    const remote = await fetch(
      url +
        "/api/v1/accounts/" +
        account +
        "/conversations/" +
        params.id +
        "/assignments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_access_token: token,
        },
        body: JSON.stringify({ assignee_id: claim.data.agent_id }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!remote.ok)
      return NextResponse.json(
        { error: "CHATWOOT_SYNC_PENDING" },
        { status: 502 },
      );
    return NextResponse.json({
      success: true,
      is_claimed: true,
      claimed_by: auth.context.fullName,
      branch: claim.data.branch_id,
    });
  } catch {
    return NextResponse.json(
      { error: "CHATWOOT_SYNC_PENDING" },
      { status: 502 },
    );
  }
}
