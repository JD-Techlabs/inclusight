import { and, count, eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  issueOccurrences,
  issues,
  pages,
  properties,
  scanPages,
  scans,
  type OccurrenceBox,
  type ScreenshotRef,
} from "../schema";

export type PageIssueInput = {
  fingerprint: string;
  ruleId: string;
  impact: string;
  criteria: string[];
  isBestPractice: boolean;
  needsReview: boolean;
  helpText: string;
  description: string;
  helpUrl: string | null;
  normalisedSelector: string;
  templateHash: string;
  occurrences: Array<{
    viewport: string;
    selector: string;
    htmlSnippet: string;
    failureSummary: string;
    screenshotKey: string | null;
    bbox: OccurrenceBox | null;
  }>;
};

const CHUNK = 500;

/**
 * Writes made by scan jobs. Every write is idempotent (upserts / ON CONFLICT DO NOTHING), so a
 * retried job never duplicates pages, issues or occurrences.
 */
export function scanResultsScope(db: Database, orgId: string) {
  return {
    /** Upserts pages for the property and returns their ids keyed by URL. */
    async upsertPages(propertyId: string, urls: string[]): Promise<Map<string, string>> {
      const ids = new Map<string, string>();
      for (let i = 0; i < urls.length; i += CHUNK) {
        const rows = await db
          .insert(pages)
          .values(urls.slice(i, i + CHUNK).map((url) => ({ orgId, propertyId, url })))
          .onConflictDoUpdate({
            target: [pages.propertyId, pages.url],
            set: { url: sql`excluded.url` },
          })
          .returning({ id: pages.id, url: pages.url });
        for (const row of rows) ids.set(row.url, row.id);
      }
      return ids;
    },

    async createScanPages(scanId: string, pageIds: string[]) {
      for (let i = 0; i < pageIds.length; i += CHUNK) {
        await db
          .insert(scanPages)
          .values(pageIds.slice(i, i + CHUNK).map((pageId) => ({ orgId, scanId, pageId })))
          .onConflictDoNothing();
      }
      return db
        .select({ id: scanPages.id, status: scanPages.status })
        .from(scanPages)
        .where(and(eq(scanPages.orgId, orgId), eq(scanPages.scanId, scanId)));
    },

    /** Everything a scan-page job needs, or null if the row is not in this organisation. */
    async getScanPageJob(scanPageId: string) {
      const [row] = await db
        .select({
          scanPage: scanPages,
          url: pages.url,
          propertyId: properties.id,
          scanConfig: properties.scanConfig,
          scanStatus: scans.status,
        })
        .from(scanPages)
        .innerJoin(pages, eq(pages.id, scanPages.pageId))
        .innerJoin(scans, eq(scans.id, scanPages.scanId))
        .innerJoin(properties, eq(properties.id, scans.propertyId))
        .where(and(eq(scanPages.orgId, orgId), eq(scanPages.id, scanPageId)));
      return row ?? null;
    },

    async recordPageResult(input: {
      scanId: string;
      scanPageId: string;
      pageId: string;
      propertyId: string;
      title: string;
      templateHash: string;
      screenshots: Partial<Record<string, ScreenshotRef>>;
      issues: PageIssueInput[];
    }): Promise<void> {
      await db.transaction(async (tx) => {
        let violationCount = 0;
        for (const issue of input.issues) {
          const { occurrences, ...fields } = issue;
          const [row] = await tx
            .insert(issues)
            .values({
              ...fields,
              orgId,
              propertyId: input.propertyId,
              firstSeenScanId: input.scanId,
              lastSeenScanId: input.scanId,
            })
            .onConflictDoUpdate({
              target: [issues.propertyId, issues.fingerprint],
              set: {
                lastSeenScanId: input.scanId,
                impact: sql`excluded.impact`,
                criteria: sql`excluded.criteria`,
                isBestPractice: sql`excluded.is_best_practice`,
                needsReview: sql`excluded.needs_review`,
                helpText: sql`excluded.help_text`,
                description: sql`excluded.description`,
                helpUrl: sql`excluded.help_url`,
                updatedAt: new Date(),
              },
            })
            .returning({ id: issues.id });
          if (!issue.isBestPractice) violationCount += occurrences.length;
          if (occurrences.length === 0) continue;
          await tx
            .insert(issueOccurrences)
            .values(
              occurrences.map((o) => ({
                ...o,
                orgId,
                issueId: row!.id,
                scanId: input.scanId,
                pageId: input.pageId,
              })),
            )
            .onConflictDoNothing();
        }
        await tx
          .update(pages)
          .set({ title: input.title, templateHash: input.templateHash, lastScannedAt: new Date() })
          .where(and(eq(pages.orgId, orgId), eq(pages.id, input.pageId)));
        await tx
          .update(scanPages)
          .set({
            status: "done",
            error: null,
            screenshots: input.screenshots,
            violationCount,
            finishedAt: new Date(),
          })
          .where(and(eq(scanPages.orgId, orgId), eq(scanPages.id, input.scanPageId)));
      });
    },

    async failScanPage(scanPageId: string, error: string): Promise<void> {
      await db
        .update(scanPages)
        .set({ status: "failed", error: error.slice(0, 500), finishedAt: new Date() })
        .where(and(eq(scanPages.orgId, orgId), eq(scanPages.id, scanPageId)));
    },

    async countPending(scanId: string): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(scanPages)
        .where(
          and(
            eq(scanPages.orgId, orgId),
            eq(scanPages.scanId, scanId),
            eq(scanPages.status, "pending"),
          ),
        );
      return row?.n ?? 0;
    },
  };
}
