import { defineConfig } from "vitest/config";

// PDF rendering and veraPDF validation take a few seconds per report.
export default defineConfig({ test: { testTimeout: 120_000, hookTimeout: 120_000 } });
