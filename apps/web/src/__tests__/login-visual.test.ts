import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Tela de acesso operacional", () => {
  const page = fs.readFileSync(path.resolve("apps/web/src/app/login/page.tsx"), "utf8");
  const form = fs.readFileSync(path.resolve("apps/web/src/app/login/login-form.tsx"), "utf8");

  it("usa DEMO_MODE no servidor e não expõe senha de homologação", () => {
    expect(page).toContain('process.env.DEMO_MODE === "true"');
    expect(form).not.toMatch(/MultiFarma@|password:\s*["'][^"']+/);
    expect(form).not.toContain("NEXT_PUBLIC_DEMO_MODE");
  });

  it("remove linguagem técnica da experiência de login", () => {
    expect(page + form).not.toMatch(/Supabase|JWT|RBAC|RLS|PostgreSQL/);
    expect(form).toContain("bg-red-600");
    expect(form).toContain("bg-white");
  });
});
