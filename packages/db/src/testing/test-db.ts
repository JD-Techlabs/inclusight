import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "../client";
import * as schema from "../schema";

/** Fresh in-memory Postgres with all migrations applied (tests only). */
export async function createTestDb(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

/** Two organisations, each with an owner. */
export async function seedTwoOrgs(db: Database) {
  await db.insert(schema.users).values([
    { id: "u-a", name: "Asha", email: "asha@a.test" },
    { id: "u-b", name: "Bala", email: "bala@b.test" },
  ]);
  await db.insert(schema.organizations).values([
    { id: "org-a", name: "Alpha Broking", slug: "alpha" },
    { id: "org-b", name: "Beta Advisers", slug: "beta" },
  ]);
  await db.insert(schema.memberships).values([
    { id: "m-a", organizationId: "org-a", userId: "u-a", role: "owner" },
    { id: "m-b", organizationId: "org-b", userId: "u-b", role: "owner" },
  ]);
}
