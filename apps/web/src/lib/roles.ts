import { ROLES, type Role } from "@app/db/domain";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, ownerAc } from "better-auth/plugins/organization/access";

/**
 * Organisation roles (spec §6). Only owner and admin can manage the organisation, its
 * members and invitations; the other roles get product permissions as later phases add them.
 * Shared by the server auth config and the browser auth client.
 */
export const ac = createAccessControl(defaultStatements);

const noOrgManagement = () => ac.newRole({ organization: [], member: [], invitation: [] });

export const orgRoles = {
  owner: ownerAc,
  admin: adminAc,
  nodal_officer: noOrgManagement(),
  developer: noOrgManagement(),
  auditor: noOrgManagement(),
  grievance_agent: noOrgManagement(),
  viewer: noOrgManagement(),
} satisfies Record<Role, unknown>;

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  nodal_officer: "Nodal officer",
  developer: "Developer",
  auditor: "Auditor",
  grievance_agent: "Grievance agent",
  viewer: "Viewer",
};

/** Roles that can be granted by invitation or role change. Ownership is never handed out this way. */
export const ASSIGNABLE_ROLES: readonly Role[] = ROLES.filter((role) => role !== "owner");

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Unknown or malformed stored roles fall back to the least-privileged role. */
export function parseRole(value: unknown): Role {
  return isRole(value) ? value : "viewer";
}

/** Spec §16: two-factor authentication is mandatory for owner and admin. */
export function requiresTwoFactor(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function canManageMembers(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function canViewAuditLog(role: Role): boolean {
  return role === "owner" || role === "admin" || role === "nodal_officer" || role === "auditor";
}

/** Add, verify, configure and delete properties. */
export function canManageProperties(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function canStartScans(role: Role): boolean {
  return ["owner", "admin", "nodal_officer", "developer"].includes(role);
}

/** Change issue status (incl. false positive / accepted risk) and assignees. */
export function canTriageIssues(role: Role): boolean {
  return ["owner", "admin", "nodal_officer", "developer", "auditor"].includes(role);
}

/** Record manual test results and attach or remove evidence (spec §8). */
export function canRecordManualTests(role: Role): boolean {
  return ["owner", "admin", "nodal_officer", "auditor"].includes(role);
}

/** Create, edit and close audits. */
export function canManageAudits(role: Role): boolean {
  return ["owner", "admin", "nodal_officer", "auditor"].includes(role);
}

export function canGenerateReports(role: Role): boolean {
  return ["owner", "admin", "nodal_officer", "auditor"].includes(role);
}

/** Record approval of a report (spec §9). Viewers include the CEO and CTO as signatories. */
export function canSignOffReports(role: Role): boolean {
  return ["owner", "admin", "nodal_officer", "viewer"].includes(role);
}
