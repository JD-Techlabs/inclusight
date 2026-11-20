import { and, asc, count, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { Database } from "../client";
import type { IssueCategory, IssueStatus } from "../domain";
import { issueOccurrences, issues, memberships, pages, scanPages, users } from "../schema";

export type IssueRow = typeof issues.$inferSelect;

export type IssueFilters = {
  statuses?: IssueStatus[];
  impact?: string;
  criterion?: string;
  templateHash?: string;
  pageUrlContains?: string;
  assignee?: string; // a user id, or "unassigned"
  /** Which tab: WCAG violations (default), best practice, or findings that need review. */
  category?: IssueCategory;
};

export type IssueSort = "severity" | "occurrences";

const severityOrder = sql`CASE ${issues.impact} WHEN 'critical' THEN 0 WHEN 'serious' THEN 1 WHEN 'moderate' THEN 2 ELSE 3 END`;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function issuesScope(db: Database, orgId: string) {
  function where(propertyId: string, filters: IssueFilters): SQL {
    const conditions: (SQL | undefined)[] = [
      eq(issues.orgId, orgId),
      eq(issues.propertyId, propertyId),
      eq(issues.isBestPractice, (filters.category ?? "wcag") !== "wcag"),
      eq(issues.needsReview, filters.category === "review"),
    ];
    if (filters.statuses?.length) conditions.push(inArray(issues.status, filters.statuses));
    if (filters.impact) conditions.push(eq(issues.impact, filters.impact));
    if (filters.criterion) conditions.push(sql`${filters.criterion} = ANY(${issues.criteria})`);
    if (filters.templateHash) conditions.push(eq(issues.templateHash, filters.templateHash));
    if (filters.assignee === "unassigned") conditions.push(isNull(issues.assigneeId));
    else if (filters.assignee) conditions.push(eq(issues.assigneeId, filters.assignee));
    if (filters.pageUrlContains) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${issueOccurrences} o JOIN ${pages} p ON p.id = o.page_id
            WHERE o.issue_id = ${issues.id} AND o.scan_id = ${issues.lastSeenScanId}
              AND p.url ILIKE ${`%${escapeLike(filters.pageUrlContains)}%`})`,
      );
    }
    return and(...conditions)!;
  }

  const listColumns = {
    id: issues.id,
    ruleId: issues.ruleId,
    impact: issues.impact,
    criteria: issues.criteria,
    helpText: issues.helpText,
    status: issues.status,
    occurrenceCount: issues.occurrenceCount,
    pageCount: issues.pageCount,
    targetDate: issues.targetDate,
    assigneeName: users.name,
  };

  return {
    async list(
      propertyId: string,
      filters: IssueFilters,
      options: { sort: IssueSort; limit: number; offset: number },
    ) {
      const condition = where(propertyId, filters);
      const order =
        options.sort === "occurrences"
          ? [desc(issues.occurrenceCount), asc(severityOrder), asc(issues.id)]
          : [asc(severityOrder), desc(issues.occurrenceCount), asc(issues.id)];
      const [rows, [total]] = await Promise.all([
        db
          .select(listColumns)
          .from(issues)
          .leftJoin(users, eq(users.id, issues.assigneeId))
          .where(condition)
          .orderBy(...order)
          .limit(options.limit)
          .offset(options.offset),
        db.select({ n: count() }).from(issues).where(condition),
      ]);
      return { rows, total: total?.n ?? 0 };
    },

    /** Full rows for CSV/XLSX export, capped. */
    forExport(propertyId: string, filters: IssueFilters, limit: number) {
      return db
        .select({ issue: issues, assigneeName: users.name })
        .from(issues)
        .leftJoin(users, eq(users.id, issues.assigneeId))
        .where(where(propertyId, filters))
        .orderBy(asc(severityOrder), desc(issues.occurrenceCount))
        .limit(limit);
    },

    async get(issueId: string) {
      const [row] = await db
        .select({ issue: issues, assigneeName: users.name })
        .from(issues)
        .leftJoin(users, eq(users.id, issues.assigneeId))
        .where(and(eq(issues.orgId, orgId), eq(issues.id, issueId)));
      return row ?? null;
    },

    /** Occurrences of an issue in the last scan that saw it. */
    occurrences(issue: Pick<IssueRow, "id" | "lastSeenScanId">, limit = 100) {
      if (!issue.lastSeenScanId) return Promise.resolve([]);
      return db
        .select({
          id: issueOccurrences.id,
          viewport: issueOccurrences.viewport,
          selector: issueOccurrences.selector,
          htmlSnippet: issueOccurrences.htmlSnippet,
          failureSummary: issueOccurrences.failureSummary,
          bbox: issueOccurrences.bbox,
          pageId: pages.id,
          pageUrl: pages.url,
          scanId: issueOccurrences.scanId,
          screenshots: scanPages.screenshots,
        })
        .from(issueOccurrences)
        .innerJoin(pages, eq(pages.id, issueOccurrences.pageId))
        .leftJoin(
          scanPages,
          and(
            eq(scanPages.scanId, issueOccurrences.scanId),
            eq(scanPages.pageId, issueOccurrences.pageId),
          ),
        )
        .where(
          and(
            eq(issueOccurrences.orgId, orgId),
            eq(issueOccurrences.issueId, issue.id),
            eq(issueOccurrences.scanId, issue.lastSeenScanId),
          ),
        )
        .orderBy(pages.url, issueOccurrences.viewport)
        .limit(limit);
    },

    /** Values for the filter controls: criteria and templates (with an example page). */
    async filterOptions(propertyId: string) {
      const base = and(eq(issues.orgId, orgId), eq(issues.propertyId, propertyId));
      const [criteria, templates] = await Promise.all([
        db
          .selectDistinct({ criterion: sql<string>`unnest(${issues.criteria})` })
          .from(issues)
          .where(base),
        db
          .select({
            templateHash: pages.templateHash,
            exampleUrl: sql<string>`min(${pages.url})`,
            pageCount: count(),
          })
          .from(pages)
          .where(and(eq(pages.orgId, orgId), eq(pages.propertyId, propertyId)))
          .groupBy(pages.templateHash)
          .orderBy(desc(count())),
      ]);
      return {
        criteria: criteria.map((c) => c.criterion),
        templates: templates.filter(
          (t): t is typeof t & { templateHash: string } => !!t.templateHash,
        ),
      };
    },

    /** Sets the status of issues in this organisation; returns the ids actually changed. */
    async setStatus(issueIds: string[], status: IssueStatus, reason: string | null) {
      if (issueIds.length === 0) return [];
      return db
        .update(issues)
        .set({
          status,
          statusReason: reason,
          fixedInScanId: status === "fixed" ? undefined : null,
          updatedAt: new Date(),
        })
        .where(and(eq(issues.orgId, orgId), inArray(issues.id, issueIds)))
        .returning({ id: issues.id, propertyId: issues.propertyId });
    },

    /** Assigns issues to a member of this organisation (or unassigns with null). */
    async assign(issueIds: string[], assigneeId: string | null) {
      if (issueIds.length === 0) return [];
      if (assigneeId) {
        const [member] = await db
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, assigneeId)));
        if (!member) return [];
      }
      return db
        .update(issues)
        .set({ assigneeId, updatedAt: new Date() })
        .where(and(eq(issues.orgId, orgId), inArray(issues.id, issueIds)))
        .returning({ id: issues.id });
    },

    /** Sets the remediation target date (YYYY-MM-DD) of issues, or clears it with null. */
    async setTargetDate(issueIds: string[], targetDate: string | null) {
      if (issueIds.length === 0) return [];
      return db
        .update(issues)
        .set({ targetDate, updatedAt: new Date() })
        .where(and(eq(issues.orgId, orgId), inArray(issues.id, issueIds)))
        .returning({ id: issues.id, propertyId: issues.propertyId });
    },

    async countByPropertyId(propertyId: string, statuses: IssueStatus[]) {
      const [row] = await db
        .select({ n: count() })
        .from(issues)
        .where(
          and(
            eq(issues.orgId, orgId),
            eq(issues.propertyId, propertyId),
            eq(issues.isBestPractice, false),
            inArray(issues.status, statuses),
          ),
        );
      return row?.n ?? 0;
    },
  };
}
