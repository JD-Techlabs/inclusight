import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { ACTIVE_SCAN_STATUSES, type ScanTrigger } from "../domain";
import { pages, properties, scanPages, scans } from "../schema";

export type ScanRow = typeof scans.$inferSelect;

export type ScanSummary = {
  score: number | null;
  newIssues: number;
  fixedIssues: number;
  reopenedIssues: number;
  openIssues: number;
  bestPracticeIssues: number;
  /** Findings a person must check (absent in summaries from before Phase 2). */
  reviewFindings?: number;
  byImpact: Record<"critical" | "serious" | "moderate" | "minor", number>;
};

export function scansScope(db: Database, orgId: string) {
  const own = (scanId: string) => and(eq(scans.orgId, orgId), eq(scans.id, scanId));

  return {
    /** Creates a queued scan; returns null when the property is not in this organisation. */
    async create(input: {
      propertyId: string;
      mode: "full" | "single_page";
      trigger: ScanTrigger;
      createdBy: string | null;
    }): Promise<ScanRow | null> {
      const [property] = await db
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.orgId, orgId), eq(properties.id, input.propertyId)));
      if (!property) return null;
      const [row] = await db
        .insert(scans)
        .values({ ...input, orgId })
        .returning();
      return row!;
    },

    async get(scanId: string) {
      const [row] = await db
        .select({
          scan: scans,
          propertyName: properties.name,
          propertyBaseUrl: properties.baseUrl,
          propertyVerified: properties.verified,
          propertyScanConfig: properties.scanConfig,
        })
        .from(scans)
        .innerJoin(properties, eq(properties.id, scans.propertyId))
        .where(own(scanId));
      return row ?? null;
    },

    listForProperty(propertyId: string, limit = 20) {
      return db
        .select()
        .from(scans)
        .where(and(eq(scans.orgId, orgId), eq(scans.propertyId, propertyId)))
        .orderBy(desc(scans.createdAt))
        .limit(limit);
    },

    async activeForProperty(propertyId: string): Promise<ScanRow | null> {
      const [row] = await db
        .select()
        .from(scans)
        .where(
          and(
            eq(scans.orgId, orgId),
            eq(scans.propertyId, propertyId),
            inArray(scans.status, [...ACTIVE_SCAN_STATUSES]),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async countSince(since: Date, mode?: "full" | "single_page"): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(scans)
        .where(
          and(
            eq(scans.orgId, orgId),
            gte(scans.createdAt, since),
            mode ? eq(scans.mode, mode) : undefined,
          ),
        );
      return row?.n ?? 0;
    },

    /** Page counts by status, for progress display. */
    async progress(scanId: string) {
      const rows = await db
        .select({ status: scanPages.status, n: count() })
        .from(scanPages)
        .where(and(eq(scanPages.orgId, orgId), eq(scanPages.scanId, scanId)))
        .groupBy(scanPages.status);
      const by = (status: string) => rows.find((r) => r.status === status)?.n ?? 0;
      return { pending: by("pending"), done: by("done"), failed: by("failed") };
    },

    listPages(scanId: string, options: { limit: number; offset: number }) {
      return db
        .select({
          scanPageId: scanPages.id,
          pageId: pages.id,
          url: pages.url,
          title: pages.title,
          status: scanPages.status,
          error: scanPages.error,
          violationCount: scanPages.violationCount,
          screenshots: scanPages.screenshots,
        })
        .from(scanPages)
        .innerJoin(pages, eq(pages.id, scanPages.pageId))
        .where(and(eq(scanPages.orgId, orgId), eq(scanPages.scanId, scanId)))
        .orderBy(pages.url)
        .limit(options.limit)
        .offset(options.offset);
    },

    async getScanPage(scanId: string, pageId: string) {
      const [row] = await db
        .select({ screenshots: scanPages.screenshots, url: pages.url })
        .from(scanPages)
        .innerJoin(pages, eq(pages.id, scanPages.pageId))
        .where(
          and(
            eq(scanPages.orgId, orgId),
            eq(scanPages.scanId, scanId),
            eq(scanPages.pageId, pageId),
          ),
        );
      return row ?? null;
    },

    async update(
      scanId: string,
      changes: Partial<
        Pick<ScanRow, "status" | "startedAt" | "finishedAt" | "pagesFound" | "error">
      >,
    ): Promise<void> {
      await db.update(scans).set(changes).where(own(scanId));
    },

    /** Completed scans oldest → newest, for the score trend. */
    async trend(propertyId: string, limit = 20) {
      const rows = await db
        .select({ id: scans.id, finishedAt: scans.finishedAt, summary: scans.summary })
        .from(scans)
        .where(
          and(
            eq(scans.orgId, orgId),
            eq(scans.propertyId, propertyId),
            eq(scans.status, "completed"),
          ),
        )
        .orderBy(desc(scans.finishedAt))
        .limit(limit);
      return rows.reverse().map((row) => ({
        id: row.id,
        finishedAt: row.finishedAt,
        summary: row.summary as ScanSummary | null,
      }));
    },
  };
}
