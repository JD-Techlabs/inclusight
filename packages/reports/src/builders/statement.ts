import {
  criterionLabel,
  getCriterion,
  getStandard,
  type ConformanceRow,
} from "@app/compliance-data";
import { formatDate, isUnresolved, reportMeta } from "../format";
import type { AuditRecordInput, IssueInput, PropertyInput, ReportContext } from "../inputs";
import type { ReportParamsByType } from "../params";
import type { AccessibilityStatementData } from "../schemas";

/** WCAG-EM style conformance wording, from the criteria rows of the chosen standard. */
export function conformanceWording(rows: readonly ConformanceRow[], standardName: string) {
  const failing = rows.filter(
    (r) => r.status === "does_not_support" || r.status === "partially_supports",
  );
  if (failing.length > 0) {
    return {
      level: "Partially conformant",
      sentence: `This website is partially conformant with ${standardName}. Partially conformant means that some parts of the content do not fully conform to the standard.`,
    };
  }
  if (rows.some((r) => r.status === "not_evaluated")) {
    return {
      level: "Assessment in progress",
      sentence: `This website has not yet been fully assessed against ${standardName}. We will update this statement when the assessment is complete.`,
    };
  }
  return {
    level: "Fully conformant",
    sentence: `This website is fully conformant with ${standardName}. Fully conformant means that the content fully conforms to the standard without any exceptions.`,
  };
}

/** Public accessibility statement for one website (spec §9). */
export function buildAccessibilityStatement(
  ctx: ReportContext,
  params: ReportParamsByType["accessibility_statement"],
  property: PropertyInput,
  rows: readonly ConformanceRow[],
  issues: readonly IssueInput[],
  audit: AuditRecordInput | null,
): AccessibilityStatementData {
  const standardName = getStandard(params.standardId)?.name ?? params.standardId;
  const open = issues.filter((i) => isUnresolved(i.status) && !i.needsReview);

  const limitations = rows
    .filter((r) => r.status === "does_not_support" || r.status === "partially_supports")
    .map((r) => {
      const examples = [
        ...new Set(open.filter((i) => i.criteria.includes(r.criterionId)).map((i) => i.helpText)),
      ];
      return {
        criterion: criterionLabel(r.criterionId),
        description:
          examples.length > 0
            ? `${examples.slice(0, 3).join("; ")}.`
            : (getCriterion(r.criterionId)?.summary ??
              "Some content does not yet meet this criterion."),
      };
    });

  const method = audit
    ? `This statement is based on an accessibility audit by ${audit.auditorName} (${audit.auditorOrg}, IAAP certification ${audit.iaapCertId}), completed on ${formatDate(audit.closedAt)}, together with automated testing. Automated checks find only part of all accessibility issues, so the audit included manual testing.`
    : "This statement is based on a self-assessment that combined automated testing with manual testing. Automated checks find only part of all accessibility issues, so manual testing was also carried out.";

  return {
    meta: reportMeta(ctx, {
      title: `Accessibility statement for ${property.name}`,
      period: formatDate(ctx.generatedAt),
    }),
    organisationName: ctx.org.legalName || ctx.org.name,
    property: { name: property.name, url: property.baseUrl },
    standard: standardName,
    conformance: conformanceWording(rows, standardName),
    limitations,
    extraLimitations: params.limitationsNote
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    method,
    contact: {
      email: params.contactEmail,
      phone: params.contactPhone,
      responseDays: params.responseDays,
    },
    preparedOn: formatDate(ctx.generatedAt),
  };
}
