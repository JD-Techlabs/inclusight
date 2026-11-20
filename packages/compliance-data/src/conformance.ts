import { criteriaForStandard, getCriterion, getRuleMapping, type Criterion } from "./catalogue";
import type { AutomatedStatus, ConformanceStatus, ManualResult } from "./statuses";

export * from "./statuses";

/**
 * Conformance matrix logic (spec §8): automated status + manual result → overall status.
 * The rules are documented in docs/DECISIONS.md (D-038) and shown as a legend in the UI.
 */

export type Findings = { violations: number; reviews: number };

/** Issue statuses that still count against conformance. Accepted risk is a known failure. */
export const UNRESOLVED_ISSUE_STATUSES = ["open", "in_progress", "accepted_risk"] as const;

/** One aggregated row of unresolved issues for a property. */
export type FindingRow = {
  ruleId: string;
  criteria: string[];
  isBestPractice: boolean;
  needsReview: boolean;
  count: number;
};

export type FindingSummary = {
  byCriterion: Map<string, Findings>;
  byRule: Map<string, Findings>;
};

/** Totals unresolved violations and review findings per WCAG criterion and per rule. */
export function summariseFindings(rows: readonly FindingRow[]): FindingSummary {
  const byCriterion = new Map<string, Findings>();
  const byRule = new Map<string, Findings>();
  const add = (map: Map<string, Findings>, key: string, row: FindingRow) => {
    const entry = map.get(key) ?? { violations: 0, reviews: 0 };
    if (row.needsReview) entry.reviews += row.count;
    else entry.violations += row.count;
    map.set(key, entry);
  };
  for (const row of rows) {
    if (row.isBestPractice && !row.needsReview) continue;
    add(byRule, row.ruleId, row);
    for (const criterion of row.criteria) add(byCriterion, criterion, row);
  }
  return { byCriterion, byRule };
}

export function automatedStatus(
  criterion: Pick<Criterion, "automatable">,
  findings: Findings | undefined,
  scanned: boolean,
): AutomatedStatus {
  if (!scanned) return "not_scanned";
  if (findings && findings.violations > 0) return "fail";
  if (findings && findings.reviews > 0) return "review";
  return criterion.automatable === "none" ? "not_covered" : "pass";
}

/**
 * Manual fail → does not support. Automated failures without a manual fail → partially
 * supports (a person passing the criterion does not erase failures the scanner found).
 * Manual pass → supports; manual not applicable → not applicable. Untested criteria are not
 * evaluated, except fully automatable ones that the scanner checked cleanly.
 */
export function overallStatus(
  automated: AutomatedStatus,
  manual: ManualResult,
  automatable: Criterion["automatable"],
): ConformanceStatus {
  if (manual === "fail") return "does_not_support";
  if (automated === "fail") return "partially_supports";
  if (manual === "pass") return "supports";
  if (manual === "not_applicable") return "not_applicable";
  return automatable === "full" && automated === "pass" ? "supports" : "not_evaluated";
}

/** Combines several statuses (properties, or a requirement's related criteria) into one. */
export function combineStatuses(statuses: readonly ConformanceStatus[]): ConformanceStatus {
  const applicable = statuses.filter((s) => s !== "not_applicable");
  if (applicable.length === 0) return statuses.length > 0 ? "not_applicable" : "not_evaluated";
  if (applicable.every((s) => s === "does_not_support")) return "does_not_support";
  if (applicable.some((s) => s === "does_not_support" || s === "partially_supports")) {
    return "partially_supports";
  }
  if (applicable.some((s) => s === "not_evaluated")) return "not_evaluated";
  return "supports";
}

export type ConformanceInput = {
  scanned: boolean;
  findings: FindingSummary;
  manual: ReadonlyMap<string, ManualResult>;
};

export type ConformanceRow = {
  criterionId: string;
  automated: AutomatedStatus;
  manual: ManualResult;
  status: ConformanceStatus;
  violations: number;
  reviews: number;
};

function rowFor(criterion: Criterion, input: ConformanceInput, depth: number): ConformanceRow {
  const manual = input.manual.get(criterion.id) ?? "not_tested";
  if (criterion.source === "wcag") {
    const findings = input.findings.byCriterion.get(criterion.id);
    const automated = automatedStatus(criterion, findings, input.scanned);
    return {
      criterionId: criterion.id,
      automated,
      manual,
      status: overallStatus(automated, manual, criterion.automatable),
      violations: findings?.violations ?? 0,
      reviews: findings?.reviews ?? 0,
    };
  }

  // GIGW / IS 17802 requirement: its own rules, plus the criteria and standard it relates to.
  const findings: Findings = { violations: 0, reviews: 0 };
  for (const ruleId of criterion.relatedRules) {
    const f = input.findings.byRule.get(ruleId);
    const kind = getRuleMapping(ruleId)?.kind;
    if (!f) continue;
    if (kind === "review") findings.reviews += f.violations + f.reviews;
    else {
      findings.violations += f.violations;
      findings.reviews += f.reviews;
    }
  }
  const automated = automatedStatus(criterion, findings, input.scanned);
  const own = overallStatus(automated, manual, criterion.automatable);
  if (manual !== "not_tested" || depth > 1) {
    return { criterionId: criterion.id, automated, manual, status: own, ...findings };
  }
  const related = [
    ...criterion.relatedCriteria.map((id) => getCriterion(id)).filter((c) => c !== null),
    ...(criterion.relatedStandard ? criteriaForStandard(criterion.relatedStandard) : []),
  ].map((c) => rowFor(c, input, depth + 1).status);
  const status =
    related.length === 0
      ? own
      : combineStatuses(automated === "fail" ? [own, ...related] : related);
  return { criterionId: criterion.id, automated, manual, status, ...findings };
}

/** Conformance of one property against one standard, in the standard's display order. */
export function conformanceForStandard(
  standardId: string,
  input: ConformanceInput,
): ConformanceRow[] {
  return criteriaForStandard(standardId).map((criterion) => rowFor(criterion, input, 0));
}
