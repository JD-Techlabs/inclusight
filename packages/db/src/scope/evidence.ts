import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import type { EvidenceLinkType } from "../domain";
import { evidence, manualTests, users } from "../schema";

export type EvidenceRow = typeof evidence.$inferSelect;

/** Evidence files attached to manual tests. The file itself is in object storage. */
export function evidenceScope(db: Database, orgId: string) {
  return {
    /**
     * Records an uploaded file against a manual test of this organisation. Returns null when
     * the manual test belongs to another organisation.
     */
    async create(input: {
      linkedType: EvidenceLinkType;
      linkedId: string;
      fileKey: string;
      fileName: string;
      contentType: string;
      sizeBytes: number;
      description: string;
      uploadedBy: string;
    }): Promise<EvidenceRow | null> {
      const [target] = await db
        .select({ propertyId: manualTests.propertyId })
        .from(manualTests)
        .where(and(eq(manualTests.orgId, orgId), eq(manualTests.id, input.linkedId)));
      if (!target) return null;
      const [row] = await db
        .insert(evidence)
        .values({ ...input, orgId, propertyId: target.propertyId })
        .returning();
      return row!;
    },

    list(linkedType: EvidenceLinkType, linkedId: string) {
      return db
        .select({
          id: evidence.id,
          fileName: evidence.fileName,
          contentType: evidence.contentType,
          sizeBytes: evidence.sizeBytes,
          description: evidence.description,
          createdAt: evidence.createdAt,
          uploaderName: users.name,
        })
        .from(evidence)
        .leftJoin(users, eq(users.id, evidence.uploadedBy))
        .where(
          and(
            eq(evidence.orgId, orgId),
            eq(evidence.linkedType, linkedType),
            eq(evidence.linkedId, linkedId),
          ),
        )
        .orderBy(desc(evidence.createdAt));
    },

    /** Number of files per linked id, for lists and reports. */
    async countByLink(linkedType: EvidenceLinkType, linkedIds: string[]) {
      const counts = new Map<string, number>();
      if (linkedIds.length === 0) return counts;
      const rows = await db
        .select({ linkedId: evidence.linkedId, n: count() })
        .from(evidence)
        .where(
          and(
            eq(evidence.orgId, orgId),
            eq(evidence.linkedType, linkedType),
            inArray(evidence.linkedId, linkedIds),
          ),
        )
        .groupBy(evidence.linkedId);
      for (const row of rows) counts.set(row.linkedId, row.n);
      return counts;
    },

    async get(evidenceId: string): Promise<EvidenceRow | null> {
      const [row] = await db
        .select()
        .from(evidence)
        .where(and(eq(evidence.orgId, orgId), eq(evidence.id, evidenceId)));
      return row ?? null;
    },

    async delete(evidenceId: string): Promise<EvidenceRow | null> {
      const [row] = await db
        .delete(evidence)
        .where(and(eq(evidence.orgId, orgId), eq(evidence.id, evidenceId)))
        .returning();
      return row ?? null;
    },
  };
}
