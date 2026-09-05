import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
export const org = "11111111-1111-1111-1111-111111111111",
  branch = "22222222-2222-2222-2222-222222222221",
  otherBranch = "22222222-2222-2222-2222-222222222222";
export const ana = "33333333-3333-3333-3333-333333333332",
  manager = "33333333-3333-3333-3333-333333333331",
  bruno = "33333333-3333-3333-3333-333333333333",
  admin = "33333333-3333-3333-3333-333333333335";
export const org2 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  branch2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  user2 = "cccccccc-cccc-cccc-cccc-cccccccccccc";
export const room = "77777777-7777-7777-7777-777777777771";
export async function database(dataDir?: string) {
  const db = new PGlite(dataDir);
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;`);
  for (const f of fs.readdirSync("supabase/migrations").sort())
    await db.exec(
      fs
        .readFileSync("supabase/migrations/" + f, "utf8")
        .replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', ""),
    );
  await db.exec(fs.readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`UPDATE public.conversation_links SET chatwoot_account_id=1,assigned_user_id='${ana}',chatwoot_assignee_id=7;
 UPDATE public.audit_events SET branch_id='${branch}';
 INSERT INTO public.chatwoot_agents VALUES('${ana}','${org}',1,7),('${manager}','${org}',1,8);
 INSERT INTO public.organizations(id,name,slug) VALUES('${org2}','Other organization','other-org');
 INSERT INTO public.branches(id,organization_id,name,code,city) VALUES('${branch2}','${org2}','Other branch','OTHER','Test');
 INSERT INTO public.profiles(id,full_name,email) VALUES('${user2}','Other manager','other@example.invalid');
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES('${org2}','${user2}','manager');
 INSERT INTO public.branch_members(branch_id,user_id) VALUES('${branch2}','${user2}');
 INSERT INTO public.conversation_links(organization_id,branch_id,chatwoot_conversation_id,channel,assigned_user_id,chatwoot_account_id) VALUES
 ('${org2}','${branch2}',101,'whatsapp','${user2}',2),('${org}','${otherBranch}',202,'whatsapp','${bruno}',1),('${org}','${branch}',303,'whatsapp','${ana}',1);
 INSERT INTO public.internal_rooms(id,organization_id,name,is_general) VALUES('dddddddd-dddd-dddd-dddd-dddddddddddd','${org2}','Other general',true);
 INSERT INTO public.internal_room_members(room_id,user_id) VALUES('${room}','${ana}') ON CONFLICT DO NOTHING;
 INSERT INTO public.internal_messages(room_id,sender_id,content) VALUES('dddddddd-dddd-dddd-dddd-dddddddddddd','${user2}','Other organization secret');
 INSERT INTO public.sales(organization_id,branch_id,chatwoot_conversation_id,agent_id,total_amount,status) VALUES('${org2}','${branch2}',101,'${user2}',100,'confirmed'),('${org}','${otherBranch}',202,'${bruno}',50,'confirmed');`);
  return db;
}
export async function asUser(db: PGlite, id = ana, role = "authenticated") {
  await db.exec("SET LOCAL ROLE " + role);
  await db.query("SELECT set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: id, role, user_metadata: { role: "manager" } }),
  ]);
}
export const saleInput = () => ({
  organization_id: org,
  branch_id: branch,
  chatwoot_conversation_id: 101,
  channel: "whatsapp",
  customer_name: "Synthetic customer",
  items: [
    { product_name: "A", quantity: 2, unit_price: 8.5 },
    { product_name: "B", quantity: 1, unit_price: 22.5 },
  ],
  discount: 4.5,
  fulfillment_method: "delivery",
  origin_type: "manual",
});
