import { IMPACT_LABELS, ISSUE_STATUS_LABELS, type ScanStatus } from "@app/db/domain";

export { IMPACT_LABELS, ISSUE_STATUS_LABELS };

export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
  queued: "Queued",
  crawling: "Finding pages",
  scanning: "Scanning pages",
  completed: "Completed",
  failed: "Failed",
};

export const SCAN_MODE_LABELS: Record<string, string> = {
  full: "Full site",
  single_page: "Single page (domain not verified)",
};

export const VERIFICATION_METHOD_LABELS: Record<string, string> = {
  dns_txt: "DNS TXT record",
  meta_tag: "Meta tag on the home page",
  well_known_file: "File at /.well-known/inclusight.txt",
};

export const VIEWPORT_LABELS: Record<string, string> = {
  desktop: "Desktop (1366×768)",
  mobile: "Mobile (390×844)",
};

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value;
}

/** Required next to every score and report (CLAUDE.md product rules). */
export const AUTOMATED_TESTING_DISCLAIMER =
  "Automated checks find only part of all accessibility issues; manual testing is required for compliance.";
