"use server";

import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import limits from "@app/config/scan-limits.json";
import { enqueueCrawl } from "@app/queue";
import { VERIFICATION_METHODS } from "@app/scanner-core/pure";
import { botUserAgent, checkVerification, createSafeFetchText } from "@app/scanner-core/verify";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { createPropertySchema, parseBaseUrl, parseScanSettings } from "@/lib/property-input";
import { canManageProperties, canStartScans } from "@/lib/roles";
import { getQueues } from "@/lib/services";
import { requireAppContext } from "@/lib/session";

const propertyIdSchema = z.string().min(1).max(100);
const NOT_ALLOWED: FormState = { error: "Your role does not allow this action." };

async function loadManagedProperty(
  form: FormData,
  check: (role: Parameters<typeof canManageProperties>[0]) => boolean,
) {
  const ctx = await requireAppContext();
  if (!check(ctx.role)) return { ctx, property: null, denied: true as const };
  const id = propertyIdSchema.safeParse(form.get("propertyId"));
  const property = id.success ? await ctx.scope.properties.get(id.data) : null;
  return { ctx, property, denied: false as const };
}

export async function createPropertyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canManageProperties(ctx.role)) return NOT_ALLOWED;

  const parsed = createPropertySchema.safeParse({
    name: form.get("name") ?? "",
    baseUrl: form.get("baseUrl") ?? "",
    isInvestorFacing: form.get("isInvestorFacing") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const url = parseBaseUrl(parsed.data.baseUrl, {
    allowPrivateHosts: env().SCANNER_ALLOW_PRIVATE_HOSTS === "true",
  });
  if (!url.ok) return { fieldErrors: { baseUrl: url.error } };
  if (await ctx.scope.properties.findByBaseUrl(url.url)) {
    return { fieldErrors: { baseUrl: "This website is already a property in your organisation." } };
  }

  const property = await ctx.scope.properties.create({
    name: parsed.data.name,
    baseUrl: url.url,
    isInvestorFacing: parsed.data.isInvestorFacing,
    verificationToken: `a11y-${randomBytes(18).toString("base64url")}`,
    createdBy: ctx.user.id,
  });
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "property.created",
    targetType: "property",
    targetId: property.id,
  });
  redirect(`/properties/${property.id}`);
}

export async function verifyPropertyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { ctx, property, denied } = await loadManagedProperty(form, canManageProperties);
  if (denied) return NOT_ALLOWED;
  if (!property) return { error: "Property not found." };
  if (property.verified) return { success: "This domain is already verified." };
  const method = z.enum(VERIFICATION_METHODS).safeParse(form.get("method"));
  if (!method.success) return { fieldErrors: { method: "Choose a verification method." } };

  const fetchText = createSafeFetchText({
    userAgent: botUserAgent(env().APP_URL),
    allowPrivate: env().SCANNER_ALLOW_PRIVATE_HOSTS === "true",
    timeoutMs: 10_000,
  });
  const result = await checkVerification(
    method.data,
    property.baseUrl,
    property.verificationToken,
    {
      fetchText,
      resolveTxt,
    },
  );
  if (!result.verified) return { error: result.detail };

  await ctx.scope.properties.markVerified(property.id, method.data);
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "property.verified",
    targetType: "property",
    targetId: property.id,
    metadata: { method: method.data },
  });
  // The verification panel disappears once verified, so confirm on the property page itself.
  redirect(`/properties/${property.id}?verified=1`);
}

export async function updatePropertySettingsAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { ctx, property, denied } = await loadManagedProperty(form, canManageProperties);
  if (denied) return NOT_ALLOWED;
  if (!property) return { error: "Property not found." };

  const name = createPropertySchema.shape.name.safeParse(form.get("name") ?? "");
  const settings = parseScanSettings(form, {
    verified: property.verified,
    maxPagesLimit: limits.maxPagesPerScan,
  });
  const fieldErrors = settings.ok ? {} : { ...settings.errors };
  if (!name.success) fieldErrors.name = name.error.issues[0]?.message ?? "Enter a name.";
  if (!settings.ok || !name.success) return { fieldErrors };

  await ctx.scope.properties.update(property.id, {
    name: name.data,
    isInvestorFacing: form.get("isInvestorFacing") === "on",
    scanConfig: settings.config,
  });
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "property.settings_updated",
    targetType: "property",
    targetId: property.id,
  });
  revalidatePath(`/properties/${property.id}`);
  return { success: "Settings saved. They apply to the next scan." };
}

export async function deletePropertyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { ctx, property, denied } = await loadManagedProperty(form, canManageProperties);
  if (denied) return NOT_ALLOWED;
  if (!property) return { error: "Property not found." };
  if (String(form.get("confirmName") ?? "").trim() !== property.name) {
    return { fieldErrors: { confirmName: "Type the property name exactly to confirm." } };
  }
  await ctx.scope.properties.delete(property.id);
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "property.deleted",
    targetType: "property",
    targetId: property.id,
  });
  redirect("/properties");
}

export async function startScanAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { ctx, property, denied } = await loadManagedProperty(form, canStartScans);
  if (denied) return NOT_ALLOWED;
  if (!property) return { error: "Property not found." };
  if (await ctx.scope.scans.activeForProperty(property.id)) {
    return { error: "A scan of this property is already running." };
  }

  const mode = property.verified ? "full" : "single_page";
  if (mode === "single_page") {
    const recent = await ctx.scope.scans.countSince(new Date(Date.now() - 3600_000), "single_page");
    if (recent >= limits.unverifiedScansPerHourPerOrg) {
      return {
        error: `Single-page scans of unverified domains are limited to ${limits.unverifiedScansPerHourPerOrg} an hour. Verify the domain for full scans, or try again later.`,
      };
    }
  }

  const scan = await ctx.scope.scans.create({
    propertyId: property.id,
    mode,
    trigger: "manual",
    createdBy: ctx.user.id,
  });
  if (!scan) return { error: "Property not found." };
  try {
    await enqueueCrawl(getQueues(), { orgId: ctx.scope.orgId, scanId: scan.id });
  } catch {
    await ctx.scope.scans.update(scan.id, {
      status: "failed",
      finishedAt: new Date(),
      error: "The scan could not be queued. Please try again.",
    });
    return { error: "The scan could not be queued. Please try again in a minute." };
  }
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "scan.started",
    targetType: "scan",
    targetId: scan.id,
    metadata: { mode },
  });
  redirect(`/scans/${scan.id}`);
}

/** Sets the member responsible for a property (shown in the platform inventory report). */
export async function setPropertyOwnerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { ctx, property, denied } = await loadManagedProperty(form, canManageProperties);
  if (denied) return NOT_ALLOWED;
  if (!property) return { error: "This property was not found." };
  const owner = String(form.get("ownerId") ?? "");
  const ownerId = owner === "" ? null : owner;
  if (!(await ctx.scope.properties.setOwner(property.id, ownerId))) {
    return { fieldErrors: { ownerId: "Choose a member of this organisation." } };
  }
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "property.owner_changed",
    targetType: "property",
    targetId: property.id,
    metadata: { assigneeId: ownerId },
  });
  revalidatePath(`/properties/${property.id}`, "layout");
  return { success: "Owner saved." };
}
