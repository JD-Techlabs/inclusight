import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { audits, properties, users, type AuditSnapshotJson } from "../schema";

export type AuditRow = typeof audits.$inferSelect;

export type AuditInput = {
  title: string;
  auditorName: string;
  iaapCertId: string;
  auditorOrg: string;
  startDate: string;
  endDate: string | null;
  propertyIds: string[];
  standardId: string;
  methodology: string;
};

/** Audits (spec §8): created in progress, findings locked into a snapshot when closed. */
export function auditsScope(db: Database, orgId: string) {
  const own = (auditId: string) => and(eq(audits.orgId, orgId), eq(audits.id, auditId));

  async function allPropertiesOwned(propertyIds: string[]): Promise<boolean> {
    if (propertyIds.length === 0) return false;
    const rows = await db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.orgId, orgId), inArray(properties.id, propertyIds)));
    return rows.length === new Set(propertyIds).size;
  }

  return {
    list() {
      return db
        .select()
        .from(audits)
        .where(eq(audits.orgId, orgId))
        .orderBy(desc(audits.createdAt));
    },

    async get(auditId: string) {
      const [row] = await db
        .select({ audit: audits, closedByName: users.name })
        .from(audits)
        .leftJoin(users, eq(users.id, audits.closedBy))
        .where(own(auditId));
      return row ?? null;
    },

    /** Returns null when any property in scope is not in this organisation. */
    async create(input: AuditInput & { createdBy: string }): Promise<AuditRow | null> {
      const propertyIds = [...new Set(input.propertyIds)];
      if (!(await allPropertiesOwned(propertyIds))) return null;
      const [row] = await db
        .insert(audits)
        .values({ ...input, propertyIds, orgId })
        .returning();
      return row!;
    },

    /** Edits an audit that is still in progress. */
    async update(auditId: string, input: AuditInput): Promise<AuditRow | null> {
      const propertyIds = [...new Set(input.propertyIds)];
      if (!(await allPropertiesOwned(propertyIds))) return null;
      const [row] = await db
        .update(audits)
        .set({ ...input, propertyIds, updatedAt: new Date() })
        .where(and(own(auditId), eq(audits.status, "in_progress")))
        .returning();
      return row ?? null;
    },

    /** Locks the findings snapshot. Only an in-progress audit can be closed, exactly once. */
    async close(
      auditId: string,
      snapshot: AuditSnapshotJson,
      closedBy: string,
    ): Promise<AuditRow | null> {
      const now = new Date();
      const [row] = await db
        .update(audits)
        .set({ status: "closed", snapshot, closedAt: now, closedBy, updatedAt: now })
        .where(and(own(auditId), eq(audits.status, "in_progress")))
        .returning();
      return row ?? null;
    },
  };
}
