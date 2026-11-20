import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// One .env at the repo root serves web, worker and drizzle-kit.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  transpilePackages: ["@app/db", "@app/ui", "@app/compliance-data", "@app/reports"],
  // Evidence uploads (screenshots, recordings) are up to 10 MB; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  poweredByHeader: false,
  // The dev-only "N" badge sits on top of page content and confuses manual accessibility
  // checks. Build errors still show in the dev overlay.
  devIndicators: false,
};

export default nextConfig;
