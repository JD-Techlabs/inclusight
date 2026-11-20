"use server";

import type { AuditInput } from "@app/db";
import { loadAuditSnapshot } from "@app/reports/snapshot";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { auditSchema } from "@/lib/compliance-input";
import type { FormState } from "@/lib/form-state";
import { canManageAudits } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";

const idSchema = z.string().min(1).max(100);
const NOT_ALLOWED = "Your role does not allow managing audits.";

function parseAudit(
  form: FormData,
): { ok: true; input: AuditInput } | { ok: false; state: FormState } {
  const parsed = auditSchema.safeParse({
    title: String(form.get("title") ?? ""),
    auditorName: String(form.get("auditorName") ?? ""),
    iaapCertId: String(form.get("iaapCertId") ?? ""),
    auditorOrg: String(form.get("auditorOrg") ?? ""),
    startDate: String(form.get("startDate") ?? ""),
    endDate: String(form.get("endDate") ?? ""),
    standardId: String(form.get("standardId") ?? ""),
    propertyIds: form.getAll("propertyIds").map(String),
    methodology: String(form.get("methodology") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, state: { fieldErrors } };
  }
  return { ok: true, input: { ...parsed.data, endDate: parsed.data.endDate || null } };
}

/** Creates an audit (spec §8) and opens it. */
export async function createAuditAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canManageAudits(ctx.role)) return { error: NOT_ALLOWED };
  const parsed = parseAudit(form);
  if (!parsed.ok) return parsed.state;
  const audit = await ctx.scope.audits.create({ ...parsed.input, createdBy: ctx.user.id });
  if (!audit) return { fieldErrors: { propertyIds: "Choose properties of this organisation." } };
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "audit.created",
    targetType: "audit",
    targetId: audit.id,
    metadata: { standardId: audit.standardId, properties: audit.propertyIds.length },
  });
  revalidatePath("/audits");
  redirect(`/audits/${audit.id}`);
}

/** Edits an audit that is still in progress. */
export async function updateAuditAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canManageAudits(ctx.role)) return { error: NOT_ALLOWED };
  const id = idSchema.safeParse(form.get("auditId"));
  if (!id.success) return { error: "This audit was not found." };
  const parsed = parseAudit(form);
  if (!parsed.ok) return parsed.state;
  const audit = await ctx.scope.audits.update(id.data, parsed.input);
  if (!audit) return { error: "This audit is closed or was not found, so it cannot be changed." };
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "audit.updated",
    targetType: "audit",
    targetId: audit.id,
    metadata: { standardId: audit.standardId, properties: audit.propertyIds.length },
  });
  revalidatePath("/audits", "layout");
  return { success: "Audit details saved." };
}

/**
 * Closes an audit: findings, conformance and manual results are locked into a snapshot that
 * reports use from then on (spec §8). Cannot be undone.
 */
export async function closeAuditAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canManageAudits(ctx.role)) return { error: NOT_ALLOWED };
  const id = idSchema.safeParse(form.get("auditId"));
  const row = id.success ? await ctx.scope.audits.get(id.data) : null;
  if (!row) return { error: "This audit was not found." };
  if (form.get("confirm") !== "on") {
    return { fieldErrors: { confirm: "Confirm that the findings should be locked." } };
  }
  if (row.audit.status !== "in_progress") return { error: "This audit is already closed." };
  const snapshot = await loadAuditSnapshot(ctx.scope, row.audit);
  const closed = await ctx.scope.audits.close(row.audit.id, snapshot, ctx.user.id);
  if (!closed) return { error: "This audit is already closed." };
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "audit.closed",
    targetType: "audit",
    targetId: closed.id,
    metadata: { standardId: closed.standardId, properties: closed.propertyIds.length },
  });
  revalidatePath("/audits", "layout");
  return { success: "Audit closed. Its findings are now locked." };
}
