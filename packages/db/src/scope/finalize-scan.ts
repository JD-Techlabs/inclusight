import { and, count, eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import { issues, scanPages, scans } from "../schema";
import type { ScanSummary } from "./scans";

export type ScoreFunction = (
  issues: Array<{ impact: "critical" | "serious" | "moderate" | "minor"; occurrences: number }>,
) => number;

const IMPACT_KEYS = ["critical", "serious", "moderate", "minor"] as const;
const toImpactKey = (value: string) =>
  (IMPACT_KEYS as readonly string[]).includes(value)
    ? (value as (typeof IMPACT_KEYS)[number])
    : "minor";

/**
 * Completes a scan once every page is done or failed, in one transaction:
 *  1. occurrence/page counts for issues seen in this scan;
 *  2. issues previously marked fixed but seen again → reopened;
 *  3. open issues not seen again → fixed, but only when every page they occurred on last time
 *     was successfully re-scanned (a page that failed to load proves nothing);
 *  4. summary with score and new/fixed/reopened counts.
 * Idempotent: running it twice leaves the same state and summary.
 */
export async function finalizeScan(
  db: Database,
  orgId: string,
  scanId: string,
  score: ScoreFunction,
): Promise<ScanSummary | null> {
  return db.transaction(async (tx) => {
    const [scan] = await tx
      .select()
      .from(scans)
      .where(and(eq(scans.orgId, orgId), eq(scans.id, scanId)))
      .for("update");
    if (!scan) return null;
    if (scan.status === "completed" || scan.status === "failed") {
      return (scan.summary as ScanSummary | null) ?? null;
    }

    const pageCounts = await tx
      .select({ status: scanPages.status, n: count() })
      .from(scanPages)
      .where(and(eq(scanPages.orgId, orgId), eq(scanPages.scanId, scanId)))
      .groupBy(scanPages.status);
    const pagesWith = (status: string) => pageCounts.find((r) => r.status === status)?.n ?? 0;
    if (pagesWith("pending") > 0) return null; // not finished yet
    const done = pagesWith("done");
    const failed = pagesWith("failed");
    const propertyId = scan.propertyId;

    await tx.execute(sql`
      UPDATE issues i SET occurrence_count = s.cnt, page_count = s.pages
      FROM (
        SELECT issue_id, count(*)::int AS cnt, count(DISTINCT page_id)::int AS pages
        FROM issue_occurrences WHERE scan_id = ${scanId} AND org_id = ${orgId}
        GROUP BY issue_id
      ) s
      WHERE i.id = s.issue_id AND i.org_id = ${orgId}`);

    await tx
      .update(issues)
      .set({
        status: "open",
        statusReason: null,
        fixedInScanId: null,
        reopenedInScanId: scanId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(issues.orgId, orgId),
          eq(issues.propertyId, propertyId),
          eq(issues.lastSeenScanId, scanId),
          eq(issues.status, "fixed"),
        ),
      );

    if (done > 0) {
      await tx.execute(sql`
        UPDATE issues i SET status = 'fixed', fixed_in_scan_id = ${scanId}, updated_at = now()
        WHERE i.org_id = ${orgId} AND i.property_id = ${propertyId}
          AND i.status IN ('open', 'in_progress')
          AND i.last_seen_scan_id IS DISTINCT FROM ${scanId}
          AND EXISTS (
            SELECT 1 FROM issue_occurrences o
            WHERE o.issue_id = i.id AND o.scan_id = i.last_seen_scan_id)
          AND NOT EXISTS (
            SELECT 1 FROM issue_occurrences o
            WHERE o.issue_id = i.id AND o.scan_id = i.last_seen_scan_id
              AND NOT EXISTS (
                SELECT 1 FROM scan_pages sp
                WHERE sp.scan_id = ${scanId} AND sp.page_id = o.page_id AND sp.status = 'done'))`);
    }

    const propertyIssues = await tx
      .select({
        impact: issues.impact,
        status: issues.status,
        isBestPractice: issues.isBestPractice,
        needsReview: issues.needsReview,
        occurrenceCount: issues.occurrenceCount,
        lastSeenScanId: issues.lastSeenScanId,
        firstSeenScanId: issues.firstSeenScanId,
        fixedInScanId: issues.fixedInScanId,
        reopenedInScanId: issues.reopenedInScanId,
      })
      .from(issues)
      .where(and(eq(issues.orgId, orgId), eq(issues.propertyId, propertyId)));

    const seenViolations = propertyIssues.filter(
      (i) => i.lastSeenScanId === scanId && !i.isBestPractice && i.status !== "false_positive",
    );
    const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const issue of seenViolations) byImpact[toImpactKey(issue.impact)]++;

    const summary: ScanSummary = {
      score:
        done > 0
          ? score(
              seenViolations.map((i) => ({
                impact: toImpactKey(i.impact),
                occurrences: i.occurrenceCount,
              })),
            )
          : null,
      newIssues: propertyIssues.filter((i) => i.firstSeenScanId === scanId && !i.isBestPractice)
        .length,
      fixedIssues: propertyIssues.filter((i) => i.fixedInScanId === scanId && !i.isBestPractice)
        .length,
      reopenedIssues: propertyIssues.filter(
        (i) => i.reopenedInScanId === scanId && !i.isBestPractice,
      ).length,
      openIssues: propertyIssues.filter(
        (i) => !i.isBestPractice && (i.status === "open" || i.status === "in_progress"),
      ).length,
      bestPracticeIssues: propertyIssues.filter(
        (i) => i.isBestPractice && !i.needsReview && i.lastSeenScanId === scanId,
      ).length,
      reviewFindings: propertyIssues.filter((i) => i.needsReview && i.lastSeenScanId === scanId)
        .length,
      byImpact,
    };

    const failedScan = done === 0;
    await tx
      .update(scans)
      .set({
        status: failedScan ? "failed" : "completed",
        error: failedScan
          ? failed > 0
            ? "None of the pages could be scanned."
            : "No pages were found to scan."
          : null,
        finishedAt: new Date(),
        pagesScanned: done,
        pagesFailed: failed,
        summary,
      })
      .where(and(eq(scans.orgId, orgId), eq(scans.id, scanId)));

    return summary;
  });
}
