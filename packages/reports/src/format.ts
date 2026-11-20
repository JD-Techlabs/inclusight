import {
  AUTOMATED_TESTING_NOTE,
  NOT_A_CERTIFICATION_NOTE,
  UNRESOLVED_ISSUE_STATUSES,
} from "@app/compliance-data";
import {
  ENTITY_TYPE_LABELS,
  IMPACT_LABELS,
  IMPACTS,
  REPORTING_AUTHORITY_LABELS,
  type EntityType,
  type ReportingAuthority,
} from "@app/db/domain";
import type { FindingRowInput, OrgInput, ReportContext } from "./inputs";
import type { OrganisationBlock, ReportMeta } from "./schemas";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/** "19 November 2026". Accepts dates and YYYY-MM-DD strings. */
export function formatDate(value: Date | string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00+05:30`) : value;
  return Number.isNaN(date.getTime()) ? fallback : dateFormat.format(date);
}

export function scoreText(score: number | null | undefined): string {
  return typeof score === "number" ? `${score} / 100` : "Not scored";
}

const NOT_PROVIDED = "Not provided";

export function organisationBlock(org: OrgInput): OrganisationBlock {
  return {
    name: org.name,
    legalName: org.legalName || NOT_PROVIDED,
    sebiRegistrationNo: org.sebiRegistrationNo || NOT_PROVIDED,
    entityType: ENTITY_TYPE_LABELS[org.entityType as EntityType] ?? org.entityType,
    reportingAuthority:
      REPORTING_AUTHORITY_LABELS[org.reportingAuthority as ReportingAuthority] ??
      org.reportingAuthority,
  };
}

export function reportMeta(
  ctx: ReportContext,
  fields: { title: string; period: string; draftNote?: string | null; notes?: string[] },
): ReportMeta {
  return {
    title: fields.title,
    lang: "en",
    period: fields.period,
    generatedOn: formatDate(ctx.generatedAt),
    generatedBy: ctx.generatedBy,
    draft: Boolean(fields.draftNote),
    draftNote: fields.draftNote ?? null,
    automatedNote: AUTOMATED_TESTING_NOTE,
    certificationNote: NOT_A_CERTIFICATION_NOTE,
    notes: fields.notes ?? [],
  };
}

const unresolved = new Set<string>(UNRESOLVED_ISSUE_STATUSES);
export const isUnresolved = (status: string) => unresolved.has(status);

/** Findings by severity: unresolved (incl. accepted risk), fixed and total. WCAG violations only. */
export function severityRows(rows: readonly FindingRowInput[]) {
  return IMPACTS.map((impact) => {
    const ofImpact = rows.filter((r) => r.impact === impact && !r.isBestPractice);
    const sum = (match: (status: string) => boolean) =>
      ofImpact.filter((r) => match(r.status)).reduce((n, r) => n + r.count, 0);
    const open = sum(isUnresolved);
    const fixed = sum((status) => status === "fixed");
    return { severity: IMPACT_LABELS[impact]!, unresolved: open, fixed, total: open + fixed };
  });
}

export function auditDates(audit: { startDate: string; endDate: string | null }): string {
  return audit.endDate
    ? `${formatDate(audit.startDate)} to ${formatDate(audit.endDate)}`
    : `From ${formatDate(audit.startDate)}`;
}
