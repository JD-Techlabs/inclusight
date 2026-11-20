import {
  criterionLabel,
  getReportType,
  getStandard,
  MANUAL_RESULT_LABELS,
  MANUAL_RESULTS,
  type ManualResult,
} from "@app/compliance-data";
import { isRole, ROLE_LABELS } from "./roles";

const isManualResult = (value: unknown): value is ManualResult =>
  (MANUAL_RESULTS as readonly unknown[]).includes(value);
import { ISSUE_STATUS_LABELS, label, SCAN_MODE_LABELS, VERIFICATION_METHOD_LABELS } from "./labels";

const ACTION_LABELS: Record<string, string> = {
  "organization.created": "Organisation created",
  "invitation.created": "Member invited",
  "invitation.cancelled": "Invitation cancelled",
  "invitation.accepted": "Invitation accepted",
  "invitation.rejected": "Invitation declined",
  "member.role_updated": "Member role changed",
  "member.removed": "Member removed",
  "property.created": "Property added",
  "property.verified": "Domain verified",
  "property.settings_updated": "Property settings changed",
  "property.deleted": "Property deleted",
  "scan.started": "Scan started",
  "issue.status_changed": "Issue status changed",
  "issue.assigned": "Issue assigned",
  "issue.target_date_set": "Issue target date changed",
  "property.owner_changed": "Property owner changed",
  "manual_test.recorded": "Manual test recorded",
  "evidence.uploaded": "Evidence uploaded",
  "evidence.deleted": "Evidence deleted",
  "audit.created": "Audit created",
  "audit.updated": "Audit details changed",
  "audit.closed": "Audit closed (findings locked)",
  "report.requested": "Report generated",
  "report.signed_off": "Report approved",
};

/** Human-readable label for an audit action; unknown actions show their raw identifier. */
export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

type Metadata = Record<string, string | number | boolean | null> | null;

/** Short description of an entry's metadata for the audit log table. */
export function describeAuditDetails(metadata: Metadata): string {
  if (!metadata) return "—";
  const parts: string[] = [];
  if (isRole(metadata.role)) parts.push(`Role: ${ROLE_LABELS[metadata.role]}`);
  if (typeof metadata.status === "string") {
    parts.push(`Status: ${label(ISSUE_STATUS_LABELS, metadata.status)}`);
  }
  if (typeof metadata.reason === "string") parts.push(`Reason: ${metadata.reason}`);
  if (typeof metadata.method === "string") {
    parts.push(`Method: ${label(VERIFICATION_METHOD_LABELS, metadata.method)}`);
  }
  if (typeof metadata.mode === "string")
    parts.push(`Mode: ${label(SCAN_MODE_LABELS, metadata.mode)}`);
  if ("assigneeId" in metadata)
    parts.push(metadata.assigneeId ? "Assigned to a member" : "Unassigned");
  if ("targetDate" in metadata) parts.push(`Target date: ${metadata.targetDate ?? "removed"}`);
  if (typeof metadata.criterionId === "string") {
    parts.push(`Criterion: ${criterionLabel(metadata.criterionId)}`);
  }
  if (isManualResult(metadata.result))
    parts.push(`Result: ${MANUAL_RESULT_LABELS[metadata.result]}`);
  if (typeof metadata.type === "string")
    parts.push(`Report: ${getReportType(metadata.type)?.title ?? metadata.type}`);
  if (typeof metadata.designation === "string") parts.push(`As: ${metadata.designation}`);
  if (typeof metadata.standardId === "string") {
    parts.push(`Standard: ${getStandard(metadata.standardId)?.shortName ?? metadata.standardId}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}
