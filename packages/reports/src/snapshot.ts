import {
  conformanceForStandard,
  summariseFindings,
  UNRESOLVED_ISSUE_STATUSES,
  type ConformanceRow,
  type ManualResult,
} from "@app/compliance-data";
import type { OrgScope } from "@app/db";
import type { FindingRowInput } from "./inputs";

/**
 * Audit snapshots (spec §8: "lock a snapshot of findings at audit close") and the conformance
 * loader shared by the matrix screen, audit summaries and statements. Imports only the database
 * and compliance data, so the web app can use it.
 */

export const SNAPSHOT_ISSUE_LIMIT = 2000;
const FINDING_STATUSES = [...UNRESOLVED_ISSUE_STATUSES, "fixed"];

type ManualTestRow = {
  id?: string;
  propertyId: string;
  criterionId: string;
  result: string;
  notes: string;
  testedAt: Date | null;
  testerName: string | null;
};

export type AuditSnapshot = {
  version: 1;
  takenAt: string;
  standardId: string;
  properties: Array<{
    id: string;
    name: string;
    baseUrl: string;
    latestScan: { id: string; finishedAt: string | null; score: number | null } | null;
  }>;
  findingRows: FindingRowInput[];
  conformance: Record<string, ConformanceRow[]>;
  manualTests: Array<Omit<ManualTestRow, "id" | "testedAt"> & { testedAt: string | null }>;
  evidenceFiles: number;
  issues: Array<{
    propertyId: string;
    ruleId: string;
    impact: string;
    criteria: string[];
    helpText: string;
    status: string;
    needsReview: boolean;
    occurrenceCount: number;
  }>;
};

/** Conformance rows per property: unresolved findings + manual results (+ whether scanned). */
export function conformanceByProperty(input: {
  standardId: string;
  propertyIds: string[];
  scanned: ReadonlySet<string>;
  findingRows: readonly FindingRowInput[];
  manualTests: readonly Pick<ManualTestRow, "propertyId" | "criterionId" | "result">[];
}): Record<string, ConformanceRow[]> {
  const unresolved = new Set<string>(UNRESOLVED_ISSUE_STATUSES);
  const result: Record<string, ConformanceRow[]> = {};
  for (const propertyId of input.propertyIds) {
    const manual = new Map<string, ManualResult>(
      input.manualTests
        .filter((m) => m.propertyId === propertyId)
        .map((m) => [m.criterionId, m.result as ManualResult]),
    );
    const findings = summariseFindings(
      input.findingRows.filter((r) => r.propertyId === propertyId && unresolved.has(r.status)),
    );
    result[propertyId] = conformanceForStandard(input.standardId, {
      scanned: input.scanned.has(propertyId),
      findings,
      manual,
    });
  }
  return result;
}

/** Loads everything the conformance matrix needs for some properties of the organisation. */
export async function loadConformance(scope: OrgScope, propertyIds: string[], standardId: string) {
  const [findingRows, latest, manualTests] = await Promise.all([
    scope.complianceInputs.findingRows(propertyIds, FINDING_STATUSES),
    scope.complianceInputs.latestCompletedScans(propertyIds),
    scope.manualTests.listForProperties(propertyIds),
  ]);
  const conformance = conformanceByProperty({
    standardId,
    propertyIds,
    scanned: new Set(latest.keys()),
    findingRows,
    manualTests,
  });
  return { findingRows, latest, manualTests, conformance };
}

/** Builds the snapshot locked into an audit when it closes (also previews open audits). */
export async function loadAuditSnapshot(
  scope: OrgScope,
  audit: { propertyIds: string[]; standardId: string },
  now = new Date(),
): Promise<AuditSnapshot> {
  const scoped = new Set(audit.propertyIds);
  const properties = (await scope.complianceInputs.propertiesWithOwners())
    .map((row) => row.property)
    .filter((p) => scoped.has(p.id));
  const ids = properties.map((p) => p.id);
  const [{ findingRows, latest, manualTests, conformance }, issues] = await Promise.all([
    loadConformance(scope, ids, audit.standardId),
    scope.complianceInputs.issuesForReport(ids, SNAPSHOT_ISSUE_LIMIT),
  ]);
  const evidence = await scope.evidence.countByLink(
    "manual_test",
    manualTests.map((m) => m.id),
  );

  return {
    version: 1,
    takenAt: now.toISOString(),
    standardId: audit.standardId,
    properties: properties.map((p) => {
      const scan = latest.get(p.id);
      return {
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        latestScan: scan
          ? {
              id: scan.id,
              finishedAt: scan.finishedAt?.toISOString() ?? null,
              score: scan.summary?.score ?? null,
            }
          : null,
      };
    }),
    findingRows,
    conformance,
    manualTests: manualTests.map((m) => ({
      propertyId: m.propertyId,
      criterionId: m.criterionId,
      result: m.result,
      notes: m.notes,
      testerName: m.testerName,
      testedAt: m.testedAt?.toISOString() ?? null,
    })),
    evidenceFiles: [...evidence.values()].reduce((sum, n) => sum + n, 0),
    issues: issues.map((i) => ({
      propertyId: i.propertyId,
      ruleId: i.ruleId,
      impact: i.impact,
      criteria: i.criteria,
      helpText: i.helpText,
      status: i.status,
      needsReview: i.needsReview,
      occurrenceCount: i.occurrenceCount,
    })),
  };
}
