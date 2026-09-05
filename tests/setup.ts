import { beforeEach, afterEach, vi } from "vitest";
// All tests are local. Never read .env, never use live credentials.
process.env.SUPABASE_URL = "https://supabase.invalid";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable";
process.env.SUPABASE_SECRET_KEY = "test-service";
process.env.CHATWOOT_BASE_URL = "https://chatwoot.invalid";
process.env.CHATWOOT_API_TOKEN = "test-token";
process.env.CHATWOOT_ACCOUNT_ID = "1";
process.env.MOCK_MODE = "true";
process.env.APP_ORIGIN = "http://localhost:3000";
beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("NETWORK_DISABLED_IN_TESTS");
    }),
  ),
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
