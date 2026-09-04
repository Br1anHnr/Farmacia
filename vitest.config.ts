import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'apps/**/src/**/__tests__/**/*.test.ts',
      'packages/**/src/**/__tests__/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@hub-farmacia/contracts': path.resolve(__dirname, 'packages/contracts/src/index.ts'),
      '@hub-farmacia/ui': path.resolve(__dirname, 'packages/ui/src/index.ts'),
      '@': path.resolve(__dirname, 'apps/web/src'),
    },
  },
});
