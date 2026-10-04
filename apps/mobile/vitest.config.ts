import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'], pool: 'forks', maxWorkers: 1, minWorkers: 1, restoreMocks: true },
});
