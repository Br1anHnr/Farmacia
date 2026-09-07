import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as agents } from "../app/api/agents/route";
import { POST as sync } from "../app/api/conversations/[id]/sync-context/route";
import { POST as claim } from "../app/api/conversations/[id]/claim/route";
import { POST as transfer } from "../app/api/conversations/[id]/transfer/route";
import {
  httpFixture,
  managerUser,
  otherAgentUser,
  otherBranch,
  user,
} from "../../../../tests/support/http";

let state: ReturnType<typeof httpFixture>;
beforeEach(() => {
  state = httpFixture();
});

function request(path: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: "Bearer verified",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("Vínculo Chatwoot e fluxo de atribuição", () => {
  it("usa o operador compartilhado e etiqueta o responsável do Hub", async () => {
    state.sharedAgentId = 7;
    const listed = await agents(request("/api/agents?conversation_id=101&account_id=1"));
    expect((await listed.json()).agents.map((item: any) => item.id)).toContain(otherAgentUser);
    const response = await transfer(request("/api/conversations/101/transfer?account_id=1", {
      target_user_id: otherAgentUser, target_branch_id: otherBranch,
    }), { params: { id: "101" } });
    expect(response.status).toBe(200);
    expect(state.chatwootAssignee).toBe(7);
    expect(state.labels).toEqual(expect.arrayContaining(["vip", "orcamento", "atendente-atendente-dois"]));
    expect(state.labels).not.toContain("atendente-antigo");
  });

  it("assume com operador compartilhado e preserva etiquetas comerciais", async () => {
    state.sharedAgentId = 8;
    const response = await claim(request("/api/conversations/101/claim?account_id=1", {}), { params: { id: "101" } });
    expect(response.status).toBe(200);
    expect(state.chatwootAssignee).toBe(8);
    expect(state.labels).toEqual(expect.arrayContaining(["vip", "orcamento", "atendente-test-user"]));
  });
  it("localiza vínculo existente pela conta e conversa e o confirma no Chatwoot", async () => {
    const response = await sync(
      request("/api/conversations/101/sync-context?account_id=1", {}),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(200);
    const lookup = state.calls.find((call) => call.url.pathname.endsWith("conversation_links"));
    expect(lookup?.url.searchParams.get("chatwoot_account_id")).toBe("eq.1");
    expect(lookup?.url.searchParams.get("chatwoot_conversation_id")).toBe("eq.101");
    expect(state.calls.some((call) => call.url.pathname.endsWith("/conversations/101"))).toBe(true);
  });

  it("sincroniza sob demanda quando o webhook ainda não criou o vínculo", async () => {
    state.conversation = false;
    const response = await sync(
      request("/api/conversations/101/sync-context?account_id=1", {}),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).linked).toBe(true);
    expect(state.calls.some((call) => call.url.pathname.endsWith("/conversations/101"))).toBe(true);
    const rpc = state.calls.find((call) => call.url.pathname.endsWith("/sync_webhook"));
    expect(JSON.parse(rpc!.options.body)).toMatchObject({ p_account: 1, p_conv: 101 });
  });

  it("não cria vínculo nem retorna sucesso quando o Chatwoot falha", async () => {
    state.conversation = false;
    state.chatwootAvailable = false;
    const response = await sync(
      request("/api/conversations/101/sync-context?account_id=1", {}),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(502);
    expect(state.calls.some((call) => call.url.pathname.endsWith("/sync_webhook"))).toBe(false);
  });

  it("sincroniza e lista atendentes e gerente habilitados na inbox e filial", async () => {
    const response = await agents(
      request("/api/agents?conversation_id=101&account_id=1"),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.agents.map((agent: any) => [agent.id, agent.branch_id])).toEqual(
      expect.arrayContaining([
        [managerUser, otherBranch],
        [otherAgentUser, otherBranch],
      ]),
    );
    const write = state.calls.find(
      (call) => call.url.pathname.endsWith("/chatwoot_agents") && call.options.method === "POST",
    );
    expect(JSON.parse(write!.options.body)).toHaveLength(3);
    expect(data.diagnostics).toMatchObject({
      inbox_agents: 3,
      account_agents: 3,
      eligible_agents: 3,
    });
    expect(state.calls.some(
      (call) => call.url.pathname.endsWith("/chatwoot_agents") && call.options.method === "PATCH",
    )).toBe(true);
  });

  it("preserva vínculo administrativo validado quando o e-mail do Chatwoot é diferente", async () => {
    state.chatwootAgentEmailMismatch = true;
    const response = await agents(
      request("/api/agents?conversation_id=101&account_id=1"),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.agents.some((agent: any) => agent.id === user)).toBe(true);
    const write = state.calls.find(
      (call) => call.url.pathname.endsWith("/chatwoot_agents") && call.options.method === "POST",
    );
    const mapping = JSON.parse(write!.options.body).find((item: any) => item.agent_id === 7);
    expect(mapping.user_id).toBe(user);
  });

  it("lista agentes habilitados na inbox mesmo com convite do Chatwoot pendente", async () => {
    state.chatwootAgentsConfirmed = false;
    const response = await agents(
      request("/api/agents?conversation_id=101&account_id=1"),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.diagnostics.eligible_agents).toBe(3);
    expect(data.agents.map((agent: any) => agent.id)).toEqual(
      expect.arrayContaining([user, managerUser, otherAgentUser]),
    );
  });

  it("assume como atendente no Chatwoot antes de persistir no Hub", async () => {
    const response = await claim(
      request("/api/conversations/101/claim?account_id=1", {}),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(200);
    const assignmentIndex = state.calls.findIndex((call) => call.url.pathname.endsWith("/assignments"));
    const rpcIndex = state.calls.findIndex((call) => call.url.pathname.endsWith("/claim_conversation"));
    expect(assignmentIndex).toBeGreaterThan(-1);
    expect(rpcIndex).toBeGreaterThan(assignmentIndex);
  });

  it("restaura o responsável do Chatwoot quando o claim não persiste no Hub", async () => {
    state.chatwootAssignee = 8;
    state.fail = "claim_conversation";
    const response = await claim(
      request("/api/conversations/101/claim?account_id=1", {}),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("CLAIM_NOT_PERSISTED");
    expect(state.chatwootAssignee).toBe(8);
  });

  it.each([
    ["gerente", managerUser],
    ["outro atendente", otherAgentUser],
  ])("transfere para %s entre filiais, preserva etiquetas e só então audita", async (_label, target) => {
    const response = await transfer(
      request("/api/conversations/101/transfer?account_id=1", {
        target_user_id: target,
        target_branch_id: otherBranch,
      }),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(200);
    expect(state.labels).toEqual(expect.arrayContaining(["vip", "orcamento"]));
    expect(state.labels).not.toContain("atendente-antigo");
    expect(state.labels.some((label) => label.startsWith("atendente-"))).toBe(true);
    const assignmentIndex = state.calls.findIndex((call) => call.url.pathname.endsWith("/assignments"));
    const labelsIndex = state.calls.findIndex(
      (call) => call.url.pathname.endsWith("/labels") && call.options.method === "POST",
    );
    const persistenceIndex = state.calls.findIndex((call) =>
      call.url.pathname.endsWith("/complete_conversation_transfer"),
    );
    expect(labelsIndex).toBeGreaterThan(assignmentIndex);
    expect(persistenceIndex).toBeGreaterThan(labelsIndex);
  });

  it("não atualiza Hub nem auditoria quando a atribuição do Chatwoot falha", async () => {
    state.fail = "assignments";
    const response = await transfer(
      request("/api/conversations/101/transfer?account_id=1", {
        target_user_id: otherAgentUser,
        target_branch_id: otherBranch,
      }),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(502);
    expect(
      state.calls.some((call) => call.url.pathname.endsWith("/complete_conversation_transfer")),
    ).toBe(false);
  });

  it("restaura responsável e etiquetas quando a transferência não persiste no Hub", async () => {
    state.chatwootAssignee = 7;
    state.fail = "complete_conversation_transfer";
    const response = await transfer(
      request("/api/conversations/101/transfer?account_id=1", {
        target_user_id: otherAgentUser,
        target_branch_id: otherBranch,
      }),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("TRANSFER_PERSISTENCE_FAILED");
    expect(state.chatwootAssignee).toBe(7);
    expect(state.labels).toEqual(["vip", "atendente-antigo", "orcamento"]);
  });
});
