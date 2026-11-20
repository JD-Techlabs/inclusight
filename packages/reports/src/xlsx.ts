import ExcelJS from "exceljs";
import type { ReportData, ReportMeta } from "./schemas";

/** Spreadsheet apps run cells starting with = + - @ as formulas (OWASP CSV injection). */
export function safeCell(value: string | number): string | number {
  return typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

type Row = Record<string, string | number>;

function addSheet(workbook: ExcelJS.Workbook, name: string, rows: Row[], columns?: string[]) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  const headers = columns ?? Object.keys(rows[0] ?? {});
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.min(60, Math.max(12, header.length + 4)),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of rows) {
    sheet.addRow(Object.fromEntries(headers.map((h) => [h, safeCell(row[h] ?? "")])));
  }
}

function aboutSheet(workbook: ExcelJS.Workbook, meta: ReportMeta, organisation: string) {
  const rows: Row[] = [
    { Field: "Report", Value: meta.title },
    { Field: "Organisation", Value: organisation },
    { Field: "Period", Value: meta.period },
    { Field: "Generated", Value: `${meta.generatedOn} by ${meta.generatedBy}` },
    ...(meta.draftNote ? [{ Field: "Draft", Value: meta.draftNote }] : []),
    { Field: "Note", Value: meta.automatedNote },
    { Field: "Note", Value: meta.certificationNote },
    ...meta.notes.map((note) => ({ Field: "Note", Value: note })),
  ];
  addSheet(workbook, "About", rows, ["Field", "Value"]);
}

/** XLSX version of a report: one sheet per table, plus an "About" sheet with the notes. */
export async function buildReportXlsx(report: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Inclusight";

  switch (report.type) {
    case "platform_inventory": {
      const d = report.data;
      aboutSheet(workbook, d.meta, d.organisation.name);
      addSheet(
        workbook,
        "Platforms",
        d.platforms.map((p) => ({
          Platform: p.name,
          Type: p.type,
          Address: p.url,
          "Investor-facing": p.investorFacing,
          Owner: p.owner,
          Domain: p.verification,
          "Last scan": p.lastScan,
          Score: p.score,
          "Unresolved issues": p.unresolvedIssues,
          "Critical or serious": p.criticalOrSerious,
        })),
      );
      break;
    }
    case "audit_summary": {
      const d = report.data;
      aboutSheet(workbook, d.meta, d.organisation.name);
      addSheet(
        workbook,
        "Audit",
        [
          { Field: "Audit", Value: d.audit.title },
          { Field: "Auditor", Value: d.audit.auditorName },
          { Field: "IAAP certification", Value: d.audit.iaapCertId },
          { Field: "Auditor's organisation", Value: d.audit.auditorOrg },
          { Field: "Dates", Value: d.audit.dates },
          { Field: "Status", Value: d.audit.status },
          { Field: "Standard", Value: d.audit.standard },
          ...d.audit.scope.map((p) => ({ Field: "In scope", Value: `${p.name} (${p.url})` })),
        ],
        ["Field", "Value"],
      );
      addSheet(
        workbook,
        "Severity",
        d.severity.map((r) => ({
          Severity: r.severity,
          Unresolved: r.unresolved,
          Fixed: r.fixed,
          Total: r.total,
        })),
      );
      addSheet(
        workbook,
        "Criteria",
        d.criteria.map((r) => ({
          Criterion: r.criterion,
          "Confirmed issues": r.violations,
          "Need review": r.reviews,
        })),
        ["Criterion", "Confirmed issues", "Need review"],
      );
      for (const table of d.conformance) {
        addSheet(
          workbook,
          table.standard.replace(/[\\/?*[\]:]/g, " "),
          table.rows.map((r) => ({
            Criterion: r.criterion,
            Level: r.level,
            ...Object.fromEntries(table.properties.map((name, i) => [name, r.statuses[i] ?? ""])),
            Overall: r.overall,
          })),
        );
      }
      break;
    }
    case "remediation_tracker": {
      const d = report.data;
      aboutSheet(workbook, d.meta, d.organisation.name);
      addSheet(
        workbook,
        "Findings",
        d.items.map((i) => ({
          Finding: i.finding,
          Rule: i.rule,
          Platform: i.property,
          Criteria: i.criteria,
          Severity: i.severity,
          Status: i.status,
          Owner: i.owner,
          "Target date": i.targetDate,
          Fixed: i.fixedDate,
          Verification: i.verification,
        })),
        [
          "Finding",
          "Rule",
          "Platform",
          "Criteria",
          "Severity",
          "Status",
          "Owner",
          "Target date",
          "Fixed",
          "Verification",
        ],
      );
      addSheet(
        workbook,
        "Totals",
        d.totals.map((t) => ({ Status: t.status, Findings: t.count })),
      );
      break;
    }
    case "sebi_annual": {
      const d = report.data;
      aboutSheet(workbook, d.meta, d.organisation.name);
      addSheet(
        workbook,
        "Entity",
        [
          { Field: "Name of the entity", Value: d.organisation.legalName },
          { Field: "SEBI registration number", Value: d.organisation.sebiRegistrationNo },
          { Field: "Category", Value: d.organisation.entityType },
          { Field: "Report submitted to", Value: d.organisation.reportingAuthority },
          {
            Field: "Financial year",
            Value: `${d.financialYear.label} (${d.financialYear.start} to ${d.financialYear.end})`,
          },
          ...d.nodalOfficers.map((n) => ({
            Field: "Nodal officer",
            Value: `${n.name} (${n.email})`,
          })),
        ],
        ["Field", "Value"],
      );
      addSheet(
        workbook,
        "Platforms",
        d.platforms.map((p) => ({
          Platform: p.name,
          Address: p.url,
          "Investor-facing": p.investorFacing,
          Score: p.score,
          "Last scan": p.lastScan,
        })),
        ["Platform", "Address", "Investor-facing", "Score", "Last scan"],
      );
      addSheet(
        workbook,
        "Audits",
        d.audits.map((a) => ({
          Audit: a.title,
          Auditor: a.auditor,
          "IAAP certification": a.iaapCertId,
          Dates: a.dates,
          Standard: a.standard,
          Status: a.status,
        })),
        ["Audit", "Auditor", "IAAP certification", "Dates", "Standard", "Status"],
      );
      addSheet(
        workbook,
        "Findings",
        d.findings.severity.map((r) => ({
          Severity: r.severity,
          Unresolved: r.unresolved,
          Fixed: r.fixed,
          Total: r.total,
        })),
      );
      break;
    }
    case "accessibility_statement":
      throw new Error("The accessibility statement has no spreadsheet version");
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
