import { buildAnnualReport } from "../builders/annual";
import { buildAuditSummary } from "../builders/audit-summary";
import { buildPlatformInventory } from "../builders/inventory";
import { buildRemediationTracker } from "../builders/remediation";
import { buildAccessibilityStatement } from "../builders/statement";
import type {
  AuditRecordInput,
  FindingRowInput,
  IssueInput,
  PropertyInput,
  ReportContext,
} from "../inputs";
import type { ReportData } from "../schemas";
import { conformanceByProperty, type AuditSnapshot } from "../snapshot";

/** Realistic inputs for builder, template and PDF/UA tests (tests only). */

export const ctx: ReportContext = {
  org: {
    name: "Sample Broking & Co <Demo>",
    legalName: "Sample Broking Private Limited",
    sebiRegistrationNo: "INZ000123456",
    entityType: "broker",
    reportingAuthority: "nse",
  },
  generatedAt: new Date("2026-11-19T06:30:00Z"),
  generatedBy: "Asha Rao",
};

export const properties: PropertyInput[] = [
  {
    id: "p-web",
    name: "Main website",
    baseUrl: "https://www.sample-broking.example",
    isInvestorFacing: true,
    verified: true,
    ownerName: "Ravi Kumar",
    latestScan: { id: "s-1", finishedAt: new Date("2026-11-18T10:00:00Z"), score: 72 },
  },
  {
    id: "p-portal",
    name: "Investor portal",
    baseUrl: "https://portal.sample-broking.example",
    isInvestorFacing: true,
    verified: false,
    ownerName: null,
    latestScan: null,
  },
];

const row = (
  r: Partial<FindingRowInput> &
    Pick<FindingRowInput, "ruleId" | "impact" | "status" | "criteria" | "count">,
): FindingRowInput => ({
  propertyId: "p-web",
  isBestPractice: false,
  needsReview: false,
  ...r,
});

export const findingRows: FindingRowInput[] = [
  row({ ruleId: "image-alt", impact: "critical", status: "open", criteria: ["1.1.1"], count: 2 }),
  row({
    ruleId: "color-contrast",
    impact: "serious",
    status: "in_progress",
    criteria: ["1.4.3"],
    count: 1,
  }),
  row({ ruleId: "label", impact: "critical", status: "fixed", criteria: ["4.1.2"], count: 1 }),
  row({
    ruleId: "link-name",
    impact: "serious",
    status: "accepted_risk",
    criteria: ["2.4.4", "4.1.2"],
    count: 1,
  }),
  row({
    ruleId: "region",
    impact: "moderate",
    status: "open",
    criteria: ["1.3.1"],
    count: 4,
    isBestPractice: true,
  }),
  row({
    ruleId: "cr-pdf-links",
    impact: "moderate",
    status: "open",
    criteria: [],
    count: 3,
    isBestPractice: true,
    needsReview: true,
  }),
];

const issue = (
  i: Partial<IssueInput> & Pick<IssueInput, "id" | "ruleId" | "impact" | "status" | "helpText">,
): IssueInput => ({
  propertyId: "p-web",
  criteria: [],
  needsReview: false,
  occurrenceCount: 1,
  targetDate: null,
  fixedAt: null,
  fixedInScanId: null,
  assigneeName: null,
  ...i,
});

export const issues: IssueInput[] = [
  issue({
    id: "i1",
    ruleId: "image-alt",
    impact: "critical",
    status: "open",
    criteria: ["1.1.1"],
    helpText: "Images must have alternative text",
    targetDate: "2026-10-31",
    assigneeName: "Ravi Kumar",
  }),
  issue({
    id: "i2",
    ruleId: "color-contrast",
    impact: "serious",
    status: "in_progress",
    criteria: ["1.4.3"],
    helpText: "Elements must meet minimum color contrast ratio thresholds",
    targetDate: "2026-12-15",
  }),
  issue({
    id: "i3",
    ruleId: "label",
    impact: "critical",
    status: "fixed",
    criteria: ["4.1.2"],
    helpText: "Form elements must have labels",
    fixedAt: new Date("2026-11-18T10:00:00Z"),
    fixedInScanId: "s-1",
  }),
  issue({
    id: "i4",
    ruleId: "link-name",
    impact: "serious",
    status: "accepted_risk",
    criteria: ["2.4.4", "4.1.2"],
    helpText: "Links must have discernible text",
  }),
  issue({
    id: "i5",
    ruleId: "cr-pdf-links",
    impact: "moderate",
    status: "open",
    needsReview: true,
    helpText: "Linked PDF documents need an accessibility check",
  }),
];

