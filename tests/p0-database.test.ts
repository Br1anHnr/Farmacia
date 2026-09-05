import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import {
  database,
  asUser,
  saleInput,
  ana,
  manager,
  admin,
  org,
  branch,
  org2,
  branch2,
  user2,
  otherBranch,
  room,
} from "./support/database";
import fs from "node:fs";
let db: PGlite;
beforeAll(async () => {
  db = await database();
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("BEGIN");
});
afterEach(async () => {
  await db.exec("ROLLBACK");
});
async function sale(input: any = saleInput(), key = randomUUID()) {
  return (
    await db.query<{ result: any }>(
      "SELECT public.record_sale($1::jsonb,$2::uuid) AS result",
      [JSON.stringify(input), key],
    )
  ).rows[0].result;
}
async function count(table: string) {
  return Number(
    (await db.query<{ n: number }>("SELECT count(*) AS n FROM " + table))
      .rows[0].n,
  );
}
describe("PostgreSQL local: RLS/grants e transações reais (sem Supabase remoto)", () => {
  it.each([
    "sales",
    "sale_items",
    "audit_events",
    "internal_messages",
    "organization_members",
  ])("anon não possui SELECT em %s", async (table) => {
    await asUser(db, ana, "anon");
    await expect(
      db.query("SELECT * FROM public." + table),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("agente só vê suas vendas e nenhuma auditoria, mesmo com metadata manager", async () => {
    await asUser(db);
    expect(await count("public.sales")).toBe(1);
    expect(await count("public.audit_events")).toBe(0);
    expect(
      (await db.query<any>("SELECT * FROM public.sales")).rows.every(
        (r) => r.agent_id === ana,
      ),
    ).toBe(true);
  });
  it("gerente respeita filial vinculada; outra organização não aparece", async () => {
    await asUser(db, manager);
    const rows = (await db.query<any>("SELECT * FROM public.sales")).rows;
    expect(rows.length).toBe(1);
    expect(
      rows.every((r) => r.organization_id === org && r.branch_id === branch),
    ).toBe(true);
  });
  it("admin técnico não recebe acesso comercial automático", async () => {
    await asUser(db, admin);
    expect(await count("public.sales")).toBe(0);
    expect(await count("public.audit_events")).toBe(0);
  });
  it("gerente da segunda organização só vê sua organização", async () => {
    await asUser(db, user2);
    expect(
      (await db.query<any>("SELECT * FROM public.sales")).rows.every(
        (r) => r.organization_id === org2,
      ),
    ).toBe(true);
  });
  it("salas gerais exigem organização e vínculo explícito", async () => {
    await asUser(db);
    const rows = (await db.query<any>("SELECT * FROM public.internal_messages"))
      .rows;
    expect(rows.every((r) => r.room_id === room)).toBe(true);
  });
  it("não permite forjar remetente de chat", async () => {
    await asUser(db);
    await expect(
      db.query(
        "INSERT INTO public.internal_messages(room_id,sender_id,content) VALUES($1,$2,$3)",
        [room, manager, "forged"],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("mensagem autorizada persiste", async () => {
    await asUser(db);
    await db.query(
      "INSERT INTO public.internal_messages(room_id,sender_id,content) VALUES($1,$2,$3)",
      [room, ana, "local test"],
    );
    expect(await count("public.internal_messages")).toBeGreaterThan(0);
  });
  it.each([
    "organization_members",
    "branch_members",
    "internal_room_members",
    "sales",
    "sale_items",
    "audit_events",
  ])("nega gravação direta privilegiada em %s", async (table) => {
    await asUser(db);
    await expect(db.query("DELETE FROM public." + table)).rejects.toMatchObject(
      { code: "42501" },
    );
  });
  it("nega autoelevação por vínculo e alteração de organização", async () => {
    await asUser(db);
    await expect(
      db.query(
        "UPDATE public.organization_members SET role='manager' WHERE user_id=$1",
        [ana],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("venda, itens e auditoria persistem com autor real e precisão decimal", async () => {
    await asUser(db);
    const result = await sale({ ...saleInput(), agent_id: manager });
    expect(result.subtotal).toBe(39.5);
    expect(result.total_amount).toBe(35);
    expect(result.agent_id).toBe(ana);
    expect(result.items).toHaveLength(2);
    await db.exec("RESET ROLE");
    expect(
      Number(
        (
          await db.query<any>(
            "SELECT count(*) n FROM public.audit_events WHERE entity_id=$1",
            [result.id],
          )
        ).rows[0].n,
      ),
    ).toBe(1);
  });
  it("repetição retorna o mesmo ID e não duplica nenhuma escrita", async () => {
    await asUser(db);
    const key = randomUUID(),
      input = saleInput();
    const a = await sale(input, key),
      b = await sale(input, key);
    expect(a).toEqual(b);
    await db.exec("RESET ROLE");
    expect(await count("hub_private.sale_requests")).toBe(1);
  });
  it("mesma chave com payload diferente é conflito", async () => {
    await asUser(db);
    const key = randomUUID();
    await sale(saleInput(), key);
    await expect(
      sale({ ...saleInput(), discount: 1 }, key),
    ).rejects.toMatchObject({ code: "23505" });
  });
  it.each([
    { organization_id: org2, branch_id: branch2 },
    { branch_id: otherBranch },
    { chatwoot_conversation_id: 202 },
    { channel: "instagram" },
  ])("nega venda fora do vínculo/contexto %j", async (change) => {
    await asUser(db);
    await expect(sale({ ...saleInput(), ...change })).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("admin não pode chamar transação comercial", async () => {
    await asUser(db, admin);
    await expect(sale()).rejects.toMatchObject({ code: "42501" });
  });
  it("agente não pode registrar venda de conversa de outro usuário", async () => {
    await db.query(
      "UPDATE public.conversation_links SET assigned_user_id=$1 WHERE chatwoot_conversation_id=101 AND organization_id=$2",
      [manager, org],
    );
    await asUser(db);
    await expect(sale()).rejects.toMatchObject({ code: "42501" });
  });
  it.each(["sale_items", "audit_events"])(
    "falha em %s reverte cliente, venda, itens e auditoria juntos",
    async (table) => {
      await db.exec(
        `CREATE FUNCTION public.fail_test_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_FAILURE'; END $$; CREATE TRIGGER fail_test BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.fail_test_write();`,
      );
      const before = [
        await count("public.customers"),
        await count("public.sales"),
        await count("public.sale_items"),
        await count("public.audit_events"),
      ];
      await asUser(db);
      await db.exec("SAVEPOINT attempt");
      await expect(
        sale({ ...saleInput(), chatwoot_conversation_id: 303 }),
      ).rejects.toThrow("INJECTED_FAILURE");
      await db.exec("ROLLBACK TO SAVEPOINT attempt; RESET ROLE");
      expect([
        await count("public.customers"),
        await count("public.sales"),
        await count("public.sale_items"),
        await count("public.audit_events"),
      ]).toEqual(before);
      expect(await count("hub_private.sale_requests")).toBe(0);
    },
  );
  it.each([
    { discount: 40 },
    { discount: 0.001 },
    { items: [{ product_name: "A", quantity: 0, unit_price: 2 }] },
    { items: [] },
  ])("rejeita valores inválidos via RPC direto %j", async (change) => {
    await asUser(db);
    await expect(sale({ ...saleInput(), ...change })).rejects.toBeDefined();
  });
  it("usa arredondamento por item em decimal", async () => {
    await asUser(db);
    const a = await sale({
      ...saleInput(),
      discount: 0,
      items: [{ product_name: "Fraction", quantity: 1.005, unit_price: 1 }],
    });
    expect(a.total_amount).toBe(1.01);
  });
  it("não expõe funções definer em public nem concede RPC interno a usuários", async () => {
    expect(
      Number(
        (
          await db.query<any>(
            "SELECT count(*) n FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.prosecdef",
          )
        ).rows[0].n,
      ),
    ).toBe(0);
    await asUser(db);
    await expect(
      db.query("SELECT public.reserve_webhook('key','hash')"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("reserva durável nega duplicata e conflito; conclusão é explícita", async () => {
    await asUser(db, ana, "service_role");
    expect(
      (await db.query<any>("SELECT public.reserve_webhook('key','hash') state"))
        .rows[0].state,
    ).toBe("acquired");
    expect(
      (await db.query<any>("SELECT public.reserve_webhook('key','hash') state"))
        .rows[0].state,
    ).toBe("processing");
    expect(
      (
        await db.query<any>(
          "SELECT public.reserve_webhook('key','other') state",
        )
      ).rows[0].state,
    ).toBe("conflict");
    await db.query("SELECT public.finish_webhook('key','completed')");
    expect(
      (await db.query<any>("SELECT public.reserve_webhook('key','hash') state"))
        .rows[0].state,
    ).toBe("completed");
  });
  it("webhook sem telefone reaproveita identidade externa e não une homônimos", async () => {
    await asUser(db, ana, "service_role");
    const sync = async (id: number, contact: string) =>
      db.query(
        "SELECT public.sync_webhook($1,$2,1,$3,'instagram',$4,'Same name',null,false,null,null)",
        [org, branch, id, contact],
      );
    await sync(404, "contact1");
    await sync(405, "contact1");
    await sync(406, "contact2");
    await db.exec("RESET ROLE");
    const rows = (
      await db.query<any>(
        "SELECT customer_id FROM public.conversation_links WHERE chatwoot_conversation_id IN (404,405,406) ORDER BY chatwoot_conversation_id",
      )
    ).rows;
    expect(rows[0].customer_id).toBe(rows[1].customer_id);
    expect(rows[0].customer_id).not.toBe(rows[2].customer_id);
  });
});

it("executa também o roteiro SQL RLS existente, com grants mais restritos", async () => {
  await db.exec(
    fs
      .readFileSync("supabase/tests/rls_test.sql", "utf8")
      .replace("BEGIN;", "")
      .replace("ROLLBACK;", ""),
  );
});
it("restrição de filial/organização também protege escrita de serviço", async () => {
  await expect(
    db.query(
      "INSERT INTO public.internal_rooms(organization_id,branch_id,name) VALUES($1,$2,$3)",
      [org, branch2, "invalid"],
    ),
  ).rejects.toMatchObject({ code: "23503" });
});
it("claim obtém identidade do banco e não duplica sua auditoria no retry", async () => {
  await db.query(
    "UPDATE public.conversation_links SET assigned_user_id=null,chatwoot_assignee_id=null WHERE organization_id=$1 AND chatwoot_conversation_id=303",
    [org],
  );
  await asUser(db);
  const a = await db.query<any>(
    "SELECT public.claim_conversation($1,303) result",
    [org],
  );
  const b = await db.query<any>(
    "SELECT public.claim_conversation($1,303) result",
    [org],
  );
  expect(a.rows[0].result).toEqual(b.rows[0].result);
  expect(a.rows[0].result.user_id).toBe(ana);
});
it("chamadas simultâneas com a mesma chave retornam uma única venda (conexão PGlite serializada)", async () => {
  await asUser(db);
  const key = randomUUID();
  const values = await Promise.all([
    sale(saleInput(), key),
    sale(saleInput(), key),
  ]);
  expect(values[0].id).toBe(values[1].id);
});

it("RPC de venda não recebe grants anon/service_role e recibos são internos", async () => {
  const rows = (
    await db.query<any>(
      "SELECT has_function_privilege('anon','public.record_sale(jsonb,uuid)','EXECUTE') a,has_function_privilege('service_role','public.record_sale(jsonb,uuid)','EXECUTE') s,has_function_privilege('authenticated','public.reserve_webhook(text,text)','EXECUTE') h",
    )
  ).rows;
  expect(rows[0]).toEqual({ a: false, s: false, h: false });
});
