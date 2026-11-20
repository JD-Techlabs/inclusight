import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each test file applies all migrations to an in-memory Postgres (PGlite) in beforeAll,
    // which can exceed the 10 s default on a busy machine or CI runner.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
