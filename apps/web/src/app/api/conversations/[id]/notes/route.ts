import { NextRequest, NextResponse } from "next/server";
import { conversationAccess } from "@/lib/conversation-access";
import { supabaseRest } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
  if ("response" in auth) return auth.response;

  const url = process.env.CHATWOOT_BASE_URL;
  const token = process.env.CHATWOOT_API_TOKEN;
  const account = auth.conversation.chatwoot_account_id || Number(process.env.CHATWOOT_ACCOUNT_ID || "1");

  if (!url || !token) {
    return NextResponse.json({ notes: [] });
  }

  try {
    const res = await fetch(
      `${url}/api/v1/accounts/${account}/conversations/${params.id}/messages`,
      {
        headers: { api_access_token: token },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) {
      return NextResponse.json({ notes: [] });
    }

    const data = await res.json();
    const allMessages: any[] = data.payload || [];
    const notes = allMessages
      .filter((m) => m.private === true)
      .map((m) => ({
        id: String(m.id),
        content: m.content || "",
        sender: m.sender?.name || "Equipe da Farmácia",
        created_at: m.created_at
          ? new Date(m.created_at * 1000).toISOString()
          : new Date().toISOString(),
      }));

    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ notes: [] });
  }
}

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

  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "NOTE_CONTENT_REQUIRED" }, { status: 400 });
  }

  const url = process.env.CHATWOOT_BASE_URL;
  const token = process.env.CHATWOOT_API_TOKEN;
  const account = auth.conversation.chatwoot_account_id || Number(process.env.CHATWOOT_ACCOUNT_ID || "1");
  const adminToken = process.env.SUPABASE_SECRET_KEY || auth.context.accessToken;

  if (!url || !token) {
    return NextResponse.json(
      { error: "CHATWOOT_CONFIGURATION_REQUIRED" },
      { status: 503 },
    );
  }

  try {
    const formattedContent = `[MultiFarma - ${auth.context.fullName}] ${content}`;
    const res = await fetch(
      `${url}/api/v1/accounts/${account}/conversations/${params.id}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_access_token: token,
        },
        body: JSON.stringify({
          content: formattedContent,
          private: true,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "CHATWOOT_SYNC_FAILED" },
        { status: 502 },
      );
    }

    const createdMsg = await res.json();

    // Registra evento de auditoria no Supabase
    await supabaseRest("audit_events", {
      accessToken: adminToken,
      method: "POST",
      body: {
        organization_id: auth.context.organizationId,
        branch_id: auth.conversation.branch_id,
        actor_id: auth.context.userId,
        action: "INTERNAL_NOTE_ADDED",
        entity_type: "conversation",
        entity_id: String(params.id),
        metadata: {
          note: content,
          chatwoot_message_id: createdMsg.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      note: {
        id: String(createdMsg.id),
        content: content,
        sender: auth.context.fullName,
        created_at: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "CONNECTION_FAILED" },
      { status: 502 },
    );
  }
}
