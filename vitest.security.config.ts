import { defineConfig } from "vitest/config";
import path from "node:path";
// Deliberately never load .env: security regression uses simulated HTTP only.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["apps/web/src/__tests__/access-control.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve("apps/web/src"),
      "@hub-farmacia/contracts": path.resolve(
        "packages/contracts/src/index.ts",
      ),
    },
  },
});
