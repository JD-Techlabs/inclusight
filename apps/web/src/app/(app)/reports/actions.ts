"use server";

import { getReportType, REPORT_TYPE_IDS, type ReportTypeId } from "@app/compliance-data";
import { enqueueGenerateReport } from "@app/queue";
import { auditDates, REPORT_PARAMS_SCHEMAS } from "@app/reports/params";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { signOffSchema } from "@/lib/compliance-input";
import { formatDate } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import { canGenerateReports, canSignOffReports } from "@/lib/roles";
import { getQueues } from "@/lib/services";
import { requireAppContext } from "@/lib/session";

type Ctx = Awaited<ReturnType<typeof requireAppContext>>;
const text = (form: FormData, name: string) => String(form.get(name) ?? "");

/** Reads and checks the parameters for one report type; titles name what the report covers. */
async function readRequest(ctx: Ctx, type: ReportTypeId, form: FormData) {
  const properties = await ctx.scope.properties.list();
  const today = formatDate(new Date());
  switch (type) {
    case "platform_inventory":
      return { params: {}, title: "Platform inventory", period: `As on ${today}` };
    case "audit_summary": {
      const params = REPORT_PARAMS_SCHEMAS.audit_summary.safeParse({
        auditId: text(form, "auditId"),
      });
      const row = params.success ? await ctx.scope.audits.get(params.data.auditId) : null;
      if (!params.success || !row) return { error: { auditId: "Choose an audit." } };
      return {
        params: params.data,
        title: `Audit summary: ${row.audit.title}`,
        period: auditDates(row.audit),
      };
    }
    case "remediation_tracker": {
      const ids = form
        .getAll("propertyIds")
        .map(String)
        .filter((id) => properties.some((p) => p.id === id));
      const params = REPORT_PARAMS_SCHEMAS.remediation_tracker.safeParse({ propertyIds: ids });
      if (!params.success) return { error: { propertyIds: "Choose at least one property." } };
      return { params: params.data, title: "Remediation tracker", period: `As on ${today}` };
    }
    case "sebi_annual": {
      const params = REPORT_PARAMS_SCHEMAS.sebi_annual.safeParse({
        financialYear: text(form, "financialYear").trim(),
        ceoName: text(form, "ceoName"),
        ctoName: text(form, "ctoName"),
      });
      if (!params.success) return { error: fieldErrors(params.error) };
      return {
        params: params.data,
        title: `Annual accessibility compliance report (draft), FY ${params.data.financialYear}`,
        period: `FY ${params.data.financialYear}`,
      };
    }
    case "accessibility_statement": {
      const params = REPORT_PARAMS_SCHEMAS.accessibility_statement.safeParse({
        propertyId: text(form, "propertyId"),
        standardId: text(form, "standardId"),
        contactEmail: text(form, "contactEmail").trim(),
        contactPhone: text(form, "contactPhone"),
        responseDays: text(form, "responseDays") || undefined,
        limitationsNote: text(form, "limitationsNote"),
      });
      if (!params.success) return { error: fieldErrors(params.error) };
      const property = properties.find((p) => p.id === params.data.propertyId);
      if (!property) return { error: { propertyId: "Choose a property." } };
      if (!["wcag21aa", "wcag22aa"].includes(params.data.standardId)) {
        return { error: { standardId: "Choose a WCAG standard." } };
      }
      return {
        params: params.data,
        title: `Accessibility statement: ${property.name}`,
        period: today,
      };
    }
  }
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}

/** Queues a report for generation in the worker (spec §9) and opens its page. */
export async function requestReportAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canGenerateReports(ctx.role))
    return { error: "Your role does not allow generating reports." };
  const type = z.enum(REPORT_TYPE_IDS).safeParse(form.get("type"));
  if (!type.success || !getReportType(type.data))
    return { fieldErrors: { type: "Choose a report." } };
  const request = await readRequest(ctx, type.data, form);
  if ("error" in request) return { fieldErrors: request.error };

  const report = await ctx.scope.reports.create({
    type: type.data,
    title: request.title,
    period: request.period,
    params: request.params,
    generatedBy: ctx.user.id,
  });
  await enqueueGenerateReport(getQueues(), { orgId: ctx.scope.orgId, reportId: report.id });
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "report.requested",
    targetType: "report",
    targetId: report.id,
    metadata: { type: type.data },
  });
  revalidatePath("/reports");
  redirect(`/reports/${report.id}`);
}

/** Records who approved a report and when (spec §9). Real signatures happen outside. */
export async function signOffReportAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAppContext();
  if (!canSignOffReports(ctx.role)) return { error: "Your role does not allow approving reports." };
  const id = z.string().min(1).max(100).safeParse(form.get("reportId"));
  if (!id.success) return { error: "This report was not found." };
  const parsed = signOffSchema.safeParse({
    designation: form.get("designation"),
    confirm: form.get("confirm") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const added = await ctx.scope.reports.addSignOff(id.data, {
    userId: ctx.user.id,
    name: ctx.user.name,
    designation: parsed.data.designation,
    signedAt: new Date().toISOString(),
  });
  if (!added) {
    return { error: "You have already recorded this approval, or the report is not ready yet." };
  }
  await recordAudit(ctx.scope, ctx.user.id, {
    action: "report.signed_off",
    targetType: "report",
    targetId: id.data,
    metadata: { designation: parsed.data.designation },
  });
  revalidatePath(`/reports/${id.data}`);
  return { success: "Your approval was recorded." };
}
