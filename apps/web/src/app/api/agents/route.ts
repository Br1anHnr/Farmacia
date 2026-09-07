import { NextRequest, NextResponse } from "next/server";
import { conversationAccess } from "@/lib/conversation-access";
import { supabaseAdminRest } from "@/lib/server/supabase";
import { sharedOperator } from "@/lib/server/shared-operator";
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
    const sharedAgentId = await sharedOperator(auth.context, auth.accountId);
    const [accountAgents, inboxAgents] = await Promise.all([
      listChatwootAccountAgents(auth.accountId),
      listChatwootInboxAgents(auth.accountId, conversation.inbox_id),
    ]);
    const activeAccountAgents = accountAgents.filter((agent) => Number.isSafeInteger(agent.id));

    const membersRes = await supabaseAdminRest<any[]>("organization_members", {
      params: {
        organization_id: `eq.${auth.context.organizationId}`,
        role: "in.(agent,manager)",
        select: "user_id,role",
      },
    });
    if (membersRes.error) {
      return NextResponse.json({ error: "AGENTS_UNAVAILABLE" }, { status: 503 });
    }
    const memberIds = (membersRes.data || []).map((item) => item.user_id);
    const [profilesRes, branchMembersRes, existingMappingsRes] = await Promise.all([
      supabaseAdminRest<any[]>("profiles", {
        params: {
          id: memberIds.length ? `in.(${memberIds.join(",")})` : "eq.00000000-0000-0000-0000-000000000000",
          select: "id,email,full_name",
        },
      }),
      supabaseAdminRest<any[]>("branch_members", {
        params: {
          select: "user_id,branch_id,branches!inner(name,organization_id,active)",
          "branches.organization_id": `eq.${auth.context.organizationId}`,
          "branches.active": "eq.true",
        },
      }),
      supabaseAdminRest<any[]>("chatwoot_agents", {
        params: {
          organization_id: `eq.${auth.context.organizationId}`,
          account_id: `eq.${auth.accountId}`,
          select: "agent_id,user_id",
        },
      }),
    ]);
    if (profilesRes.error || branchMembersRes.error || existingMappingsRes.error) {
      return NextResponse.json({ error: "AGENTS_UNAVAILABLE" }, { status: 503 });
    }

    const members = new Map((membersRes.data || []).map((item) => [item.user_id, item.role]));
    if (sharedAgentId !== null) {
      if (!inboxAgents.some((agent) => agent.id === sharedAgentId && agent.confirmed !== false)) {
        return NextResponse.json({ error: "SHARED_OPERATOR_NOT_ENABLED" }, { status: 403 });
      }
      const agents = (branchMembersRes.data || []).flatMap((membership) => {
        const profile = (profilesRes.data || []).find((item) => item.id === membership.user_id);
        if (!profile || !members.has(profile.id)) return [];
        return [{ id: profile.id, name: profile.full_name,
          role: members.get(profile.id) === "manager" ? "Gerente" : "Atendente",
          branch_id: membership.branch_id, branch_name: membership.branches?.name || "Filial" }];
      });
      return NextResponse.json({ agents, shared_operator: true, inbox_id: conversation.inbox_id });
    }
    const profiles = new Map(
      (profilesRes.data || []).map((profile) => [String(profile.email).toLowerCase(), profile]),
    );
    const profilesById = new Map(
      (profilesRes.data || []).map((profile) => [profile.id, profile]),
    );
    const existingUsersByAgent = new Map(
      (existingMappingsRes.data || []).map((mapping) => [mapping.agent_id, mapping.user_id]),
    );
    const mappings = activeAccountAgents.map((agent) => {
      const profile = profiles.get(String(agent.email || "").toLowerCase());
      const existingUserId = existingUsersByAgent.get(agent.id);
      return {
        organization_id: auth.context.organizationId,
        account_id: auth.accountId,
        agent_id: agent.id,
        user_id:
          profile && members.has(profile.id)
            ? profile.id
            : existingUserId && members.has(existingUserId)
              ? existingUserId
              : null,
        email: String(agent.email || "").toLowerCase(),
        display_name: agent.name || agent.available_name || agent.email,
        active: true,
        last_synced_at: new Date().toISOString(),
      };
    });
    const deactivated = await supabaseAdminRest("chatwoot_agents", {
      method: "PATCH",
      params: {
        organization_id: `eq.${auth.context.organizationId}`,
        account_id: `eq.${auth.accountId}`,
      },
      body: { active: false, last_synced_at: new Date().toISOString() },
    });
    if (deactivated.error) {
      return NextResponse.json({ error: "AGENT_SYNC_FAILED" }, { status: 503 });
    }
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
      const profile = profilesById.get(mapping.user_id);
      return (branchesByUser.get(mapping.user_id) || []).map((branch) => ({
        id: mapping.user_id,
        chatwoot_agent_id: agent.id,
        name: profile?.full_name || mapping.display_name,
        role: members.get(mapping.user_id) === "manager" ? "Gerente" : "Atendente",
        branch_id: branch.id,
        branch_name: branch.name,
      }));
    });

    const profileEmails = new Set(Array.from(profiles.keys()));
    const membersWithoutProfile = memberIds.filter(
      (memberId) => !(profilesRes.data || []).some((profile) => profile.id === memberId),
    );
    const membersWithoutBranch = memberIds.filter(
      (memberId) => !(branchesByUser.get(memberId) || []).length,
    );

    return NextResponse.json({
      agents,
      synchronized: mappings.length,
      unmapped: mappings.filter((mapping) => !mapping.user_id).map((mapping) => mapping.email),
      diagnostics: {
        inbox_agents: inboxAgents.length,
        account_agents: activeAccountAgents.length,
        eligible_agents: new Set(agents.map((agent) => agent.id)).size,
        chatwoot_emails_without_profile: activeAccountAgents
          .map((agent) => String(agent.email || "").toLowerCase())
          .filter((email) => email && !profileEmails.has(email)),
        members_without_profile: membersWithoutProfile,
        members_without_branch: membersWithoutBranch,
      },
      inbox_id: conversation.inbox_id,
    });
  } catch (error) {
    const failure = chatwootErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
