import { ISSUE_STATUSES, STATUSES_REQUIRING_REASON } from "@app/db/domain";
import { normaliseUrl, scanConfigSchema, type ScanConfig } from "@app/scanner-core/pure";
import { z } from "zod";

const PRIVATE_HOST =
  /^(localhost|.*\.localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0|\[.*\])$/i;

/** Validates and normalises a property's base URL. Returns an error message or the URL. */
export function parseBaseUrl(
  input: string,
  options: { allowPrivateHosts: boolean },
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = normaliseUrl(withScheme, undefined, { queryStrings: "keep" });
  if (!url || trimmed.length > 500) {
    return { ok: false, error: "Enter a website address such as https://www.example.com" };
  }
  const host = new URL(url).hostname;
  if (!host.includes(".") && !options.allowPrivateHosts) {
    return { ok: false, error: "Enter a public website address with a domain name." };
  }
  if (PRIVATE_HOST.test(host) && !options.allowPrivateHosts) {
    return { ok: false, error: "Local and private network addresses cannot be scanned." };
  }
  return { ok: true, url };
}

export const createPropertySchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120, "Use 120 characters or fewer."),
  baseUrl: z.string().trim().min(1, "Enter the website address."),
  isInvestorFacing: z.boolean(),
});

const lines = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Reads the scan-settings form. Robots.txt can only be ignored for verified domains, and the
 * page cap is clamped to the current limit.
 */
export function parseScanSettings(
  form: FormData,
  options: { verified: boolean; maxPagesLimit: number },
): { ok: true; config: ScanConfig } | { ok: false; errors: Record<string, string> } {
  const result = scanConfigSchema.safeParse({
    maxPages: Number(form.get("maxPages")),
    maxDepth: Number(form.get("maxDepth")),
    include: lines(form.get("include")),
    exclude: lines(form.get("exclude")),
    queryStrings: form.get("queryStrings") === "keep" ? "keep" : "strip",
    respectRobots: options.verified ? form.get("respectRobots") === "on" : true,
    waitSelector: String(form.get("waitSelector") ?? "").trim() || null,
    viewports: form.getAll("viewports").map(String),
  });
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "form");
      errors[field] ??=
        field === "viewports"
          ? "Choose at least one viewport."
          : field === "maxPages"
            ? "Enter a whole number of pages, 1 or more."
            : field === "maxDepth"
              ? "Enter a depth from 0 to 20."
              : "Check this value.";
    }
    return { ok: false, errors };
  }
  if (result.data.maxPages > options.maxPagesLimit) {
    return {
      ok: false,
      errors: { maxPages: `The current limit is ${options.maxPagesLimit} pages.` },
    };
  }
  return { ok: true, config: result.data };
}

export const issueUpdateSchema = z
  .object({
    issueIds: z.array(z.string().min(1).max(100)).min(1, "Select at least one issue.").max(500),
    status: z.enum(["", ...ISSUE_STATUSES]),
    reason: z.string().trim().max(1000, "Use 1,000 characters or fewer."),
    assignee: z.string().max(100), // "" = no change, "none" = unassign, otherwise a user id
    targetDate: z.union([z.literal(""), z.iso.date("Enter a valid date.")]),
    clearTargetDate: z.boolean(),
  })
  .refine((v) => v.status !== "" || v.assignee !== "" || v.targetDate !== "" || v.clearTargetDate, {
    message: "Choose a new status, an assignee or a target date.",
    path: ["status"],
  })
  .refine(
    (v) =>
      v.status === "" ||
      !(STATUSES_REQUIRING_REASON as readonly string[]).includes(v.status) ||
      v.reason.length >= 5,
    { message: "Give a reason (at least 5 characters) for this status.", path: ["reason"] },
  );
