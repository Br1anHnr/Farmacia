import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import {
  ana,
  asUser,
  database,
  org,
  branch,
  saleInput,
} from "./support/database";

let db: PGlite;
beforeAll(async () => {
  db = await database();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("BEGIN");
});
afterEach(async () => {
  await db.exec("ROLLBACK");
});

async function close(input: Record<string, unknown>, key = randomUUID()) {
  return (
    await db.query<{ result: any }>(
      "SELECT public.close_conversation($1::jsonb,$2::uuid) AS result",
      [JSON.stringify(input), key],
    )
  ).rows[0].result;
}

const context = {
  organization_id: org,
  branch_id: branch,
  chatwoot_conversation_id: 101,
  channel: "whatsapp",
};

describe("Persistência transacional do encerramento", () => {
  it.each(["resolved", "cancelled"])(
    "encerra como %s e registra auditoria",
    async (outcome) => {
      await asUser(db, ana);
      const result = await close({ ...context, outcome });
      expect(result).toMatchObject({ persisted: true, outcome });
      await db.exec("RESET ROLE");
      const conversation = await db.query<{ status: string }>(
        "SELECT status FROM public.conversation_links WHERE organization_id=$1 AND chatwoot_conversation_id=101",
        [org],
      );
      expect(conversation.rows[0].status).toBe(`closed_${outcome}`);
      const audit = await db.query<{ n: number }>(
        "SELECT count(*) AS n FROM public.audit_events WHERE entity_type='conversation' AND entity_id='101' AND metadata->>'outcome'=$1",
        [outcome],
      );
      expect(Number(audit.rows[0].n)).toBe(1);
    },
  );

  it("rejeita não venda sem motivo", async () => {
    await asUser(db, ana);
    await expect(close({ ...context, outcome: "not_sold" })).rejects.toMatchObject({
      code: "22023",
    });
  });

  it("persiste o motivo de não venda", async () => {
    await asUser(db, ana);
    const result = await close({ ...context, outcome: "not_sold", reason: "price" });
    expect(result).toMatchObject({ persisted: true, outcome: "not_sold", reason: "price" });
    await db.exec("RESET ROLE");
    const audit = await db.query<{ reason: string }>(
      "SELECT metadata->>'reason' AS reason FROM public.audit_events WHERE entity_type='conversation' AND entity_id='101' ORDER BY created_at DESC LIMIT 1",
    );
    expect(audit.rows[0].reason).toBe("price");
  });

  it("salva venda, itens, encerramento e auditorias juntos", async () => {
    await asUser(db, ana);
    const result = await close({ ...saleInput(), outcome: "sale" });
    expect(result.persisted).toBe(true);
    expect(result.sale_id).toMatch(/^[0-9a-f-]{36}$/);
    await db.exec("RESET ROLE");
    const rows = await db.query<{ sales: number; items: number; audits: number; status: string }>(
      `SELECT
        (SELECT count(*) FROM public.sales WHERE id=$1::uuid) AS sales,
        (SELECT count(*) FROM public.sale_items WHERE sale_id=$1::uuid) AS items,
        (SELECT count(*) FROM public.audit_events WHERE entity_id IN ($1::text,'101')) AS audits,
        (SELECT status FROM public.conversation_links WHERE organization_id=$2 AND chatwoot_conversation_id=101) AS status`,
      [result.sale_id, org],
    );
    expect(Number(rows.rows[0].sales)).toBe(1);
    expect(Number(rows.rows[0].items)).toBe(2);
    expect(Number(rows.rows[0].audits)).toBe(2);
    expect(rows.rows[0].status).toBe("closed_sale");
  });

  it("desfaz venda e itens quando o encerramento não conclui", async () => {
    const before = await db.query<{ sales: number; items: number }>(
      "SELECT (SELECT count(*) FROM public.sales) AS sales, (SELECT count(*) FROM public.sale_items) AS items",
    );
    await db.exec(`
      CREATE FUNCTION pg_temp.fail_closure_audit() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.action = 'CONVERSATION_CLOSED_WITH_SALE' THEN
          RAISE EXCEPTION 'SIMULATED_CLOSURE_FAILURE';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fail_closure_audit
      BEFORE INSERT ON public.audit_events
      FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_closure_audit();
    `);
    await asUser(db, ana);
    await db.exec("SAVEPOINT closure_attempt");
    await expect(close({ ...saleInput(), outcome: "sale" })).rejects.toThrow(
      "SIMULATED_CLOSURE_FAILURE",
    );
    await db.exec("ROLLBACK TO SAVEPOINT closure_attempt");
    await db.exec("RESET ROLE");
    const after = await db.query<{ sales: number; items: number; status: string }>(
      `SELECT
        (SELECT count(*) FROM public.sales) AS sales,
        (SELECT count(*) FROM public.sale_items) AS items,
        (SELECT status FROM public.conversation_links WHERE organization_id=$1 AND chatwoot_conversation_id=101) AS status`,
      [org],
    );
    expect(Number(after.rows[0].sales)).toBe(Number(before.rows[0].sales));
    expect(Number(after.rows[0].items)).toBe(Number(before.rows[0].items));
    expect(after.rows[0].status).toBe("open");
  });

  it("repete a mesma chave sem duplicar o encerramento", async () => {
    await asUser(db, ana);
    const key = randomUUID();
    const input = { ...context, outcome: "resolved" };
    expect(await close(input, key)).toEqual(await close(input, key));
    await db.exec("RESET ROLE");
    const requests = await db.query<{ n: number }>(
      "SELECT count(*) AS n FROM hub_private.conversation_close_requests",
    );
    expect(Number(requests.rows[0].n)).toBe(1);
  });
});
