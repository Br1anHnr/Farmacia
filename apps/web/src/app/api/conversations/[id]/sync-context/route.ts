import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/server-auth";
import { supabaseAdminRest, supabaseRest } from "@/lib/server/supabase";
import {
  chatwootErrorResponse,
  conversationAccountId,
  getChatwootConversation,
} from "@/lib/server/chatwoot";

type InboxMapping = {
  organization_id: string;
  branch_id: string;
  channel: "whatsapp" | "instagram" | "facebook";
};

function inboxMapping(inboxId: number): InboxMapping | null {
  try {
    return JSON.parse(process.env.CHATWOOT_INBOX_MAP || "{}")[String(inboxId)] || null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  if (!["agent", "manager"].includes(auth.context.role)) {
    return NextResponse.json({ error: "ACCESS_DENIED" }, { status: 403 });
  }
  if (!/^[1-9]\d*$/.test(params.id) || !Number.isSafeInteger(Number(params.id))) {
    return NextResponse.json({ error: "INVALID_CONVERSATION_ID" }, { status: 400 });
  }

  let accountId: number;
  try {
    accountId = conversationAccountId(request);
  } catch (error) {
    const failure = chatwootErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }

  const existing = await supabaseRest<any[]>("conversation_links", {
    accessToken: auth.context.accessToken,
    params: {
      organization_id: `eq.${auth.context.organizationId}`,
      chatwoot_account_id: `eq.${accountId}`,
      chatwoot_conversation_id: `eq.${params.id}`,
      branch_id: `in.(${auth.context.branchIds.join(",")})`,
      select: "*",
    },
  });
  if (existing.error) {
    return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503 });
  }
  try {
    const conversation = await getChatwootConversation(accountId, Number(params.id));
    const mapping = inboxMapping(conversation.inbox_id);
    if (!mapping) {
      return NextResponse.json({ error: "INBOX_CONFIGURATION_REQUIRED" }, { status: 503 });
    }
    if (
      mapping.organization_id !== auth.context.organizationId ||
      !auth.context.branchIds.includes(existing.data?.[0]?.branch_id || mapping.branch_id)
    ) {
      return NextResponse.json({ error: "CONVERSATION_SCOPE_DENIED" }, { status: 403 });
    }

    const sender = conversation.meta?.sender || {};
    const assignee =
      conversation.assignee_id ||
      conversation.assignee?.id ||
      conversation.meta?.assignee?.id ||
      null;
    const synchronized = await supabaseAdminRest<any>("rpc/sync_webhook", {
      method: "POST",
      body: {
        p_org: mapping.organization_id,
        p_branch: mapping.branch_id,
        p_account: accountId,
        p_conv: Number(params.id),
        p_channel: mapping.channel,
        p_contact: sender.id == null ? null : String(sender.id),
        p_name: sender.name || null,
        p_phone: sender.phone_number || null,
        p_human: Boolean(assignee),
        p_key: null,
        p_assignee: assignee,
      },
    });
    if (synchronized.error || !synchronized.data?.id) {
      return NextResponse.json({ error: "CONVERSATION_LINK_FAILED" }, { status: 503 });
    }
    // The administrative synchronization result is not authorization to read it.
    const visible = await supabaseRest<any[]>("conversation_links", {
      accessToken: auth.context.accessToken,
      params: { organization_id: `eq.${auth.context.organizationId}`,
        chatwoot_account_id: `eq.${accountId}`, chatwoot_conversation_id: `eq.${params.id}`, select: "*" },
    });
    if (visible.error) return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503 });
    if (visible.data?.length !== 1) {
      return NextResponse.json({ error: "CONVERSATION_ACCESS_DENIED" }, { status: 403 });
    }
    return NextResponse.json({ linked: true, conversation: visible.data[0], labels: conversation.labels || [], contact: { name: sender.name || null, phone: sender.phone_number || null } });
  } catch (error) {
    const failure = chatwootErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
