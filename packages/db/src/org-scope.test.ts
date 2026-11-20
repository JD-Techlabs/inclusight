import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./client";
import { listOrganizationsForUser, orgScope } from "./org-scope";
import * as schema from "./schema";

let db: Database;

beforeAll(async () => {
  const pglite = drizzle(new PGlite(), { schema });
  await migrate(pglite, { migrationsFolder: "./drizzle" });
  db = pglite;

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
  const expiresAt = new Date(Date.now() + 86_400_000);
  await db.insert(schema.invitations).values([
    {
      id: "i-a",
      organizationId: "org-a",
      email: "new@a.test",
      role: "viewer",
      inviterId: "u-a",
      expiresAt,
    },
    {
      id: "i-b",
      organizationId: "org-b",
      email: "new@b.test",
      role: "viewer",
      inviterId: "u-b",
      expiresAt,
    },
  ]);
  await orgScope(db, "org-a").auditLog.record({
    actorId: "u-a",
    action: "organization.created",
    targetType: "organization",
    targetId: "org-a",
  });
  await orgScope(db, "org-b").auditLog.record({
    actorId: "u-b",
    action: "organization.created",
    targetType: "organization",
    targetId: "org-b",
    metadata: { marker: "b-only" },
  });
});

describe("orgScope tenant isolation", () => {
  it("rejects an empty organisation id", () => {
    expect(() => orgScope(db, "")).toThrow();
    expect(() => orgScope(db, undefined as unknown as string)).toThrow();
  });

  it("lists only the scoped organisation's members", async () => {
    const members = await orgScope(db, "org-a").members.list();
    expect(members.map((m) => m.userId)).toEqual(["u-a"]);
  });

  it("cannot find another organisation's member", async () => {
    expect(await orgScope(db, "org-a").members.findByUserId("u-b")).toBeNull();
    expect(await orgScope(db, "org-b").members.findByUserId("u-b")).not.toBeNull();
  });

  it("lists only the scoped organisation's pending invitations", async () => {
    const pending = await orgScope(db, "org-a").invitations.listPending();
    expect(pending.map((i) => i.id)).toEqual(["i-a"]);
  });

  it("returns only the scoped organisation's audit log", async () => {
    const entries = await orgScope(db, "org-a").auditLog.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.targetId).toBe("org-a");
    expect(JSON.stringify(entries)).not.toContain("b-only");
  });

  it("writes audit entries with the scope's org id, never a caller-supplied one", async () => {
    const scope = orgScope(db, "org-a");
    // A caller trying to smuggle another org id through the entry has no effect.
    await scope.auditLog.record({
      actorId: "u-a",
      action: "test.action",
      targetType: "test",
      ...({ orgId: "org-b" } as object),
    });
    const b = await orgScope(db, "org-b").auditLog.list();
    expect(b.some((e) => e.action === "test.action")).toBe(false);
    const a = await scope.auditLog.list();
    expect(a.some((e) => e.action === "test.action")).toBe(true);
  });

  it("returns the scoped organisation only", async () => {
    expect((await orgScope(db, "org-b").organization.get())?.name).toBe("Beta Advisers");
    expect(await orgScope(db, "org-missing").organization.get()).toBeNull();
  });

  it("lists a user's own organisations only", async () => {
    const orgs = await listOrganizationsForUser(db, "u-a");
    expect(orgs.map((o) => o.id)).toEqual(["org-a"]);
  });
});
