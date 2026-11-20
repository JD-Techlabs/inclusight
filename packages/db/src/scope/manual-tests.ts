import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { manualTests, properties, users } from "../schema";

export type ManualTestRow = typeof manualTests.$inferSelect;

/** Manual test results per property and criterion (spec §8). */
export function manualTestsScope(db: Database, orgId: string) {
  async function ownsProperty(propertyId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.orgId, orgId), eq(properties.id, propertyId)));
    return !!row;
  }

  const columns = {
    id: manualTests.id,
    propertyId: manualTests.propertyId,
    criterionId: manualTests.criterionId,
    result: manualTests.result,
    notes: manualTests.notes,
    testedAt: manualTests.testedAt,
    testerName: users.name,
  };

  return {
    listForProperties(propertyIds: string[]) {
      if (propertyIds.length === 0) return Promise.resolve([]);
      return db
        .select(columns)
        .from(manualTests)
        .leftJoin(users, eq(users.id, manualTests.testerId))
        .where(and(eq(manualTests.orgId, orgId), inArray(manualTests.propertyId, propertyIds)));
    },

    async get(propertyId: string, criterionId: string) {
      const [row] = await db
        .select(columns)
        .from(manualTests)
        .leftJoin(users, eq(users.id, manualTests.testerId))
        .where(
          and(
            eq(manualTests.orgId, orgId),
            eq(manualTests.propertyId, propertyId),
            eq(manualTests.criterionId, criterionId),
          ),
        );
      return row ?? null;
    },

    /** Records a result (upsert). Returns null when the property is not in this organisation. */
    async record(input: {
      propertyId: string;
      criterionId: string;
      result: string;
      notes: string;
      testerId: string;
    }): Promise<ManualTestRow | null> {
      if (!(await ownsProperty(input.propertyId))) return null;
      const now = new Date();
      const [row] = await db
        .insert(manualTests)
        .values({ ...input, orgId, testedAt: now })
        .onConflictDoUpdate({
          target: [manualTests.propertyId, manualTests.criterionId],
          set: {
            result: input.result,
            notes: input.notes,
            testerId: input.testerId,
            testedAt: now,
            updatedAt: now,
          },
        })
        .returning();
      return row!;
    },

    /** The row for a criterion, created as "not tested" if needed (to attach evidence to). */
    async ensure(propertyId: string, criterionId: string): Promise<ManualTestRow | null> {
      if (!(await ownsProperty(propertyId))) return null;
      const [row] = await db
        .insert(manualTests)
        .values({ orgId, propertyId, criterionId })
        .onConflictDoUpdate({
          target: [manualTests.propertyId, manualTests.criterionId],
          set: { updatedAt: sql`${manualTests.updatedAt}` },
        })
        .returning();
      return row!;
    },
  };
}
