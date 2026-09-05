import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "../app/api/sales/route";
import { NextRequest } from "next/server";
import { httpFixture, org, branch, user } from "../../../../tests/support/http";
let state: ReturnType<typeof httpFixture>;
beforeEach(() => {
  state = httpFixture();
});
const input = () => ({
  organization_id: org,
  branch_id: branch,
  chatwoot_conversation_id: 101,
  channel: "whatsapp",
  customer_name: "Synthetic",
  items: [
    { product_name: "A", unit_price: 8.5, quantity: 2 },
    { product_name: "B", unit_price: 22.5, quantity: 1 },
  ],
  discount: 4.5,
  fulfillment_method: "delivery",
  origin_type: "manual",
});
function req(
  body: any = input(),
  key = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
) {
  return new NextRequest("http://localhost:3000/api/sales", {
    method: "POST",
    headers: {
      authorization: "Bearer verified",
      "idempotency-key": key,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
describe("Venda: contrato HTTP; cálculo/rollback exercitados em p0-database.test.ts", () => {
  it("retorna apenas venda confirmada pela RPC e não aceita autoria do navegador", async () => {
    const res = await POST(
      req({ ...input(), agent_id: "forged", agent_name: "forged" }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.subtotal).toBe(39.5);
    expect(data.total_amount).toBe(35);
    expect(data.agent_id).toBe(user);
    const calls = state.calls.filter((c) =>
      c.url.pathname.endsWith("/record_sale"),
    );
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].options.body).p_input.agent_id).toBeUndefined();
    expect(calls[0].options.headers.Authorization).toBe("Bearer verified");
  });
  it("rejeita venda sem itens", async () => {
    expect((await POST(req({ ...input(), items: [] }))).status).toBe(400);
  });
  it("exige chave de idempotência", async () => {
    expect((await POST(req(input(), ""))).status).toBe(400);
  });
  it("não retorna 201 se RPC falhar", async () => {
    state.fail = "record_sale";
    expect((await POST(req())).status).toBe(503);
  });
  it("não retorna sucesso com resultado sem ID", async () => {
    state.sale.id = "";
    expect((await POST(req())).status).toBe(503);
  });
  it("nega organização forjada antes da RPC", async () => {
    expect(
      (
        await POST(
          req({
            ...input(),
            organization_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      state.calls.some((c) => c.url.pathname.endsWith("/record_sale")),
    ).toBe(false);
  });
  it("nega administrador técnico", async () => {
    state.role = "admin";
    expect((await POST(req())).status).toBe(403);
  });
});
