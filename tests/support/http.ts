import { vi } from "vitest";
export const user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  org = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  branch = "cccccccc-cccc-cccc-cccc-cccccccccccc",
  managerUser = "ffffffff-ffff-ffff-ffff-ffffffffffff",
  otherAgentUser = "dddddddd-dddd-dddd-dddd-dddddddddddd",
  otherBranch = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
export function httpFixture(role = "agent") {
  const state = {
    role,
    fail: "",
    members: true,
    branches: true,
    room: true,
    conversation: true,
    chatwootAvailable: true,
    chatwootAgentEmailMismatch: false,
    chatwootAgentsConfirmed: true,
    inboxAgentIds: [7, 8, 9],
    assignmentConfirmed: true,
    sharedAgentId: null as number | null,
    chatwootAssignee: null as number | null,
    labels: ["vip", "atendente-antigo", "orcamento"],
    messages: [] as Array<Record<string, unknown>>,
    customers: [] as Array<Record<string, unknown>>,
    calls: [] as Array<{ url: URL; options: any }>,
    sale: {
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      subtotal: 39.5,
      total_amount: 35,
      agent_id: user,
      status: "confirmed",
      items: [{ id: "i1" }, { id: "i2" }],
      confirmed_at: "2026-09-05T00:00:00Z",
    },
    closure: {
      persisted: true,
      conversation_id: 101,
      outcome: "resolved",
      sale_id: null as string | null,
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, options: any = {}) => {
      const url = new URL(String(input));
      state.calls.push({ url, options });
      const endpoint = url.pathname.split("/").pop()!;
      if (url.hostname === "chatwoot.invalid") {
        if (!state.chatwootAvailable || endpoint === state.fail)
          return new Response("{}", { status: 503 });
        if (url.pathname.endsWith("/conversations/101")) {
          return new Response(
            JSON.stringify({
              id: 101,
              account_id: 1,
              inbox_id: 9,
              assignee_id: state.chatwootAssignee,
              meta: { sender: { id: 44, name: "Cliente" } },
            }),
            { status: 200 },
          );
        }
        if (url.pathname.includes("/inbox_members/")) {
          return new Response(
            JSON.stringify({
              payload: [
                { id: 7, account_id: 1, email: state.chatwootAgentEmailMismatch ? "operacao@example.invalid" : "test@example.invalid", confirmed: state.chatwootAgentsConfirmed },
                { id: 8, account_id: 1, email: "manager@example.invalid", confirmed: state.chatwootAgentsConfirmed },
                { id: 9, account_id: 1, email: "agent2@example.invalid", confirmed: state.chatwootAgentsConfirmed },
              ].filter((agent) => state.inboxAgentIds.includes(agent.id)),
            }),
            { status: 200 },
          );
        }
        if (endpoint === "agents") {
          return new Response(
            JSON.stringify({
              payload: [
                { id: 7, account_id: 1, email: state.chatwootAgentEmailMismatch ? "operacao@example.invalid" : "test@example.invalid", confirmed: state.chatwootAgentsConfirmed },
                { id: 8, account_id: 1, email: "manager@example.invalid", confirmed: state.chatwootAgentsConfirmed },
                { id: 9, account_id: 1, email: "agent2@example.invalid", confirmed: state.chatwootAgentsConfirmed },
              ],
            }),
            { status: 200 },
          );
        }
        if (endpoint === "assignments") {
          const assignee = JSON.parse(options.body).assignee_id;
          if (state.assignmentConfirmed) state.chatwootAssignee = assignee;
          return new Response(JSON.stringify({ id: assignee, account_id: 1 }), { status: 200 });
        }
        if (endpoint === "labels") {
          if (options.method === "POST") state.labels = JSON.parse(options.body).labels;
          return new Response(JSON.stringify({ payload: state.labels }), { status: 200 });
        }
          if (endpoint === "toggle_status") {
            return new Response(JSON.stringify({ status: "resolved" }), { status: 200 });
          }
          if (endpoint === "messages") {
          return new Response(JSON.stringify({ id: 500 }), { status: 200 });
        }
      }
      if (endpoint === state.fail)
        return new Response("{}", {
          status: endpoint === "user" || endpoint === "token" ? 401 : 503,
        });
      let data: any;
      switch (endpoint) {
        case "customers":
          data = state.customers;
          break;
        case "chatwoot_operation_settings":
          data = state.sharedAgentId === null ? [] : [{ shared_agent_id: state.sharedAgentId }];
          break;
        case "token": {
          const body = JSON.parse(options.body);
          if (body.password === "wrong")
            return new Response("{}", { status: 400 });
          data = { access_token: "verified", expires_in: 3600 };
          break;
        }
        case "user":
          data = {
            id: user,
            email: "test@example.invalid",
            user_metadata: { role: "manager", full_name: "Test User" },
          };
          break;
        case "logout":
          return new Response(null, { status: 204 });
        case "organization_members":
          data = state.members
            ? url.searchParams.has("user_id")
              ? [{ organization_id: org, user_id: user, role: state.role }]
              : [
                  { organization_id: org, user_id: user, role: state.role },
                  { organization_id: org, user_id: managerUser, role: "manager" },
                  { organization_id: org, user_id: otherAgentUser, role: "agent" },
                ]
            : [];
          break;
        case "branch_members":
          data = state.branches
            ? !url.searchParams.has("user_id")
              ? [
                  { user_id: user, branch_id: branch, branches: { name: "Guaratinguetá — Unidade 1" } },
                  { user_id: managerUser, branch_id: otherBranch, branches: { name: "Potim — Unidade 1" } },
                  { user_id: otherAgentUser, branch_id: otherBranch, branches: { name: "Potim — Unidade 1" } },
                ]
              : url.searchParams.get("user_id") === `eq.${otherAgentUser}`
              ? [{ user_id: otherAgentUser, branch_id: otherBranch, branches: { name: "Potim — Unidade 1" } }]
              : url.searchParams.get("user_id") === `eq.${managerUser}`
              ? [{ user_id: managerUser, branch_id: otherBranch, branches: { name: "Potim — Unidade 1" } }]
              : [{ user_id: user, branch_id: branch, branches: { name: "Guaratinguetá — Unidade 1" } }]
            : [];
          break;
        case "internal_rooms":
          data = state.room
            ? [{ id: branch, name: "Sala Geral", branch_id: null, is_general: true, branches: null }]
            : [];
          break;
        case "internal_messages":
          if (options.method === "POST") {
            const body = JSON.parse(options.body);
            if (body.id && state.messages.some((message) => message.id === body.id)) data = [];
            else {
              data = [{ id: "message", ...body, created_at: "2026-09-05T00:00:00Z" }];
              state.messages.push(data[0]);
            }
          } else {
            data = state.messages.filter((message) => ["id", "room_id", "sender_id"].every((key) => !url.searchParams.has(key) || url.searchParams.get(key) === `eq.${message[key]}`));
          }
          break;
        case "conversation_links":
          data = state.conversation
            ? [
                {
                  id: "link",
                  organization_id: org,
                  branch_id: branch,
                  chatwoot_account_id: 1,
                  chatwoot_conversation_id: 101,
                  assigned_user_id: user,
                },
              ]
            : [];
          break;
        case "chatwoot_agents":
          data = url.searchParams.get("user_id") === `eq.${otherAgentUser}`
            ? [{ user_id: otherAgentUser, organization_id: org, account_id: 1, agent_id: 9, active: true }]
            : url.searchParams.get("user_id") === `eq.${managerUser}`
            ? [{ user_id: managerUser, organization_id: org, account_id: 1, agent_id: 8, active: true }]
            : [{ user_id: user, organization_id: org, account_id: 1, agent_id: 7, active: true }];
          break;
        case "profiles":
          data = url.searchParams.get("id") === `eq.${otherAgentUser}`
            ? [{ id: otherAgentUser, full_name: "Atendente Dois", email: "agent2@example.invalid" }]
            : url.searchParams.get("id") === `eq.${managerUser}`
            ? [{ id: managerUser, full_name: "Gerente Teste", email: "manager@example.invalid" }]
            : [
                { id: user, full_name: "Test User", email: "test@example.invalid" },
                { id: managerUser, full_name: "Gerente Teste", email: "manager@example.invalid" },
                { id: otherAgentUser, full_name: "Atendente Dois", email: "agent2@example.invalid" },
              ];
          break;
        case "branches":
          data = [{ id: branch, name: "Guaratinguetá — Unidade 1" }];
          break;
        case "record_sale":
          data = state.sale;
          break;
        case "close_conversation":
          data = state.closure;
          break;
        case "claim_conversation":
          data = { agent_id: 7, account_id: 1, branch_id: branch };
          break;
        case "sync_webhook":
          state.conversation = true;
          data = {
            id: "link",
            organization_id: org,
            branch_id: branch,
            chatwoot_account_id: 1,
            chatwoot_conversation_id: 101,
          };
          break;
        case "complete_conversation_transfer":
          data = { transferred: true, user_id: managerUser, branch_id: otherBranch, agent_id: 8 };
          break;
        case "assignments":
          data = { assignee_id: 7 };
          break;
        default:
          throw new Error("Unexpected endpoint " + endpoint);
      }
      return new Response(JSON.stringify(data), { status: 200 });
    }),
  );
  return state;
}
