"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/form-state";
import { issueUpdateSchema } from "@/lib/property-input";
import { canTriageIssues } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";

/**
 * Bulk or single issue triage: status, assignment and remediation target date. Every change is audit-logged
 * per issue; false positives and accepted risks carry the mandatory reason (spec §7.5).
 */
export async function updateIssuesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canTriageIssues(ctx.role)) return { error: "Your role does not allow changing issues." };

  const parsed = issueUpdateSchema.safeParse({
    issueIds: form.getAll("issueIds").map(String),
    status: String(form.get("status") ?? ""),
    reason: String(form.get("reason") ?? ""),
    assignee: String(form.get("assignee") ?? ""),
    targetDate: String(form.get("targetDate") ?? ""),
    clearTargetDate: form.get("clearTargetDate") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const { issueIds, status, reason, assignee, targetDate, clearTargetDate } = parsed.data;
  const changedIds = new Set<string>();
  let propertyId: string | undefined;

  if (status !== "") {
    const changed = await ctx.scope.issues.setStatus(issueIds, status, reason || null);
    for (const row of changed) {
      changedIds.add(row.id);
      propertyId = row.propertyId;
      await recordAudit(ctx.scope, ctx.user.id, {
        action: "issue.status_changed",
        targetType: "issue",
        targetId: row.id,
        metadata: { status, reason: reason ? reason.slice(0, 500) : null },
      });
    }
  }

  if (assignee !== "") {
    const assigneeId = assignee === "none" ? null : assignee;
    const assigned = await ctx.scope.issues.assign(issueIds, assigneeId);
    if (assigned.length === 0)
      return { error: "That person is not a member of this organisation." };
    for (const row of assigned) {
      changedIds.add(row.id);
      await recordAudit(ctx.scope, ctx.user.id, {
        action: "issue.assigned",
        targetType: "issue",
        targetId: row.id,
        metadata: { assigneeId },
      });
    }
  }

  if (targetDate !== "" || clearTargetDate) {
    const date = clearTargetDate ? null : targetDate;
    const dated = await ctx.scope.issues.setTargetDate(issueIds, date);
    for (const row of dated) {
      changedIds.add(row.id);
      propertyId = row.propertyId;
      await recordAudit(ctx.scope, ctx.user.id, {
        action: "issue.target_date_set",
        targetType: "issue",
        targetId: row.id,
        metadata: { targetDate: date },
      });
    }
  }

  if (changedIds.size === 0) return { error: "No issues were changed." };
  revalidatePath("/properties", "layout");
  if (propertyId) revalidatePath(`/properties/${propertyId}/issues`);
  return { success: `Updated ${changedIds.size} ${changedIds.size === 1 ? "issue" : "issues"}.` };
}
