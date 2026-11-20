import ExcelJS from "exceljs";
import { z } from "zod";
import { getApiContext, notFound } from "@/lib/api-context";
import { exportFilename, neutraliseFormula, toCsv, type ExportRow } from "@/lib/export";
import { parseIssueQuery, toIssueFilters } from "@/lib/issue-filters";
import {
  AUTOMATED_TESTING_DISCLAIMER,
  IMPACT_LABELS,
  ISSUE_STATUS_LABELS,
  label,
} from "@/lib/labels";

const EXPORT_LIMIT = 10_000;
const COLUMNS = [
  "Issue ID",
  "Rule",
  "Summary",
  "Impact",
  "WCAG criteria",
  "Best practice",
  "Status",
  "Status reason",
  "Occurrences",
  "Pages",
  "Assignee",
  "How to fix",
];

/** Issue list export (CSV or XLSX) with the same filters as the issues page. */
export async function GET(request: Request, props: { params: Promise<{ propertyId: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const id = z
    .string()
    .min(1)
    .max(100)
    .safeParse((await props.params).propertyId);
  const property = id.success ? await ctx.scope.properties.get(id.data) : null;
  if (!property) return notFound();

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const query = parseIssueQuery(Object.fromEntries(url.searchParams));
  const issues = await ctx.scope.issues.forExport(property.id, toIssueFilters(query), EXPORT_LIMIT);

  const rows: ExportRow[] = issues.map(({ issue, assigneeName }) => ({
    "Issue ID": issue.id,
    Rule: issue.ruleId,
    Summary: issue.helpText,
    Impact: label(IMPACT_LABELS, issue.impact),
    "WCAG criteria": issue.criteria.join(", "),
    "Best practice": issue.isBestPractice ? "Yes" : "No",
    Status: label(ISSUE_STATUS_LABELS, issue.status),
    "Status reason": issue.statusReason,
    Occurrences: issue.occurrenceCount,
    Pages: issue.pageCount,
    Assignee: assigneeName,
    "How to fix": issue.helpUrl,
  }));

  const headers = {
    "cache-control": "no-store",
    "content-disposition": `attachment; filename="${exportFilename(property.name, format)}"`,
  };

  if (format === "csv") {
    return new Response(toCsv(COLUMNS, rows), {
      headers: { ...headers, "content-type": "text/csv; charset=utf-8" },
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Inclusight";
  const sheet = workbook.addWorksheet("Issues");
  sheet.columns = COLUMNS.map((column) => ({
    header: column,
    key: column,
    width: column === "Summary" ? 60 : 18,
  }));
  for (const row of rows) {
    sheet.addRow(
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, typeof v === "string" ? neutraliseFormula(v) : v]),
      ),
    );
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const about = workbook.addWorksheet("About");
  about.addRows([
    ["Property", property.name],
    ["Website", property.baseUrl],
    ["Exported", new Date().toISOString()],
    ["Note", AUTOMATED_TESTING_DISCLAIMER],
    [
      "Note",
      "Inclusight assists accessibility audits and compliance. It does not certify compliance.",
    ],
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      ...headers,
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
