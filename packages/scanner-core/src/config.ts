import { z } from "zod";

/** Viewports from spec §7.2. */
export const VIEWPORTS = {
  desktop: { width: 1366, height: 768 },
  mobile: { width: 390, height: 844 },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;
export const VIEWPORT_NAMES = Object.keys(VIEWPORTS) as ViewportName[];

const pattern = z.string().trim().min(1).max(200);

/** Per-property crawl configuration, stored as JSON in `properties.scan_config`. */
export const scanConfigSchema = z.object({
  maxPages: z.number().int().min(1).max(10_000).default(200),
  maxDepth: z.number().int().min(0).max(20).default(5),
  /** Glob patterns matched against the URL path + query. Empty include = everything. */
  include: z.array(pattern).max(50).default([]),
  exclude: z.array(pattern).max(50).default([]),
  queryStrings: z.enum(["strip", "keep"]).default("strip"),
  /** Can only be turned off for verified domains (enforced where scans are started). */
  respectRobots: z.boolean().default(true),
  waitSelector: z.string().trim().max(200).nullable().default(null),
  viewports: z
    .array(z.enum(["desktop", "mobile"]))
    .min(1)
    .default(["desktop", "mobile"]),
});

export type ScanConfig = z.infer<typeof scanConfigSchema>;

export const DEFAULT_SCAN_CONFIG: ScanConfig = scanConfigSchema.parse({});

/** Tolerant read of stored config: unknown/invalid shapes fall back to defaults. */
export function readScanConfig(stored: unknown): ScanConfig {
  const parsed = scanConfigSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : DEFAULT_SCAN_CONFIG;
}

/** Identifiable crawler user-agent (spec §16). */
export function botUserAgent(appUrl: string): string {
  return `A11yComplyBot/1.0 (+${appUrl.replace(/\/+$/, "")}/bot)`;
}

export const BOT_ROBOTS_TOKEN = "a11ycomplybot";
