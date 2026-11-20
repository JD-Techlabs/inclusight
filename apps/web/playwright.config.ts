import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;
const reuse = !process.env.CI;

/**
 * E2E + accessibility tests for our own UI. Requires the local infra
 * (`docker compose -f infra/docker-compose.yml up -d`), applied migrations, and
 * SCANNER_ALLOW_PRIVATE_HOSTS=true so the scanner may reach the fixture site on localhost.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 180_000,
  // The dev server compiles each route on first visit, so assertions get a generous timeout.
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm dev",
      url: `${baseURL}/api/health`,
      reuseExistingServer: reuse,
      timeout: 180_000,
    },
    {
      command: "pnpm start",
      cwd: "../worker",
      url: "http://127.0.0.1:4101/health",
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      command: "node fixtures/server.mjs",
      cwd: "../..",
      url: "http://localhost:4100/health",
      reuseExistingServer: reuse,
      timeout: 30_000,
    },
  ],
});
