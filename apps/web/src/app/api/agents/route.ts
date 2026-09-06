import { NextRequest, NextResponse } from "next/server";
import { conversationAccess } from "@/lib/conversation-access";
import { supabaseAdminRest } from "@/lib/server/supabase";
import {
  chatwootErrorResponse,
  getChatwootConversation,
  listChatwootAccountAgents,
  listChatwootInboxAgents,
} from "@/lib/server/chatwoot";

export async function GET(request: NextRequest) {
  const conversationId = request.nextUrl.searchParams.get("conversation_id") || "";
  const auth = await conversationAccess(request, conversationId);
  if ("response" in auth) return auth.response;

  try {
    const conversation = await getChatwootConversation(auth.accountId, Number(conversationId));
    const [accountAgents, inboxAgents] = await Promise.all([
      listChatwootAccountAgents(auth.accountId),
      listChatwootInboxAgents(auth.accountId, conversation.inbox_id),
    ]);
    const activeAccountAgents = accountAgents
      .filter((agent) => agent.confirmed !== false && Number.isSafeInteger(agent.id));

    const [membersRes, profilesRes, branchMembersRes] = await Promise.all([
      supabaseAdminRest<any[]>("organization_members", {
        params: {
          organization_id: `eq.${auth.context.organizationId}`,
          role: "in.(agent,manager)",
          select: "user_id,role",
        },
      }),
      supabaseAdminRest<any[]>("profiles", {
        params: { select: "id,email,full_name" },
      }),
      supabaseAdminRest<any[]>("branch_members", {
        params: {
          select: "user_id,branch_id,branches!inner(name,organization_id,active)",
          "branches.organization_id": `eq.${auth.context.organizationId}`,
          "branches.active": "eq.true",
        },
      }),
    ]);
    if (membersRes.error || profilesRes.error || branchMembersRes.error) {
      return NextResponse.json({ error: "AGENTS_UNAVAILABLE" }, { status: 503 });
    }

    const members = new Map((membersRes.data || []).map((item) => [item.user_id, item.role]));
    const profiles = new Map(
      (profilesRes.data || []).map((profile) => [String(profile.email).toLowerCase(), profile]),
    );
    const mappings = activeAccountAgents.map((agent) => {
      const profile = profiles.get(String(agent.email || "").toLowerCase());
      return {
        organization_id: auth.context.organizationId,
        account_id: auth.accountId,
        agent_id: agent.id,
        user_id: profile && members.has(profile.id) ? profile.id : null,
        email: String(agent.email || "").toLowerCase(),
        display_name: agent.name || agent.available_name || agent.email,
        active: true,
        last_synced_at: new Date().toISOString(),
      };
    });
    if (mappings.length) {
      const saved = await supabaseAdminRest("chatwoot_agents", {
        method: "POST",
        params: { on_conflict: "organization_id,account_id,agent_id" },
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: mappings,
      });
      if (saved.error) {
        return NextResponse.json({ error: "AGENT_SYNC_FAILED" }, { status: 503 });
      }
    }

    const byChatwootId = new Map(mappings.map((mapping) => [mapping.agent_id, mapping]));
    const branchesByUser = new Map<string, Array<{ id: string; name: string }>>();
    for (const membership of branchMembersRes.data || []) {
      if (!members.has(membership.user_id)) continue;
      const branches = branchesByUser.get(membership.user_id) || [];
      branches.push({ id: membership.branch_id, name: membership.branches?.name || "Filial" });
      branchesByUser.set(membership.user_id, branches);
    }

    const agents = inboxAgents.flatMap((agent) => {
      const mapping = byChatwootId.get(agent.id);
      if (!mapping?.user_id) return [];
      const profile = profiles.get(mapping.email);
      return (branchesByUser.get(mapping.user_id) || []).map((branch) => ({
        id: mapping.user_id,
        chatwoot_agent_id: agent.id,
        name: profile?.full_name || mapping.display_name,
        role: members.get(mapping.user_id) === "manager" ? "Gerente" : "Atendente",
        branch_id: branch.id,
        branch_name: branch.name,
      }));
    });

    return NextResponse.json({
      agents,
      synchronized: mappings.length,
      unmapped: mappings.filter((mapping) => !mapping.user_id).map((mapping) => mapping.email),
      inbox_id: conversation.inbox_id,
    });
  } catch (error) {
    const failure = chatwootErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
