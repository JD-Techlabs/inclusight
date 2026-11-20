import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "../client";
import { issues, memberships, properties, scans, users } from "../schema";
import type { ScanSummary } from "./scans";

/** Read models for the conformance matrix, audit snapshots and reports. Org-scoped. */
export function complianceInputsScope(db: Database, orgId: string) {
  const fixedScan = alias(scans, "fixed_scan");
  const severity = sql`CASE ${issues.impact} WHEN 'critical' THEN 0 WHEN 'serious' THEN 1 WHEN 'moderate' THEN 2 ELSE 3 END`;

  return {
    /** Issues with the given statuses, counted per property, rule, impact, status, criteria and category. */
    findingRows(propertyIds: string[], statuses: readonly string[]) {
      if (propertyIds.length === 0) return Promise.resolve([]);
      return db
        .select({
          propertyId: issues.propertyId,
          ruleId: issues.ruleId,
          impact: issues.impact,
          status: issues.status,
          criteria: issues.criteria,
          isBestPractice: issues.isBestPractice,
          needsReview: issues.needsReview,
          count: count(),
        })
        .from(issues)
        .where(
          and(
            eq(issues.orgId, orgId),
            inArray(issues.propertyId, propertyIds),
            inArray(issues.status, [...statuses]),
          ),
        )
        .groupBy(
          issues.propertyId,
          issues.ruleId,
          issues.impact,
          issues.status,
          issues.criteria,
          issues.isBestPractice,
          issues.needsReview,
        );
    },

    /** The most recent completed scan of each property (absent when never scanned). */
    async latestCompletedScans(propertyIds: string[]) {
      const latest = new Map<
        string,
        { id: string; finishedAt: Date | null; pagesScanned: number; summary: ScanSummary | null }
      >();
      if (propertyIds.length === 0) return latest;
      const rows = await db
        .selectDistinctOn([scans.propertyId], {
          propertyId: scans.propertyId,
          id: scans.id,
          finishedAt: scans.finishedAt,
          pagesScanned: scans.pagesScanned,
          summary: scans.summary,
        })
        .from(scans)
        .where(
          and(
            eq(scans.orgId, orgId),
            inArray(scans.propertyId, propertyIds),
            eq(scans.status, "completed"),
          ),
        )
        .orderBy(scans.propertyId, desc(scans.finishedAt));
      for (const row of rows) {
        latest.set(row.propertyId, { ...row, summary: row.summary as ScanSummary | null });
      }
      return latest;
    },

    /** WCAG violations and review findings for reports, most severe first, capped. */
    issuesForReport(propertyIds: string[], limit = 5000) {
      if (propertyIds.length === 0) return Promise.resolve([]);
      return db
        .select({
          id: issues.id,
          propertyId: issues.propertyId,
          ruleId: issues.ruleId,
          impact: issues.impact,
          criteria: issues.criteria,
          helpText: issues.helpText,
          status: issues.status,
          statusReason: issues.statusReason,
          needsReview: issues.needsReview,
          occurrenceCount: issues.occurrenceCount,
          pageCount: issues.pageCount,
          targetDate: issues.targetDate,
          firstSeenAt: issues.createdAt,
          fixedAt: fixedScan.finishedAt,
          fixedInScanId: issues.fixedInScanId,
          assigneeName: users.name,
        })
        .from(issues)
        .leftJoin(users, eq(users.id, issues.assigneeId))
        .leftJoin(fixedScan, eq(fixedScan.id, issues.fixedInScanId))
        .where(
          and(
            eq(issues.orgId, orgId),
            inArray(issues.propertyId, propertyIds),
            sql`(${issues.isBestPractice} = false OR ${issues.needsReview} = true)`,
          ),
        )
        .orderBy(asc(severity), desc(issues.occurrenceCount), asc(issues.id))
        .limit(limit);
    },

    /** Properties with their owner's name, for the platform inventory. */
    propertiesWithOwners() {
      return db
        .select({ property: properties, ownerName: users.name })
        .from(properties)
        .leftJoin(users, eq(users.id, properties.ownerId))
        .where(eq(properties.orgId, orgId))
        .orderBy(asc(properties.name));
    },

    /** Members holding a role (e.g. nodal officers named in the annual report). */
    membersWithRole(role: string) {
      return db
        .select({ userId: users.id, name: users.name, email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.organizationId, orgId), eq(memberships.role, role)))
        .orderBy(asc(users.name));
    },
  };
}
