/** Status value lists. No catalogue import, so client components can use them cheaply. */

export const CONFORMANCE_STATUSES = [
  "supports",
  "partially_supports",
  "does_not_support",
  "not_applicable",
  "not_evaluated",
] as const;
export type ConformanceStatus = (typeof CONFORMANCE_STATUSES)[number];

export const MANUAL_RESULTS = ["pass", "fail", "not_applicable", "not_tested"] as const;
export type ManualResult = (typeof MANUAL_RESULTS)[number];

/** fail: confirmed violations · review: findings a person must check · pass: checks ran clean. */
export type AutomatedStatus = "fail" | "review" | "pass" | "not_covered" | "not_scanned";
