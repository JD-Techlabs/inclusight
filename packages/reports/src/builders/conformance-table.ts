import {
  combineStatuses,
  CONFORMANCE_LABELS,
  CONFORMANCE_STATUSES,
  criteriaForStandard,
  getStandard,
  PENDING_REVIEW_LABEL,
  type ConformanceRow,
  type ConformanceStatus,
} from "@app/compliance-data";
import type { ConformanceTable } from "../schemas";

/** Criteria × properties table with an overall column (spec §8 conformance matrix). */
export function conformanceTable(
  standardId: string,
  properties: ReadonlyArray<{ id: string; name: string }>,
  conformance: Readonly<Record<string, readonly ConformanceRow[]>>,
): ConformanceTable {
  const standard = getStandard(standardId);
  if (!standard) throw new Error(`Unknown standard ${standardId}`);
  const statusOf = (propertyId: string, criterionId: string): ConformanceStatus =>
    conformance[propertyId]?.find((r) => r.criterionId === criterionId)?.status ?? "not_evaluated";

  const overall: ConformanceStatus[] = [];
  const rows = criteriaForStandard(standardId).map((criterion) => {
    const statuses = properties.map((p) => statusOf(p.id, criterion.id));
    const combined = combineStatuses(statuses);
    overall.push(combined);
    return {
      criterion: criterion.label,
      level: criterion.level ?? (criterion.pendingReview ? PENDING_REVIEW_LABEL : "—"),
      statuses: statuses.map((s) => CONFORMANCE_LABELS[s]),
      overall: CONFORMANCE_LABELS[combined],
    };
  });

  return {
    standard: standard.pendingReview ? `${standard.name} (${PENDING_REVIEW_LABEL})` : standard.name,
    pendingReview: standard.pendingReview,
    reviewNote: standard.reviewNote,
    properties: properties.map((p) => p.name),
    rows,
    counts: CONFORMANCE_STATUSES.map((status) => ({
      status: CONFORMANCE_LABELS[status],
      count: overall.filter((s) => s === status).length,
    })),
  };
}
