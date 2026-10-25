import { defineConfig } from 'vitest/config';

/*
 * Simulations play millions of rounds and take minutes, so they run on their
 * own instead of with every `npm test`.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.sim.ts'],
    testTimeout: 30 * 60 * 1000,
  },
});
