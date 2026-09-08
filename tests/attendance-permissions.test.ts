import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { database, asUser, org, branch, ana, manager, carla } from "./support/database";
let db: PGlite;
beforeAll(async () => { db = await database(); });
afterAll(async () => { await db?.close(); });

it("atendente lê a fila da filial e transfere conversa de outro responsável; outras filiais continuam isoladas", async () => {
  await db.exec("BEGIN");
  try {
    await db.query("INSERT INTO branch_members(branch_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [branch, carla]);
    await db.query("UPDATE conversation_links SET assigned_user_id=$1 WHERE organization_id=$2 AND chatwoot_conversation_id=101", [manager, org]);
    await asUser(db, ana);
    expect((await db.query("SELECT id FROM conversation_links WHERE chatwoot_conversation_id=101")).rows).toHaveLength(1);
    expect((await db.query("SELECT id FROM conversation_links WHERE chatwoot_conversation_id=202")).rows).toHaveLength(0);
    const moved = await db.query<{ result: { transferred: boolean } }>("SELECT public.complete_conversation_transfer($1,1,101,$2,$3,null) result", [org, carla, branch]);
    expect(moved.rows[0].result.transferred).toBe(true);
    await db.exec("RESET ROLE");
    const audit = await db.query<{ actor_id: string }>("SELECT actor_id FROM audit_events WHERE action='CONVERSATION_TRANSFERRED' ORDER BY created_at DESC LIMIT 1");
    expect(audit.rows[0].actor_id).toBe(ana);
  } finally { await db.exec("ROLLBACK"); }
});
