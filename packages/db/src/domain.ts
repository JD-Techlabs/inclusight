/** Domain value lists from spec §6. Kept as data so they can change without schema migrations. */

export const ROLES = [
  "owner",
  "admin",
  "nodal_officer",
  "developer",
  "auditor",
  "grievance_agent",
  "viewer",
] as const;
export type Role = (typeof ROLES)[number];

export const ENTITY_TYPES = ["broker", "dp", "amc", "ia", "ra", "pms", "mii", "other"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const REPORTING_AUTHORITIES = ["nse", "bse", "cdsl", "nsdl", "sebi", "other"] as const;
export type ReportingAuthority = (typeof REPORTING_AUTHORITIES)[number];

export const PROPERTY_TYPES = ["web"] as const; // android and pdf_collection arrive in later phases

export const SCAN_STATUSES = ["queued", "crawling", "scanning", "completed", "failed"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];
export const ACTIVE_SCAN_STATUSES: readonly ScanStatus[] = ["queued", "crawling", "scanning"];

export const SCAN_TRIGGERS = ["manual", "schedule", "ci", "api"] as const;
export type ScanTrigger = (typeof SCAN_TRIGGERS)[number];

export const ISSUE_STATUSES = [
  "open",
  "in_progress",
  "fixed",
  "false_positive",
  "accepted_risk",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Statuses that need a written reason (spec §7.5: false positives are audit-logged with one). */
export const STATUSES_REQUIRING_REASON: readonly IssueStatus[] = [
  "false_positive",
  "accepted_risk",
];

export const AUDIT_STATUSES = ["in_progress", "closed"] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const REPORT_STATUSES = ["queued", "generating", "ready", "failed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_FORMATS = ["pdf", "xlsx", "html", "md"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

/** What evidence files can be attached to. */
export const EVIDENCE_LINK_TYPES = ["manual_test"] as const;
export type EvidenceLinkType = (typeof EVIDENCE_LINK_TYPES)[number];

/** Issue categories shown on separate tabs: WCAG violations, best practice, needs review. */
export const ISSUE_CATEGORIES = ["wcag", "best_practice", "review"] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/** Display labels shared by the app and generated reports. */
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  broker: "Stock broker",
  dp: "Depository participant",
  amc: "Asset management company",
  ia: "Investment adviser",
  ra: "Research analyst",
  pms: "Portfolio manager",
  mii: "Market infrastructure institution",
  other: "Other",
};

export const REPORTING_AUTHORITY_LABELS: Record<ReportingAuthority, string> = {
  nse: "NSE",
  bse: "BSE",
  cdsl: "CDSL",
  nsdl: "NSDL",
  sebi: "SEBI (directly)",
  other: "Other",
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  fixed: "Fixed",
  false_positive: "False positive",
  accepted_risk: "Accepted risk",
};

export const IMPACTS = ["critical", "serious", "moderate", "minor"] as const;
export type Impact = (typeof IMPACTS)[number];

export const IMPACT_LABELS: Record<string, string> = {
  critical: "Critical",
  serious: "Serious",
  moderate: "Moderate",
  minor: "Minor",
};
