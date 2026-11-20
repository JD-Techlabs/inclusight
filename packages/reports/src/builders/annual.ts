import { getStandard } from "@app/compliance-data";
import {
  auditDates,
  formatDate,
  isUnresolved,
  organisationBlock,
  reportMeta,
  scoreText,
  severityRows,
} from "../format";
import type { AuditRecordInput, FindingRowInput, PropertyInput, ReportContext } from "../inputs";
import { financialYearDates, type ReportParamsByType } from "../params";
import type { AnnualReportData } from "../schemas";

const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Draft annual accessibility compliance report (spec §9). Findings are as on the generation
 * date; audits are those overlapping the financial year. Grievance figures come from the
 * grievance desk once it exists; until then the report asks for them to be filled in.
 */
export function buildAnnualReport(
  ctx: ReportContext,
  params: ReportParamsByType["sebi_annual"],
  properties: readonly PropertyInput[],
  findingRows: readonly FindingRowInput[],
  audits: readonly AuditRecordInput[],
  nodalOfficers: ReadonlyArray<{ name: string; email: string }>,
  formatNote: string | null,
): AnnualReportData {
  const year = financialYearDates(params.financialYear);
  const [start, end] = [dayOf(year.start), dayOf(year.end)];
  const inYear = audits.filter((a) => a.startDate <= end && (a.endDate ?? a.startDate) >= start);
  const violations = findingRows.filter((r) => !r.isBestPractice);
  const sum = (match: (status: string) => boolean) =>
    violations.filter((r) => match(r.status)).reduce((n, r) => n + r.count, 0);

  return {
    meta: reportMeta(ctx, {
      title: "Annual accessibility compliance report",
      period: `Financial year ${params.financialYear}`,
      draftNote: [
        "Draft for review. It must be checked, completed and signed outside A11yComply before submission.",
        formatNote,
      ]
        .filter(Boolean)
        .join(" "),
    }),
    organisation: organisationBlock(ctx.org),
    financialYear: {
      label: params.financialYear,
      start: formatDate(year.start),
      end: formatDate(year.end),
      due: formatDate(year.due),
    },
    nodalOfficers: nodalOfficers.map((n) => ({ name: n.name, email: n.email })),
    platforms: properties.map((p) => ({
      name: p.name,
      url: p.baseUrl,
      investorFacing: p.isInvestorFacing ? "Yes" : "No",
      score: p.latestScan ? scoreText(p.latestScan.score) : "Not scored",
      lastScan: p.latestScan ? formatDate(p.latestScan.finishedAt) : "Not scanned yet",
    })),
    audits: inYear.map((a) => ({
      title: a.title,
      auditor: `${a.auditorName}, ${a.auditorOrg}`,
      iaapCertId: a.iaapCertId,
      dates: auditDates(a),
      status: a.status === "closed" ? `Closed on ${formatDate(a.closedAt)}` : "In progress",
      standard: getStandard(a.standardId)?.name ?? a.standardId,
    })),
    findings: {
      total: sum((s) => s !== "false_positive"),
      unresolved: sum(isUnresolved),
      fixed: sum((s) => s === "fixed"),
      acceptedRisk: sum((s) => s === "accepted_risk"),
      severity: severityRows(findingRows),
    },
    grievances: {
      note: "No grievance records are held in A11yComply for this period. Enter the number of accessibility grievances received and resolved, and the average resolution time, from your grievance register.",
    },
    signatories: [
      {
        role: "Chief Executive Officer",
        name: params.ceoName,
        designation: "Chief Executive Officer",
      },
      {
        role: "Chief Technology Officer",
        name: params.ctoName,
        designation: "Chief Technology Officer",
      },
    ],
  };
}
