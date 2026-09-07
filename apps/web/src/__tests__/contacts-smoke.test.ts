import { beforeEach, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/contacts/route";
import { httpFixture, org, branch, user } from "../../../../tests/support/http";
let state: ReturnType<typeof httpFixture>;
beforeEach(() => { state = httpFixture(); });
const request = () => new NextRequest("http://localhost:3000/api/contacts", { headers: { authorization: "Bearer verified" } });
it("contatos carrega cliente, canal, filial e nome do responsável no escopo autenticado", async () => {
  state.customers = [{ id: "contact", name: "Cliente teste", phone: "5512000000000", customer_channels: [{ channel_type: "whatsapp" }], conversation_links: [{ branch_id: branch, assigned_user_id: user, status: "open", updated_at: "2026-09-07" }] }];
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect((await response.json()).contacts[0]).toMatchObject({ name: "Cliente teste", channels: ["whatsapp"], assigned_agent_name: "Test User", branch_name: "Guaratinguetá — Unidade 1" });
  expect(state.calls.find((call) => call.url.pathname.endsWith("/customers"))?.url.searchParams.get("organization_id")).toBe(`eq.${org}`);
});
it("contatos falha explicitamente quando persistência está indisponível", async () => {
  state.fail = "customers";
  expect((await GET(request())).status).toBe(503);
});
