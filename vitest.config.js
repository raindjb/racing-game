import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/unit/core-logic.test.js'],  // legacy: uses Node assert, different game
    testTimeout: 5000,
    reporters: ['default'],
  },
});
