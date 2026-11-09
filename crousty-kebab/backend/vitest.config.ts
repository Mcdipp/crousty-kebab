import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Les tests partagent une base PostgreSQL : exécution séquentielle.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 20_000,
  },
});
