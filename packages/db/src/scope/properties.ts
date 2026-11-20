import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { memberships, properties } from "../schema";

export type PropertyRow = typeof properties.$inferSelect;

export function propertiesScope(db: Database, orgId: string) {
  const own = (propertyId: string) =>
    and(eq(properties.orgId, orgId), eq(properties.id, propertyId));

  return {
    list() {
      return db
        .select()
        .from(properties)
        .where(eq(properties.orgId, orgId))
        .orderBy(desc(properties.createdAt));
    },

    async get(propertyId: string): Promise<PropertyRow | null> {
      const [row] = await db.select().from(properties).where(own(propertyId));
      return row ?? null;
    },

    async findByBaseUrl(baseUrl: string): Promise<PropertyRow | null> {
      const [row] = await db
        .select()
        .from(properties)
        .where(and(eq(properties.orgId, orgId), eq(properties.baseUrl, baseUrl)));
      return row ?? null;
    },

    async create(input: {
      name: string;
      baseUrl: string;
      isInvestorFacing: boolean;
      verificationToken: string;
      createdBy: string;
    }): Promise<PropertyRow> {
      const [row] = await db
        .insert(properties)
        .values({ ...input, orgId, type: "web" })
        .returning();
      return row!;
    },

    async update(
      propertyId: string,
      changes: Partial<Pick<PropertyRow, "name" | "isInvestorFacing" | "scanConfig">>,
    ): Promise<boolean> {
      const rows = await db
        .update(properties)
        .set({ ...changes, updatedAt: new Date() })
        .where(own(propertyId))
        .returning({ id: properties.id });
      return rows.length > 0;
    },

    /** Sets the member responsible for the property; false if they are not a member. */
    async setOwner(propertyId: string, ownerId: string | null): Promise<boolean> {
      if (ownerId) {
        const [member] = await db
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, ownerId)));
        if (!member) return false;
      }
      const rows = await db
        .update(properties)
        .set({ ownerId, updatedAt: new Date() })
        .where(own(propertyId))
        .returning({ id: properties.id });
      return rows.length > 0;
    },

    async markVerified(propertyId: string, method: string): Promise<boolean> {
      const rows = await db
        .update(properties)
        .set({
          verified: true,
          verificationMethod: method,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(own(propertyId))
        .returning({ id: properties.id });
      return rows.length > 0;
    },

    async delete(propertyId: string): Promise<boolean> {
      const rows = await db
        .delete(properties)
        .where(own(propertyId))
        .returning({ id: properties.id });
      return rows.length > 0;
    },
  };
}
