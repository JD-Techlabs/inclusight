import { ROLES } from "@app/db";
import { describe, expect, it } from "vitest";
import {
  ASSIGNABLE_ROLES,
  canManageMembers,
  canManageProperties,
  canStartScans,
  canTriageIssues,
  canViewAuditLog,
  orgRoles,
  parseRole,
  requiresTwoFactor,
  ROLE_LABELS,
} from "./roles";

describe("roles", () => {
  it("defines an access-control role and label for every domain role", () => {
    expect(Object.keys(orgRoles).sort()).toEqual([...ROLES].sort());
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...ROLES].sort());
  });

  it("never offers owner as an assignable role", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("owner");
    expect(ASSIGNABLE_ROLES).toHaveLength(ROLES.length - 1);
  });

  it("falls back to viewer for unknown stored roles", () => {
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("superuser")).toBe("viewer");
    expect(parseRole("owner,admin")).toBe("viewer");
    expect(parseRole(null)).toBe("viewer");
  });

  it("requires two-factor for owner and admin only", () => {
    expect(ROLES.filter(requiresTwoFactor)).toEqual(["owner", "admin"]);
  });

  it("lets only owner and admin manage members", () => {
    expect(ROLES.filter(canManageMembers)).toEqual(["owner", "admin"]);
  });

  it("limits the audit log to oversight roles", () => {
    expect(ROLES.filter(canViewAuditLog)).toEqual(["owner", "admin", "nodal_officer", "auditor"]);
  });

  it("gives non-admin roles no organisation-management permissions", () => {
    for (const role of [
      "nodal_officer",
      "developer",
      "auditor",
      "grievance_agent",
      "viewer",
    ] as const) {
      expect(orgRoles[role].authorize({ invitation: ["create"] }).success).toBe(false);
      expect(orgRoles[role].authorize({ member: ["update"] }).success).toBe(false);
    }
    expect(orgRoles.admin.authorize({ invitation: ["create"] }).success).toBe(true);
  });

  it("limits property management, scanning and triage by role", () => {
    expect(ROLES.filter(canManageProperties)).toEqual(["owner", "admin"]);
    expect(ROLES.filter(canStartScans)).toEqual(["owner", "admin", "nodal_officer", "developer"]);
    expect(ROLES.filter(canTriageIssues)).toEqual([
      "owner",
      "admin",
      "nodal_officer",
      "developer",
      "auditor",
    ]);
  });
});
