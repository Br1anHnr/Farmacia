import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { ana, asUser, bruno, database, manager, org, room } from "./support/database";

let db: PGlite;
beforeAll(async () => {
  db = await database();
});
afterAll(async () => {
  await db?.close();
});

describe("Provisionamento e isolamento das salas internas", () => {
  it("permite retry idempotente com grants/RLS existentes sem UPDATE", async () => {
    await db.exec("BEGIN");
    try {
      await asUser(db, ana);
      const insert = "INSERT INTO public.internal_messages(id,room_id,sender_id,content) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id";
      const parameters = ["12345678-1234-4234-8234-123456789abc", room, ana, "Retry teste"];
      expect((await db.query(insert, parameters)).rows).toHaveLength(1);
      expect((await db.query(insert, parameters)).rows).toHaveLength(0);
      expect((await db.query("SELECT id FROM public.internal_messages WHERE id=$1", [parameters[0]])).rows).toHaveLength(1);
    } finally { await db.exec("ROLLBACK"); }
  });
  it("cria a sala geral e as três salas das filiais", async () => {
    const result = await db.query<{ name: string; is_general: boolean }>(
      "SELECT name,is_general FROM public.internal_rooms WHERE organization_id=$1 ORDER BY is_general DESC,name",
      [org],
    );
    expect(result.rows).toHaveLength(4);
    expect(result.rows.filter((room) => room.is_general)).toHaveLength(1);
    expect(result.rows.map((room) => room.name)).toEqual(expect.arrayContaining([
      "Sala Geral",
      "Equipe — Guaratinguetá — Unidade 1",
      "Equipe — Guaratinguetá — Unidade 2",
      "Equipe — Potim — Unidade 1",
    ]));
  });

  it("inclui todos na geral e limita salas locais aos membros da filial", async () => {
    await db.exec("BEGIN");
    await asUser(db, ana);
    const anaRooms = await db.query<{ name: string }>("SELECT name FROM public.internal_rooms ORDER BY name");
    await db.exec("ROLLBACK");

    await db.exec("BEGIN");
    await asUser(db, bruno);
    const brunoRooms = await db.query<{ name: string }>("SELECT name FROM public.internal_rooms ORDER BY name");
    await db.exec("ROLLBACK");

    expect(anaRooms.rows.map((room) => room.name)).toEqual([
      "Equipe — Guaratinguetá — Unidade 1",
      "Sala Geral",
    ]);
    expect(brunoRooms.rows.map((room) => room.name)).toEqual([
      "Equipe — Guaratinguetá — Unidade 2",
      "Sala Geral",
    ]);
  });

  it("mantém os vínculos de sala idempotentes", async () => {
    const before = await db.query<{ count: number }>(
      "SELECT count(*) AS count FROM public.internal_room_members",
    );
    await db.query("SELECT hub_private.ensure_multifarma_internal_rooms($1)", [org]);
    await db.query("SELECT hub_private.ensure_multifarma_internal_rooms($1)", [org]);
    const after = await db.query<{ count: number }>(
      "SELECT count(*) AS count FROM public.internal_room_members",
    );
    expect(Number(after.rows[0].count)).toBe(Number(before.rows[0].count));
  });

  it("reconcilia filiais legadas sem trocar IDs nem perder o acesso do gerente", async () => {
    await db.exec("BEGIN");
    await db.exec(`
      DELETE FROM public.branches
      WHERE id = '22222222-2222-2222-2222-222222222223';
      UPDATE public.branches
      SET name = 'MultiFarma Matriz Centro', code = 'MTZ-01', city = 'Guaratinguetá'
      WHERE id = '22222222-2222-2222-2222-222222222221';
      UPDATE public.branches
      SET name = 'MultiFarma Filial Jardins', code = 'JRD-02', city = 'Guaratinguetá'
      WHERE id = '22222222-2222-2222-2222-222222222222';
    `);

    await db.query("SELECT hub_private.configure_multifarma_branches($1)", [org]);
    await db.query("SELECT hub_private.ensure_multifarma_internal_rooms($1)", [org]);

    const branches = await db.query<{ id: string; name: string; code: string }>(
      "SELECT id,name,code FROM public.branches WHERE organization_id=$1 ORDER BY code",
      [org],
    );
    const managerBranches = await db.query<{ count: number }>(
      "SELECT count(*) AS count FROM public.branch_members WHERE user_id=$1",
      [manager],
    );
    const rooms = await db.query<{ count: number }>(
      "SELECT count(*) AS count FROM public.internal_rooms WHERE organization_id=$1",
      [org],
    );
    await db.exec("ROLLBACK");

    expect(branches.rows).toEqual([
      {
        id: "22222222-2222-2222-2222-222222222221",
        name: "Guaratinguetá — Unidade 1",
        code: "GUA-01",
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Guaratinguetá — Unidade 2",
        code: "GUA-02",
      },
      {
        id: "22222222-2222-2222-2222-222222222223",
        name: "Potim — Unidade 1",
        code: "POT-01",
      },
    ]);
    expect(Number(managerBranches.rows[0].count)).toBe(3);
    expect(Number(rooms.rows[0].count)).toBe(4);
  });

  it("gerente participa da geral e de todas as filiais autorizadas", async () => {
    await db.exec("BEGIN");
    await asUser(db, manager);
    const result = await db.query<{ count: number }>("SELECT count(*) AS count FROM public.internal_rooms");
    await db.exec("ROLLBACK");
    expect(Number(result.rows[0].count)).toBe(4);
  });
});
