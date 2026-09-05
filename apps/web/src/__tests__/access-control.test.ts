import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/dashboard/summary/route";
import { GET as audit } from "../app/api/audit/route";
import { middleware } from "../middleware";
const user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const org = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const branch = "cccccccc-cccc-cccc-cccc-cccccccccccc";
let role: string,
  rows: any[],
  fail: string,
  members: any[],
  branches: any[],
  calls: URL[],
  count: number | undefined;
function request(
  path = "/api/dashboard/summary",
  headers: Record<string, string> = {
    cookie: "sb_access_token=verified; mf_user_role=manager",
  },
) {
  return new NextRequest("http://localhost:3000" + path, { headers });
}
beforeEach(() => {
  role = "manager";
  rows = [];
  fail = "";
  members = [{ organization_id: org }];
  branches = [{ branch_id: branch }];
  calls = [];
  count = undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      calls.push(url);
      const table = url.pathname.split("/").pop()!;
      if (fail === table)
        return new Response("{}", { status: table === "user" ? 401 : 503 });
      let data: any;
      if (table === "user")
        data = { id: user, user_metadata: { role: "manager" } };
      else if (table === "organization_members")
        data = members.map((m) => ({ ...m, role }));
      else if (table === "branch_members") data = branches;
      else if (table === "branches") data = [{ id: branch }];
      else if (table === "sales" || table === "audit_events") data = rows;
      else throw new Error("Unexpected HTTP request: " + table);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "content-range":
            "0-0/" + (table === "branches" ? 1 : (count ?? rows.length)),
        },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("Gerência: testes HTTP simulados, sem homologação de Supabase/RLS", () => {
  it.each([GET, audit])(
    "rejeita cabeçalho e cookie de papel sem sessão",
    async (handler) => {
      expect(
        (
          await handler(
            request(undefined, {
              "x-user-role": "manager",
              cookie: "mf_user_role=manager",
            }),
          )
        ).status,
      ).toBe(401);
      expect(calls).toHaveLength(0);
    },
  );
  it("rejeita token expirado antes de consultar dados", async () => {
    fail = "user";
    expect((await GET(request())).status).toBe(401);
    expect(calls).toHaveLength(1);
  });
  it.each(["agent", "admin", "viewer"])(
    "rejeita %s mesmo com papel manager forjado",
    async (actual) => {
      role = actual;
      expect((await GET(request())).status).toBe(403);
      expect(calls.some((c) => c.pathname.endsWith("/sales"))).toBe(false);
    },
  );
  it("nega vínculo inexistente ou ambíguo", async () => {
    members = [];
    expect((await GET(request())).status).toBe(403);
    members = [{ organization_id: org }, { organization_id: org }];
    expect((await GET(request())).status).toBe(403);
  });
  it("não concede unidade padrão", async () => {
    branches = [];
    expect((await GET(request())).status).toBe(403);
  });
  it("falha fechada quando vínculos estão indisponíveis", async () => {
    fail = "organization_members";
    expect((await GET(request())).status).toBe(503);
  });
  it("consulta organização e unidades autorizadas; vazio não vira demonstração", async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_revenue).toBe(0);
    expect(body.top_products).toEqual([]);
    expect(body.sales_by_branch).toEqual([]);
    expect(body.conversion_rate).toBeNull();
    expect(body.total_conversations).toBeNull();
    const q = calls.find((c) => c.pathname.endsWith("/sales"))!.searchParams;
    expect(q.get("organization_id")).toBe("eq." + org);
    expect(q.get("branch_id")).toBe("in.(" + branch + ")");
    const b = calls.find((c) =>
      c.pathname.endsWith("/branch_members"),
    )!.searchParams;
    expect(b.get("user_id")).toBe("eq." + user);
    expect(b.get("branches.organization_id")).toBe("eq." + org);
  });
  it("nega filtro de filial não vinculada", async () => {
    expect(
      (await GET(request("/api/dashboard/summary?branch=other"))).status,
    ).toBe(403);
  });
  it("aplica período, canal e filial no backend", async () => {
    expect(
      (
        await GET(
          request(
            "/api/dashboard/summary?period=7d&channel=instagram&branch=" +
              branch,
          ),
        )
      ).status,
    ).toBe(200);
    const q = calls.find((c) => c.pathname.endsWith("/sales"))!.searchParams;
    expect(q.get("confirmed_at")).toMatch(/^gte./);
    expect(q.get("channel")).toBe("eq.instagram");
    expect(q.get("branch_id")).toBe("eq." + branch);
  });
  it("não transforma erro ou paginação incompleta em totais", async () => {
    fail = "sales";
    expect((await GET(request())).status).toBe(503);
    fail = "";
    count = 2;
    expect((await GET(request())).status).toBe(503);
  });
  it("soma apenas registros fornecidos e não inventa nomes/produtos", async () => {
    rows = [
      {
        total_amount: "12.50",
        branch_id: branch,
        agent_id: user,
        channel: "instagram",
        fulfillment_method: "pickup",
        sale_items: [],
      },
    ];
    const body = await (await GET(request())).json();
    expect(body.total_revenue).toBe(12.5);
    expect(body.average_ticket).toBe(12.5);
    expect(body.top_products).toEqual([]);
  });
  it("auditoria vazia e falha são distintas; aplica organização", async () => {
    expect(await (await audit(request())).json()).toEqual({ logs: [] });
    expect(
      calls
        .find((c) => c.pathname.endsWith("/audit_events"))!
        .searchParams.get("organization_id"),
    ).toBe("eq." + org);
    fail = "audit_events";
    expect((await audit(request())).status).toBe(503);
  });
  it("auditoria nega gerente sem vínculo com todas as unidades do legado", async () => {
    branches = [{ branch_id: "dddddddd-dddd-dddd-dddd-dddddddddddd" }];
    expect((await audit(request())).status).toBe(403);
    expect(calls.some((c) => c.pathname.endsWith("/audit_events"))).toBe(false);
  });
  it("middleware valida sessão, redireciona e rejeita papel forjado", async () => {
    const res = await middleware(
      request("/dashboard", { "x-user-role": "manager" }),
    );
    expect(res.headers.get("location")).toContain(
      "/login?redirect=%2Fdashboard",
    );
    role = "agent";
    expect(
      (await middleware(request("/dashboard"))).headers.get("location"),
    ).toContain("/access-denied");
    role = "manager";
    expect((await middleware(request("/dashboard"))).status).toBe(200);
  });
});
