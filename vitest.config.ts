import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Carrega variáveis do arquivo .env para o ambiente de testes
if (fs.existsSync('.env')) {
  const content = fs.readFileSync('.env', 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}

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
