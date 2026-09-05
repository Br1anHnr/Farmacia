import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { database } from "./support/database";
it("reserva de webhook sobrevive ao fechamento e reabertura do PostgreSQL local", async () => {
  const root = path.resolve("node_modules");
  const dir = fs.mkdtempSync(path.join(root, ".p0-postgres-"));
  let db: PGlite | undefined;
  try {
    db = await database(dir);
    await db.query("SELECT public.reserve_webhook('durable-event','hash')");
    await db.query("SELECT public.finish_webhook('durable-event','completed')");
    await db.close();
    db = new PGlite(dir);
    expect(
      (
        await db.query<any>(
          "SELECT public.reserve_webhook('durable-event','hash') state",
        )
      ).rows[0].state,
    ).toBe("completed");
  } finally {
    await db?.close();
    const resolved = path.resolve(dir);
    if (
      path.dirname(resolved) !== root ||
      !path.basename(resolved).startsWith(".p0-postgres-")
    )
      throw new Error("Unsafe test cleanup");
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}, 30000);
