"use server";

import { getCriterion } from "@app/compliance-data";
import { evidenceKey } from "@app/storage";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { checkEvidenceFile, cleanFileName, manualTestSchema } from "@/lib/compliance-input";
import type { FormState } from "@/lib/form-state";
import { canRecordManualTests } from "@/lib/roles";
import { getStorage } from "@/lib/services";
import { requireAppContext } from "@/lib/session";

const idSchema = z.string().min(1).max(100);
const NOT_ALLOWED = "Your role does not allow recording manual tests or evidence.";

/** Property and catalogue criterion from the form, or null when either is invalid. */
function target(form: FormData) {
  const propertyId = idSchema.safeParse(form.get("propertyId"));
  const criterionId = idSchema.safeParse(form.get("criterionId"));
  if (!propertyId.success || !criterionId.success || !getCriterion(criterionId.data)) return null;
  return { propertyId: propertyId.data, criterionId: criterionId.data };
}

function refresh(propertyId: string) {
  revalidatePath(`/properties/${propertyId}/manual-tests`, "layout");
  revalidatePath("/compliance");
}

/** Records a manual test result (spec §8). The history of results is in the audit log. */
export async function recordManualTestAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canRecordManualTests(ctx.role)) return { error: NOT_ALLOWED };
  const where = target(form);
  if (!where) return { error: "This criterion was not found." };
  const parsed = manualTestSchema.safeParse({
    result: form.get("result"),
    notes: String(form.get("notes") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const row = await ctx.scope.manualTests.record({
    ...where,
    ...parsed.data,
    testerId: ctx.user.id,
  });
  if (!row) return { error: "This property was not found." };
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "manual_test.recorded",
    targetType: "property",
    targetId: where.propertyId,
    metadata: { criterionId: where.criterionId, result: parsed.data.result },
  });
  refresh(where.propertyId);
  return { success: "Result saved." };
}

/** Uploads an evidence file for a criterion. Files are checked by content and stored in S3. */
export async function uploadEvidenceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canRecordManualTests(ctx.role)) return { error: NOT_ALLOWED };
  const where = target(form);
  if (!where) return { error: "This criterion was not found." };
  const file = form.get("file");
  const description = String(form.get("description") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose a file to upload." } };
  }
  if (description.length > 500) {
    return { fieldErrors: { description: "Use 500 characters or fewer." } };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkEvidenceFile(file.name, bytes);
  if (!check.ok) return { fieldErrors: { file: check.error } };

  const test = await ctx.scope.manualTests.ensure(where.propertyId, where.criterionId);
  if (!test) return { error: "This property was not found." };
  const key = evidenceKey({
    orgId: ctx.scope.orgId,
    fileId: crypto.randomUUID(),
    extension: check.extension,
  });
  await getStorage().put(key, bytes, check.contentType);
  const row = await ctx.scope.evidence.create({
    linkedType: "manual_test",
    linkedId: test.id,
    fileKey: key,
    fileName: cleanFileName(file.name),
    contentType: check.contentType,
    sizeBytes: bytes.length,
    description,
    uploadedBy: ctx.user.id,
  });
  if (!row) {
    await getStorage()
      .delete(key)
      .catch(() => undefined);
    return { error: "The evidence could not be saved." };
  }
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "evidence.uploaded",
    targetType: "evidence",
    targetId: row.id,
    metadata: {
      criterionId: where.criterionId,
      contentType: check.contentType,
      sizeBytes: bytes.length,
    },
  });
  refresh(where.propertyId);
  return { success: "Evidence uploaded." };
}

export async function deleteEvidenceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canRecordManualTests(ctx.role)) return { error: NOT_ALLOWED };
  const id = idSchema.safeParse(form.get("evidenceId"));
  const row = id.success ? await ctx.scope.evidence.delete(id.data) : null;
  if (!row) return { error: "This evidence was not found." };
  await getStorage()
    .delete(row.fileKey)
    .catch(() => undefined);
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "evidence.deleted",
    targetType: "evidence",
    targetId: row.id,
  });
  if (row.propertyId) refresh(row.propertyId);
  return { success: "Evidence deleted." };
}
