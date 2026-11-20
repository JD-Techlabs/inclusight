import { and, desc, eq } from "drizzle-orm";
import type { Database } from "./client";
import { auditLog, invitations, memberships, organizations, users } from "./schema";
import { auditsScope } from "./scope/audits";
import { complianceInputsScope } from "./scope/compliance-inputs";
import { evidenceScope } from "./scope/evidence";
import { finalizeScan, type ScoreFunction } from "./scope/finalize-scan";
import { issuesScope } from "./scope/issues";
import { manualTestsScope } from "./scope/manual-tests";
import { propertiesScope } from "./scope/properties";
import { reportsScope } from "./scope/reports";
import { scanResultsScope } from "./scope/scan-results";
import { scansScope } from "./scope/scans";

export type AuditEntryInput = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  /** Never put secrets, tokens, form values or personal data in metadata. */
  metadata?: Record<string, string | number | boolean | null>;
  ip?: string | null;
};

/**
 * The tenant data-access layer. Every query on a tenant table goes through an OrgScope,
 * which pins `org_id` to the organisation it was created for. Application code must not
 * query tenant tables directly.
 */
export function orgScope(db: Database, orgId: string) {
  if (typeof orgId !== "string" || orgId.length === 0) {
    throw new Error("orgScope requires a non-empty organisation id");
  }

  return {
    orgId,

    properties: propertiesScope(db, orgId),
    scans: scansScope(db, orgId),
    issues: issuesScope(db, orgId),
    manualTests: manualTestsScope(db, orgId),
    evidence: evidenceScope(db, orgId),
    audits: auditsScope(db, orgId),
    reports: reportsScope(db, orgId),
    /** Read models for the conformance matrix, audit snapshots and reports. */
    complianceInputs: complianceInputsScope(db, orgId),
    /** Writes made by scan jobs in the worker. */
    scanResults: {
      ...scanResultsScope(db, orgId),
      finalize: (scanId: string, score: ScoreFunction) => finalizeScan(db, orgId, scanId, score),
    },

    organization: {
      async get() {
        const [row] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        return row ?? null;
      },
    },

    members: {
      list() {
        return db
          .select({
            id: memberships.id,
            userId: memberships.userId,
            role: memberships.role,
            createdAt: memberships.createdAt,
            name: users.name,
            email: users.email,
            twoFactorEnabled: users.twoFactorEnabled,
          })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(eq(memberships.organizationId, orgId))
          .orderBy(memberships.createdAt);
      },
      async findByUserId(userId: string) {
        const [row] = await db
          .select()
          .from(memberships)
          .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, userId)));
        return row ?? null;
      },
    },

    invitations: {
      listPending() {
        return db
          .select({
            id: invitations.id,
            email: invitations.email,
            role: invitations.role,
            expiresAt: invitations.expiresAt,
          })
          .from(invitations)
          .where(and(eq(invitations.organizationId, orgId), eq(invitations.status, "pending")))
          .orderBy(desc(invitations.createdAt));
      },
    },

    auditLog: {
      async record(entry: AuditEntryInput) {
        await db.insert(auditLog).values({
          orgId,
          actorId: entry.actorId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          metadata: entry.metadata ?? null,
          ip: entry.ip ?? null,
        });
      },
      list(options: { limit?: number } = {}) {
        const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
        return db
          .select({
            id: auditLog.id,
            action: auditLog.action,
            targetType: auditLog.targetType,
            targetId: auditLog.targetId,
            metadata: auditLog.metadata,
            createdAt: auditLog.createdAt,
            actorName: users.name,
          })
          .from(auditLog)
          .leftJoin(users, eq(users.id, auditLog.actorId))
          .where(eq(auditLog.orgId, orgId))
          .orderBy(desc(auditLog.createdAt))
          .limit(limit);
      },
    },
  };
}

export type OrgScope = ReturnType<typeof orgScope>;

/** User-scoped (not tenant-scoped): the organisations a given user belongs to. */
export function listOrganizationsForUser(db: Database, userId: string) {
  return db
    .select({ id: organizations.id, name: organizations.name, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId))
    .orderBy(memberships.createdAt);
}