export const audit: AuditRecordInput = {
  id: "a1",
  title: "FY 2026-27 accessibility audit",
  auditorName: "R. Iyer",
  iaapCertId: "WAS-0000-1234",
  auditorOrg: "Access Auditors LLP",
  startDate: "2026-11-01",
  endDate: "2026-11-15",
  propertyIds: ["p-web", "p-portal"],
  standardId: "wcag21aa",
  methodology:
    "Tested on Chrome with NVDA 2026.3 and on Android with TalkBack.\n\nSample of 25 pages.",
  status: "closed",
  closedAt: new Date("2026-11-16T09:00:00Z"),
};

const manualTests = [
  {
    propertyId: "p-web",
    criterionId: "1.4.3",
    result: "fail",
    notes: "Footer text",
    testerName: "R. Iyer",
    testedAt: "2026-11-10T00:00:00Z",
  },
  {
    propertyId: "p-web",
    criterionId: "2.1.1",
    result: "pass",
    notes: "",
    testerName: "R. Iyer",
    testedAt: "2026-11-10T00:00:00Z",
  },
  {
    propertyId: "p-web",
    criterionId: "1.2.4",
    result: "not_applicable",
    notes: "No live video",
    testerName: "R. Iyer",
    testedAt: "2026-11-10T00:00:00Z",
  },
];

export const snapshot: AuditSnapshot = {
  version: 1,
  takenAt: "2026-11-16T09:00:00.000Z",
  standardId: "wcag21aa",
  properties: properties.map((p) => ({
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    latestScan: p.latestScan
      ? { id: p.latestScan.id, finishedAt: "2026-11-18T10:00:00.000Z", score: p.latestScan.score }
      : null,
  })),
  findingRows,
  conformance: conformanceByProperty({
    standardId: "wcag21aa",
    propertyIds: properties.map((p) => p.id),
    scanned: new Set(["p-web"]),
    findingRows,
    manualTests,
  }),
  manualTests,
  evidenceFiles: 2,
  issues: [],
};

/** One of each report type, built through the real builders. */
export function sampleReports(): ReportData[] {
  const statementRows = snapshot.conformance["p-web"]!;
  return [
    { type: "platform_inventory", data: buildPlatformInventory(ctx, properties, findingRows) },
    { type: "audit_summary", data: buildAuditSummary(ctx, audit, snapshot) },
    { type: "remediation_tracker", data: buildRemediationTracker(ctx, properties, issues, false) },
    {
      type: "sebi_annual",
      data: buildAnnualReport(
        ctx,
        { financialYear: "2026-27", ceoName: "Meera Shah", ctoName: "" },
        properties,
        findingRows,
        [audit],
        [{ name: "Kavita Menon", email: "nodal@sample-broking.example" }],
        "Draft layout.",
      ),
    },
    {
      type: "accessibility_statement",
      data: buildAccessibilityStatement(
        ctx,
        {
          propertyId: "p-web",
          standardId: "wcag21aa",
          contactEmail: "accessibility@sample-broking.example",
          contactPhone: "+91 22 4000 0000",
          responseDays: 7,
          limitationsNote:
            "Some older circulars are scanned PDFs; accessible versions are available on request.",
        },
        properties[0]!,
        statementRows,
        issues,
        audit,
      ),
    },
  ];
}
