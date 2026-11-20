import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { reports, users, type ReportFile, type ReportSignOff } from "../schema";

export type ReportRow = typeof reports.$inferSelect;

/** Generated reports (spec §9). The worker moves them queued → generating → ready / failed. */
export function reportsScope(db: Database, orgId: string) {
  const own = (reportId: string) => and(eq(reports.orgId, orgId), eq(reports.id, reportId));

  return {
    list(limit = 100) {
      return db
        .select({ report: reports, generatedByName: users.name })
        .from(reports)
        .leftJoin(users, eq(users.id, reports.generatedBy))
        .where(eq(reports.orgId, orgId))
        .orderBy(desc(reports.createdAt))
        .limit(limit);
    },

    async get(reportId: string) {
      const [row] = await db
        .select({ report: reports, generatedByName: users.name })
        .from(reports)
        .leftJoin(users, eq(users.id, reports.generatedBy))
        .where(own(reportId));
      return row ?? null;
    },

    async create(input: {
      type: string;
      title: string;
      period: string;
      params: Record<string, unknown>;
      generatedBy: string;
    }): Promise<ReportRow> {
      const [row] = await db
        .insert(reports)
        .values({ ...input, orgId })
        .returning();
      return row!;
    },

    /** Claims a queued or failed (retrying) report for generation; false if already done. */
    async markGenerating(reportId: string): Promise<boolean> {
      const rows = await db
        .update(reports)
        .set({ status: "generating", error: null })
        .where(and(own(reportId), inArray(reports.status, ["queued", "generating", "failed"])))
        .returning({ id: reports.id });
      return rows.length > 0;
    },

    async markReady(reportId: string, files: Partial<Record<string, ReportFile>>): Promise<void> {
      await db
        .update(reports)
        .set({ status: "ready", files, error: null, finishedAt: new Date() })
        .where(own(reportId));
    },

    async markFailed(reportId: string, error: string): Promise<void> {
      await db
        .update(reports)
        .set({ status: "failed", error: error.slice(0, 500), finishedAt: new Date() })
        .where(own(reportId));
    },

    /**
     * Records a sign-off (who approved and when; spec §9). A person signs a report once per
     * designation. Returns false when the report is not ready or already signed by them.
     */
    async addSignOff(reportId: string, signOff: ReportSignOff): Promise<boolean> {
      const rows = await db
        .update(reports)
        .set({ signedBy: sql`${reports.signedBy} || ${JSON.stringify([signOff])}::jsonb` })
        .where(
          and(
            own(reportId),
            eq(reports.status, "ready"),
            sql`NOT ${reports.signedBy} @> ${JSON.stringify([
              { userId: signOff.userId, designation: signOff.designation },
            ])}::jsonb`,
          ),
        )
        .returning({ id: reports.id });
      return rows.length > 0;
    },
  };
}
