import { z } from "zod";
import type { AuditEntryInput } from "@app/db";

/**
 * Maps successful organisation-management auth endpoints to audit-log entries (spec §16).
 * Pure: takes the endpoint path and its returned payload, gives back what to record.
 * Metadata carries roles only — never emails, tokens or other personal data.
 */

const invitation = z.object({
  id: z.string(),
  organizationId: z.string(),
  role: z.string().nullish(),
});
const member = z.object({ id: z.string(), organizationId: z.string(), role: z.string() });

type AuditEvent = { orgId: string; entry: Omit<AuditEntryInput, "actorId" | "ip"> };

const mappers: Record<string, (returned: unknown) => AuditEvent | null> = {
  "/organization/create": (returned) => {
    const org = z.object({ id: z.string() }).safeParse(returned);
    if (!org.success) return null;
    return {
      orgId: org.data.id,
      entry: { action: "organization.created", targetType: "organization", targetId: org.data.id },
    };
  },
  "/organization/invite-member": (returned) => invitationEvent("invitation.created", returned),
  "/organization/cancel-invitation": (returned) =>
    invitationEvent("invitation.cancelled", returned),
  "/organization/accept-invitation": (returned) =>
    invitationEvent(
      "invitation.accepted",
      z.object({ invitation }).safeParse(returned).data?.invitation,
    ),
  "/organization/reject-invitation": (returned) =>
    invitationEvent(
      "invitation.rejected",
      z.object({ invitation }).safeParse(returned).data?.invitation,
    ),
  "/organization/update-member-role": (returned) => memberEvent("member.role_updated", returned),
  "/organization/remove-member": (returned) =>
    memberEvent("member.removed", z.object({ member }).safeParse(returned).data?.member),
};

function invitationEvent(action: string, value: unknown): AuditEvent | null {
  const parsed = invitation.safeParse(value);
  if (!parsed.success) return null;
  return {
    orgId: parsed.data.organizationId,
    entry: {
      action,
      targetType: "invitation",
      targetId: parsed.data.id,
      metadata: { role: parsed.data.role ?? null },
    },
  };
}

function memberEvent(action: string, value: unknown): AuditEvent | null {
  const parsed = member.safeParse(value);
  if (!parsed.success) return null;
  return {
    orgId: parsed.data.organizationId,
    entry: {
      action,
      targetType: "member",
      targetId: parsed.data.id,
      metadata: { role: parsed.data.role },
    },
  };
}

export const AUDITED_PATHS: readonly string[] = Object.keys(mappers);

export function auditEventFor(path: string, returned: unknown): AuditEvent | null {
  if (returned instanceof Error) return null;
  return mappers[path]?.(returned) ?? null;
}

/** First hop of X-Forwarded-For, if it looks like an IP address. */
export function clientIp(headers: Headers | undefined): string | null {
  const first = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!first || first.length > 45 || !/^[0-9a-fA-F.:]+$/.test(first)) return null;
  return first;
}
