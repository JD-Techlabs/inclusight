import type { AutomatedStatus, ConformanceStatus, ManualResult } from "./statuses";
import type { Automatable } from "./schema";

/** Display text shared by the app and generated reports, so both say the same thing. */

export const CONFORMANCE_LABELS: Record<ConformanceStatus, string> = {
  supports: "Supports",
  partially_supports: "Partially supports",
  does_not_support: "Does not support",
  not_applicable: "Not applicable",
  not_evaluated: "Not evaluated",
};

export const MANUAL_RESULT_LABELS: Record<ManualResult, string> = {
  pass: "Pass",
  fail: "Fail",
  not_applicable: "Not applicable",
  not_tested: "Not tested",
};

export const AUTOMATED_STATUS_LABELS: Record<AutomatedStatus, string> = {
  fail: "Issues found",
  review: "Needs review",
  pass: "No issues found",
  not_covered: "Not covered by automated checks",
  not_scanned: "Not scanned yet",
};

export const AUTOMATABLE_LABELS: Record<Automatable, string> = {
  full: "Fully automated",
  partial: "Partly automated",
  none: "Manual only",
};

export const PENDING_REVIEW_LABEL = "Pending expert review";

/** Required next to every score and report (CLAUDE.md product rules). */
export const AUTOMATED_TESTING_NOTE =
  "Automated checks find only part of all accessibility issues; manual testing is required for compliance.";

/** The product assists compliance; it never certifies it (CLAUDE.md product rules). */
export const NOT_A_CERTIFICATION_NOTE =
  "This report assists accessibility compliance work. It is not a certification of compliance.";
