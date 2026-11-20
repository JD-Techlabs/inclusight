import type { AuditEntryInput, OrgScope } from "@app/db";
import { headers } from "next/headers";
import { clientIp } from "./audit-events";

/** Records a sensitive action from a server action or route handler (spec §16). */
export async function recordAudit(
  scope: OrgScope,
  actorId: string,
  entry: Omit<AuditEntryInput, "actorId" | "ip">,
): Promise<void> {
  await scope.auditLog.record({ ...entry, actorId, ip: clientIp(await headers()) });
}
