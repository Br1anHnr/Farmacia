import { vi } from "vitest";
export const user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  org = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  branch = "cccccccc-cccc-cccc-cccc-cccccccccccc";
export function httpFixture(role = "agent") {
  const state = {
    role,
    fail: "",
    members: true,
    branches: true,
    room: true,
    conversation: true,
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
      if (endpoint === state.fail)
        return new Response("{}", {
          status: endpoint === "user" || endpoint === "token" ? 401 : 503,
        });
      let data: any;
      switch (endpoint) {
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
            ? [{ organization_id: org, role: state.role }]
            : [];
          break;
        case "branch_members":
          data = state.branches ? [{ branch_id: branch }] : [];
          break;
        case "internal_rooms":
          data = state.room ? [{ id: branch, branch_id: branch }] : [];
          break;
        case "internal_messages":
          data =
            options.method === "POST"
              ? [
                  {
                    id: "message",
                    ...JSON.parse(options.body),
                    created_at: "2026-09-05T00:00:00Z",
                  },
                ]
              : [];
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
        case "record_sale":
          data = state.sale;
          break;
        case "close_conversation":
          data = state.closure;
          break;
        case "claim_conversation":
          data = { agent_id: 7, account_id: 1, branch_id: branch };
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
