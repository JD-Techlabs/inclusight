import {
  IMPACT_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUSES,
  type IssueStatus,
} from "@app/db/domain";
import { formatDate, isUnresolved, organisationBlock, reportMeta } from "../format";
import type { IssueInput, PropertyInput, ReportContext } from "../inputs";
import type { RemediationTrackerData } from "../schemas";

/** YYYY-MM-DD in India Standard Time, for comparing target dates. */
function istDay(date: Date): string {
  return new Date(date.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** Remediation tracker (spec §9): each WCAG finding with owner, dates and verification. */
export function buildRemediationTracker(
  ctx: ReportContext,
  properties: readonly PropertyInput[],
  issues: readonly IssueInput[],
  truncated: boolean,
): RemediationTrackerData {
  const names = new Map(properties.map((p) => [p.id, p.name]));
  const findings = issues.filter((i) => !i.needsReview);
  const today = istDay(ctx.generatedAt);

  return {
    meta: reportMeta(ctx, {
      title: "Remediation tracker",
      period: `As on ${formatDate(ctx.generatedAt)}`,
      notes: truncated
        ? [
            "This report lists the first 5,000 findings, most severe first. Export the issue list for the rest.",
          ]
        : [],
    }),
    organisation: organisationBlock(ctx.org),
    totals: ISSUE_STATUSES.map((status) => ({
      status: ISSUE_STATUS_LABELS[status],
      count: findings.filter((i) => i.status === status).length,
    })),
    overdue: findings.filter(
      (i) => isUnresolved(i.status) && i.targetDate !== null && i.targetDate < today,
    ).length,
    truncated,
    items: findings.map((i) => ({
      property: names.get(i.propertyId) ?? "—",
      finding: i.helpText,
      rule: i.ruleId,
      criteria: i.criteria.join(", ") || "—",
      severity: IMPACT_LABELS[i.impact] ?? i.impact,
      status: ISSUE_STATUS_LABELS[i.status as IssueStatus] ?? i.status,
      owner: i.assigneeName ?? "Unassigned",
      targetDate: formatDate(i.targetDate),
      fixedDate: i.status === "fixed" ? formatDate(i.fixedAt, "Marked fixed") : "—",
      verification:
        i.status === "fixed"
          ? i.fixedInScanId
            ? `Not found in the scan of ${formatDate(i.fixedAt)}`
            : "Marked fixed manually; not yet verified by a scan"
          : "—",
    })),
  };
}
