import { describe, expect, it } from "vitest";
import { auditEventFor, clientIp } from "./audit-events";

describe("auditEventFor", () => {
  it("maps organisation creation", () => {
    expect(auditEventFor("/organization/create", { id: "org1", name: "X" })).toEqual({
      orgId: "org1",
      entry: { action: "organization.created", targetType: "organization", targetId: "org1" },
    });
  });

  it("maps invitation events without leaking the invitee email", () => {
    const event = auditEventFor("/organization/invite-member", {
      id: "inv1",
      organizationId: "org1",
      role: "developer",
      email: "person@example.test",
    });
    expect(event?.orgId).toBe("org1");
    expect(event?.entry).toEqual({
      action: "invitation.created",
      targetType: "invitation",
      targetId: "inv1",
      metadata: { role: "developer" },
    });
    expect(JSON.stringify(event)).not.toContain("person@example.test");
  });

  it("unwraps nested invitation and member payloads", () => {
    const accepted = auditEventFor("/organization/accept-invitation", {
      invitation: { id: "inv1", organizationId: "org1", role: "viewer" },
      member: { id: "m1", organizationId: "org1", role: "viewer" },
    });
    expect(accepted?.entry.action).toBe("invitation.accepted");
    const removed = auditEventFor("/organization/remove-member", {
      member: { id: "m1", organizationId: "org1", role: "viewer" },
    });
    expect(removed?.entry).toMatchObject({ action: "member.removed", targetId: "m1" });
  });

  it("ignores failures, unknown paths and unexpected payloads", () => {
    expect(auditEventFor("/organization/create", new Error("nope"))).toBeNull();
    expect(auditEventFor("/sign-in/email", { id: "x" })).toBeNull();
    expect(auditEventFor("/organization/invite-member", { nope: true })).toBeNull();
    expect(auditEventFor("/organization/update-member-role", null)).toBeNull();
  });
});

describe("clientIp", () => {
  it("takes the first forwarded hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(clientIp(new Headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("returns null when absent or malformed", () => {
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(undefined)).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": "<script>" }))).toBeNull();
  });
});
