import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/conversations/[id]/close/route";
import { branch, httpFixture, org } from "../../../../tests/support/http";

let state: ReturnType<typeof httpFixture>;
beforeEach(() => {
  state = httpFixture();
});

const key = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/conversations/101/close", {
    method: "POST",
    headers: {
      authorization: "Bearer verified",
      "content-type": "application/json",
      "idempotency-key": key,
    },
    body: JSON.stringify({
      organization_id: org,
      branch_id: branch,
      chatwoot_conversation_id: 101,
      channel: "whatsapp",
      ...body,
    }),
  });
}

describe("Encerramento de atendimento", () => {
  it("exige sessão autenticada", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/conversations/101/close", {
        method: "POST",
        body: "{}",
      }),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(401);
    expect(state.calls).toHaveLength(0);
  });

  it("rejeita origem cruzada antes de persistir", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/conversations/101/close", {
        method: "POST",
        headers: {
          cookie: "sb_access_token=verified",
          origin: "https://evil.invalid",
        },
        body: "{}",
      }),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(403);
    expect(state.calls).toHaveLength(0);
  });

  it.each(["resolved", "cancelled"])(
    "persiste o resultado %s antes de confirmar",
    async (outcome) => {
      state.closure.outcome = outcome;
      const response = await POST(request({ outcome }), { params: { id: "101" } });
      expect(response.status).toBe(201);
      expect((await response.json()).persisted).toBe(true);
      expect(
        state.calls.some((call) =>
          call.url.pathname.endsWith("/close_conversation"),
        ),
      ).toBe(true);
    },
  );

  it("exige motivo para não venda", async () => {
    expect(
      (await POST(request({ outcome: "not_sold" }), { params: { id: "101" } }))
        .status,
    ).toBe(400);
  });

  it("aceita não venda com motivo válido", async () => {
    state.closure.outcome = "not_sold";
    const response = await POST(
      request({ outcome: "not_sold", reason: "price" }),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(201);
  });

  it("envia produtos e valores da venda para a RPC", async () => {
    state.closure.outcome = "sale";
    state.closure.sale_id = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const response = await POST(
      request({
        outcome: "sale",
        customer_name: "Cliente",
        items: [{ product_name: "Produto", unit_price: 12.5, quantity: 2 }],
        discount: 0,
        fulfillment_method: "pickup",
        origin_type: "manual",
      }),
      { params: { id: "101" } },
    );
    expect(response.status).toBe(201);
    const rpc = state.calls.find((call) =>
      call.url.pathname.endsWith("/close_conversation"),
    );
    expect(JSON.parse(rpc!.options.body).p_input.items).toEqual([
      { product_name: "Produto", unit_price: 12.5, quantity: 2 },
    ]);
  });

  it("não confirma quando a persistência falha ou volta incompleta", async () => {
    state.fail = "close_conversation";
    expect(
      (await POST(request({ outcome: "resolved" }), { params: { id: "101" } }))
        .status,
    ).toBe(503);
    state.fail = "";
    state.closure.persisted = false;
    expect(
      (await POST(request({ outcome: "resolved" }), { params: { id: "101" } }))
        .status,
    ).toBe(503);
  });

  it("nega conversa e organização forjadas", async () => {
    expect(
      (
        await POST(request({ outcome: "resolved", chatwoot_conversation_id: 202 }), {
          params: { id: "101" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await POST(request({ outcome: "resolved", organization_id: crypto.randomUUID() }), {
          params: { id: "101" },
        })
      ).status,
    ).toBe(403);
  });
});
