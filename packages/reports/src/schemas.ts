import { z } from "zod";

/**
 * The data each report template receives. Values are display-ready strings, so templates stay
 * simple and can be edited without code changes. Written to
 * compliance-data/report-templates/<folder>/schema.json (kept in sync by a unit test).
 */

const str = z.string();

export const metaSchema = z.object({
  title: str,
  lang: z.literal("en"),
  period: str,
  generatedOn: str,
  generatedBy: str,
  draft: z.boolean(),
  draftNote: str.nullable(),
  automatedNote: str,
  certificationNote: str,
  notes: z.array(str),
});

export const organisationSchema = z.object({
  name: str,
  legalName: str,
  sebiRegistrationNo: str,
  entityType: str,
  reportingAuthority: str,
});

const severityRow = z.object({
  severity: str,
  unresolved: z.number(),
  fixed: z.number(),
  total: z.number(),
});

export const platformInventorySchema = z.object({
  meta: metaSchema,
  organisation: organisationSchema,
  totals: z.object({
    platforms: z.number(),
    investorFacing: z.number(),
    verified: z.number(),
    scanned: z.number(),
  }),
  platforms: z.array(
    z.object({
      name: str,
      type: str,
      url: str,
      investorFacing: str,
      owner: str,
      verification: str,
      lastScan: str,
      score: str,
      unresolvedIssues: z.number(),
      criticalOrSerious: z.number(),
    }),
  ),
});

export const conformanceTableSchema = z.object({
  standard: str,
  pendingReview: z.boolean(),
  reviewNote: str.nullable(),
  properties: z.array(str),
  rows: z.array(z.object({ criterion: str, level: str, statuses: z.array(str), overall: str })),
  counts: z.array(z.object({ status: str, count: z.number() })),
});

export const auditSummarySchema = z.object({
  meta: metaSchema,
  organisation: organisationSchema,
  audit: z.object({
    title: str,
    auditorName: str,
    iaapCertId: str,
    auditorOrg: str,
    dates: str,
    status: str,
    standard: str,
    methodology: z.array(str),
    scope: z.array(z.object({ name: str, url: str })),
  }),
  severity: z.array(severityRow),
  criteria: z.array(z.object({ criterion: str, violations: z.number(), reviews: z.number() })),
  conformance: z.array(conformanceTableSchema),
  manualTesting: z.object({ tested: z.number(), total: z.number(), evidenceFiles: z.number() }),
});

export const remediationTrackerSchema = z.object({
  meta: metaSchema,
  organisation: organisationSchema,
  totals: z.array(z.object({ status: str, count: z.number() })),
  overdue: z.number(),
  truncated: z.boolean(),
  items: z.array(
    z.object({
      property: str,
      finding: str,
      rule: str,
      criteria: str,
      severity: str,
      status: str,
      owner: str,
      targetDate: str,
      fixedDate: str,
      verification: str,
    }),
  ),
});

export const annualReportSchema = z.object({
  meta: metaSchema,
  organisation: organisationSchema,
  financialYear: z.object({ label: str, start: str, end: str, due: str }),
  nodalOfficers: z.array(z.object({ name: str, email: str })),
  platforms: z.array(
    z.object({ name: str, url: str, investorFacing: str, score: str, lastScan: str }),
  ),
  audits: z.array(
    z.object({ title: str, auditor: str, iaapCertId: str, dates: str, status: str, standard: str }),
  ),
  findings: z.object({
    total: z.number(),
    unresolved: z.number(),
    fixed: z.number(),
    acceptedRisk: z.number(),
    severity: z.array(severityRow),
  }),
  grievances: z.object({ note: str }),
  signatories: z.array(z.object({ role: str, name: str, designation: str })),
});

export const accessibilityStatementSchema = z.object({
  meta: metaSchema,
  organisationName: str,
  property: z.object({ name: str, url: str }),
  standard: str,
  conformance: z.object({ level: str, sentence: str }),
  limitations: z.array(z.object({ criterion: str, description: str })),
  extraLimitations: z.array(str),
  method: str,
  contact: z.object({ email: str, phone: str, responseDays: z.number() }),
  preparedOn: str,
});

export const REPORT_DATA_SCHEMAS = {
  platform_inventory: platformInventorySchema,
  audit_summary: auditSummarySchema,
  remediation_tracker: remediationTrackerSchema,
  sebi_annual: annualReportSchema,
  accessibility_statement: accessibilityStatementSchema,
} as const;

export type ReportMeta = z.infer<typeof metaSchema>;
export type OrganisationBlock = z.infer<typeof organisationSchema>;
export type PlatformInventoryData = z.infer<typeof platformInventorySchema>;
export type AuditSummaryData = z.infer<typeof auditSummarySchema>;
export type ConformanceTable = z.infer<typeof conformanceTableSchema>;
export type RemediationTrackerData = z.infer<typeof remediationTrackerSchema>;
export type AnnualReportData = z.infer<typeof annualReportSchema>;
export type AccessibilityStatementData = z.infer<typeof accessibilityStatementSchema>;

export type ReportDataByType = {
  [K in keyof typeof REPORT_DATA_SCHEMAS]: z.infer<(typeof REPORT_DATA_SCHEMAS)[K]>;
};
export type ReportData = {
  [K in keyof ReportDataByType]: { type: K; data: ReportDataByType[K] };
}[keyof ReportDataByType];
