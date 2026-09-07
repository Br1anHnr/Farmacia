import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { database, asUser, org, branch, ana, manager, bruno, otherBranch } from "./support/database";
let db: PGlite;
beforeAll(async () => {
  db = await database();
  await db.query("INSERT INTO public.chatwoot_operation_settings VALUES ($1,1,1)", [org]);
});
afterAll(async () => { await db?.close(); });

it("transfere no Hub sem agente pessoal e o webhook não troca o responsável ou filial", async () => {
  await db.exec("BEGIN");
  await asUser(db, manager);
  const moved = await db.query<{ result: { agent_id: number } }>(
    "SELECT public.complete_conversation_transfer($1,1,101,$2,$3,null) result", [org, bruno, otherBranch]);
  expect(moved.rows[0].result.agent_id).toBe(1);
  await db.exec("RESET ROLE");
  await db.query("SELECT public.sync_webhook($1,$2,1,101,'whatsapp',null,null,null,true,null,1)", [org,branch]);
  const owner = await db.query("SELECT assigned_user_id,branch_id FROM public.conversation_links WHERE organization_id=$1 AND chatwoot_account_id=1 AND chatwoot_conversation_id=101", [org]);
  expect(owner.rows[0]).toEqual({ assigned_user_id: bruno, branch_id: otherBranch });
  await asUser(db, ana);
  expect((await db.query("SELECT id FROM public.conversation_links WHERE chatwoot_conversation_id=101")).rows).toHaveLength(0);
  await asUser(db, bruno);
  const closed = await db.query<{ result: { persisted: boolean } }>("SELECT public.close_conversation($1::jsonb,gen_random_uuid()) result", [JSON.stringify({organization_id:org,branch_id:otherBranch,chatwoot_account_id:1,chatwoot_conversation_id:101,channel:'whatsapp',outcome:'not_sold',reason:'price'})]);
  expect(closed.rows[0].result.persisted).toBe(true);
  await db.exec("ROLLBACK");
});

it("permite assumir conversa sem dono do Hub que já usa MultiFarma no Chatwoot", async () => {
  await db.exec("BEGIN");
  await db.query("UPDATE public.conversation_links SET assigned_user_id=null,chatwoot_assignee_id=1 WHERE organization_id=$1 AND chatwoot_conversation_id=303", [org]);
  await asUser(db, ana);
  const claimed = await db.query<{ result: { agent_id: number } }>("SELECT public.claim_conversation($1,1,303) result", [org]);
  expect(claimed.rows[0].result.agent_id).toBe(1);
  await db.exec("ROLLBACK");
});
