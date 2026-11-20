import {
  compareCriterionIds,
  criteriaForStandard,
  criterionLabel,
  getStandard,
  summariseFindings,
} from "@app/compliance-data";
import {
  auditDates,
  formatDate,
  isUnresolved,
  organisationBlock,
  reportMeta,
  severityRows,
} from "../format";
import type { AuditRecordInput, ReportContext } from "../inputs";
import type { AuditSummaryData } from "../schemas";
import { conformanceByProperty, type AuditSnapshot } from "../snapshot";
import { conformanceTable } from "./conformance-table";

/** Placeholder standards shown next to the audit's own standard (marked pending review). */
const RELATED_STANDARDS = ["gigw3", "is17802"];

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * Audit summary (spec §9). Uses the snapshot locked at close; an open audit is reported from a
 * fresh snapshot and marked as a draft.
 */
export function buildAuditSummary(
  ctx: ReportContext,
  audit: AuditRecordInput,
  snapshot: AuditSnapshot,
): AuditSummaryData {
  const closed = audit.status === "closed";
  const standard = getStandard(snapshot.standardId);
  const properties = snapshot.properties;
  const unresolved = snapshot.findingRows.filter((r) => isUnresolved(r.status));
  const byCriterion = summariseFindings(unresolved).byCriterion;
  const scanned = new Set(properties.filter((p) => p.latestScan).map((p) => p.id));
  const standardCriteria = new Set(criteriaForStandard(snapshot.standardId).map((c) => c.id));

  const related = RELATED_STANDARDS.map((standardId) =>
    conformanceTable(
      standardId,
      properties,
      conformanceByProperty({
        standardId,
        propertyIds: properties.map((p) => p.id),
        scanned,
        findingRows: snapshot.findingRows,
        manualTests: snapshot.manualTests,
      }),
    ),
  );

  return {
    meta: reportMeta(ctx, {
      title: "Audit summary",
      period: auditDates(audit),
      draftNote: closed
        ? null
        : "This audit is still in progress. Findings and conformance may change until it is closed.",
    }),
    organisation: organisationBlock(ctx.org),
    audit: {
      title: audit.title,
      auditorName: audit.auditorName,
      iaapCertId: audit.iaapCertId,
      auditorOrg: audit.auditorOrg,
      dates: auditDates(audit),
      status: closed
        ? `Closed on ${formatDate(audit.closedAt)}; findings locked on ${formatDate(snapshot.takenAt)}`
        : "In progress",
      standard: standard?.name ?? snapshot.standardId,
      methodology: paragraphs(audit.methodology),
      scope: properties.map((p) => ({ name: p.name, url: p.baseUrl })),
    },
    severity: severityRows(snapshot.findingRows),
    criteria: [...byCriterion.entries()]
      .sort(([a], [b]) => compareCriterionIds(a, b))
      .map(([id, f]) => ({
        criterion: criterionLabel(id),
        violations: f.violations,
        reviews: f.reviews,
      })),
    conformance: [
      conformanceTable(snapshot.standardId, properties, snapshot.conformance),
      ...related,
    ],
    manualTesting: {
      tested: snapshot.manualTests.filter(
        (m) => m.result !== "not_tested" && standardCriteria.has(m.criterionId),
      ).length,
      total: standardCriteria.size * properties.length,
      evidenceFiles: snapshot.evidenceFiles,
    },
  };
}
