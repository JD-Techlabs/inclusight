import { getReportType, UNRESOLVED_ISSUE_STATUSES } from "@app/compliance-data";
import type { OrgScope } from "@app/db";
import { ISSUE_STATUSES } from "@app/db/domain";
import { buildAnnualReport } from "./builders/annual";
import { buildAuditSummary } from "./builders/audit-summary";
import { buildPlatformInventory } from "./builders/inventory";
import { buildRemediationTracker } from "./builders/remediation";
import { buildAccessibilityStatement } from "./builders/statement";
import type { AuditRecordInput, PropertyInput, ReportContext } from "./inputs";
import { REPORT_PARAMS_SCHEMAS } from "./params";
import type { ReportData } from "./schemas";
import { loadAuditSnapshot, loadConformance, type AuditSnapshot } from "./snapshot";

export const TRACKER_LIMIT = 5000;

/** A problem with what was asked for; its message is safe to show to the customer. */
export class ReportInputError extends Error {
  override name = "ReportInputError";
}

async function loadProperties(scope: OrgScope): Promise<PropertyInput[]> {
  const rows = await scope.complianceInputs.propertiesWithOwners();
  const latest = await scope.complianceInputs.latestCompletedScans(rows.map((r) => r.property.id));
  return rows.map(({ property: p, ownerName }) => {
    const scan = latest.get(p.id);
    return {
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      isInvestorFacing: p.isInvestorFacing,
      verified: p.verified,
      ownerName,
      latestScan: scan
        ? { id: scan.id, finishedAt: scan.finishedAt, score: scan.summary?.score ?? null }
        : null,
    };
  });
}

const toAuditInput = (a: AuditRecordInput): AuditRecordInput => ({ ...a });

/** Reads what a report needs from the organisation's data and builds its template data. */
export async function loadReportData(
  scope: OrgScope,
  report: { type: string; params: unknown },
  generated: { by: string; at: Date },
): Promise<ReportData> {
  const org = await scope.organization.get();
  if (!org) throw new ReportInputError("The organisation no longer exists.");
  const ctx: ReportContext = { org, generatedAt: generated.at, generatedBy: generated.by };
  const properties = await loadProperties(scope);
  const ids = properties.map((p) => p.id);

  switch (report.type) {
    case "platform_inventory": {
      const rows = await scope.complianceInputs.findingRows(ids, UNRESOLVED_ISSUE_STATUSES);
      return { type: report.type, data: buildPlatformInventory(ctx, properties, rows) };
    }
    case "audit_summary": {
      const params = REPORT_PARAMS_SCHEMAS.audit_summary.parse(report.params);
      const row = await scope.audits.get(params.auditId);
      if (!row) throw new ReportInputError("The audit no longer exists.");
      const snapshot =
        (row.audit.snapshot as AuditSnapshot | null) ??
        (await loadAuditSnapshot(scope, row.audit, generated.at));
      return { type: report.type, data: buildAuditSummary(ctx, toAuditInput(row.audit), snapshot) };
    }
    case "remediation_tracker": {
      const params = REPORT_PARAMS_SCHEMAS.remediation_tracker.parse(report.params);
      const selected = properties.filter((p) => params.propertyIds.includes(p.id));
      if (selected.length === 0)
        throw new ReportInputError("The selected properties no longer exist.");
      const issues = await scope.complianceInputs.issuesForReport(
        selected.map((p) => p.id),
        TRACKER_LIMIT + 1,
      );
      const truncated = issues.length > TRACKER_LIMIT;
      return {
        type: report.type,
        data: buildRemediationTracker(ctx, selected, issues.slice(0, TRACKER_LIMIT), truncated),
      };
    }
    case "sebi_annual": {
      const params = REPORT_PARAMS_SCHEMAS.sebi_annual.parse(report.params);
      const [rows, audits, nodalOfficers] = await Promise.all([
        scope.complianceInputs.findingRows(ids, ISSUE_STATUSES),
        scope.audits.list(),
        scope.complianceInputs.membersWithRole("nodal_officer"),
      ]);
      const formatNote = getReportType("sebi_annual")?.formatNote ?? null;
      return {
        type: report.type,
        data: buildAnnualReport(
          ctx,
          params,
          properties,
          rows,
          audits.map(toAuditInput),
          nodalOfficers,
          formatNote,
        ),
      };
    }
    case "accessibility_statement": {
      const params = REPORT_PARAMS_SCHEMAS.accessibility_statement.parse(report.params);
      const property = properties.find((p) => p.id === params.propertyId);
      if (!property) throw new ReportInputError("The property no longer exists.");
      const [{ conformance }, issues, audits] = await Promise.all([
        loadConformance(scope, [property.id], params.standardId),
        scope.complianceInputs.issuesForReport([property.id], 500),
        scope.audits.list(),
      ]);
      const audit =
        audits.find((a) => a.status === "closed" && a.propertyIds.includes(property.id)) ?? null;
      return {
        type: report.type,
        data: buildAccessibilityStatement(
          ctx,
          params,
          property,
          conformance[property.id] ?? [],
          issues,
          audit ? toAuditInput(audit) : null,
        ),
      };
    }
    default:
      throw new ReportInputError("Unknown report type.");
  }
}
