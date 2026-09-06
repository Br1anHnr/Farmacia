import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  adminSupabaseHeaders,
  userSupabaseHeaders,
} from "../../../../packages/supabase-http/index.mjs";
import {
  supabaseAdminRest,
  supabaseRest,
} from "../lib/server/supabase";

const publishable = "sb_publishable_test_public";
const secret = "sb_secret_test_server_only";
const jwt = "header.payload.signature";

function successfulFetch() {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [target] : [];
  });
}

describe("Credenciais Supabase no backend", () => {
  beforeEach(() => {
    process.env.SUPABASE_PUBLISHABLE_KEY = publishable;
    process.env.SUPABASE_SECRET_KEY = secret;
  });

  it("usa publishable em apikey e JWT do usuário como Bearer nas chamadas RLS", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    expect((await supabaseRest("products", { accessToken: jwt })).error).toBeNull();
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.apikey).toBe(publishable);
    expect(headers.Authorization).toBe(`Bearer ${jwt}`);
    expect(JSON.stringify(headers)).not.toContain(secret);
  });

  it("usa secret somente em apikey nas chamadas administrativas do servidor", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    expect((await supabaseAdminRest("customers")).error).toBeNull();
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.apikey).toBe(secret);
    expect(headers.Authorization).toBeUndefined();
  });

  it("mantém a secret fora de módulos e componentes do cliente", () => {
    const webSource = path.resolve(process.cwd(), "apps/web/src");
    const clientLeaks = sourceFiles(webSource).filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return (
        /^\s*["']use client["']/m.test(source) &&
        (source.includes("SUPABASE_SECRET_KEY") ||
          source.includes("lib/server/supabase"))
      );
    });
    expect(clientLeaks).toEqual([]);
  });

  it("rejeita sb_secret como Bearer e bloqueia sobrescrita de credenciais", () => {
    expect(() => userSupabaseHeaders(publishable, secret)).toThrow(
      "SUPABASE_API_KEY_NOT_ALLOWED_AS_BEARER",
    );
    expect(() =>
      adminSupabaseHeaders(secret, { Authorization: `Bearer ${secret}` }),
    ).toThrow("SUPABASE_CREDENTIAL_HEADER_OVERRIDE_DENIED");
  });
});
