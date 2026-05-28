import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests E2E : Node.js pur (pas de jsdom)
    environment: 'node',
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 180_000,
    hookTimeout: 45_000,
    // Un seul worker pour partager l'état du navigateur entre tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
