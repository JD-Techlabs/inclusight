import {
  AUTOMATED_STATUS_LABELS,
  CONFORMANCE_LABELS,
  criteriaForStandard,
  getStandard,
  MANUAL_RESULT_LABELS,
  NOT_A_CERTIFICATION_NOTE,
  PENDING_REVIEW_LABEL,
} from "@app/compliance-data";
import { loadConformance } from "@app/reports/snapshot";
import ExcelJS from "exceljs";
import { z } from "zod";
import { getApiContext } from "@/lib/api-context";
import { standardFromQuery } from "@/lib/compliance-input";
import { neutraliseFormula, toCsv, type ExportRow } from "@/lib/export";
import { AUTOMATED_TESTING_DISCLAIMER } from "@/lib/labels";

const COLUMNS = [
  "Criterion",
  "Level",
  "Property",
  "Automated checks",
  "Manual test",
  "Result",
  "Unresolved issues",
];

/** Conformance matrix export (spec §8 "Exportable"): one row per criterion and property. */
export async function GET(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const format = z.enum(["csv", "xlsx"]).catch("csv").parse(url.searchParams.get("format"));
  const standardId = standardFromQuery(url.searchParams.get("standard"));
  const standard = getStandard(standardId)!;

  const properties = await ctx.scope.properties.list();
  const { conformance } = await loadConformance(
    ctx.scope,
    properties.map((p) => p.id),
    standardId,
  );
  const rows: ExportRow[] = [];
  for (const criterion of criteriaForStandard(standardId)) {
    for (const property of properties) {
      const row = conformance[property.id]?.find((r) => r.criterionId === criterion.id);
      rows.push({
        Criterion: criterion.label,
        Level: criterion.level ?? PENDING_REVIEW_LABEL,
        Property: property.name,
        "Automated checks": row ? AUTOMATED_STATUS_LABELS[row.automated] : "",
        "Manual test": row ? MANUAL_RESULT_LABELS[row.manual] : "",
        Result: row ? CONFORMANCE_LABELS[row.status] : "",
        "Unresolved issues": row?.violations ?? 0,
      });
    }
  }

  const filename = `conformance-${standardId}-${new Date().toISOString().slice(0, 10)}.${format}`;
  const headers = {
    "cache-control": "no-store",
    "content-disposition": `attachment; filename="${filename}"`,
  };
  if (format === "csv") {
    return new Response(toCsv(COLUMNS, rows), {
      headers: { ...headers, "content-type": "text/csv; charset=utf-8" },
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Inclusight";
  const sheet = workbook.addWorksheet("Conformance");
  sheet.columns = COLUMNS.map((c) => ({ header: c, key: c, width: c === "Criterion" ? 50 : 22 }));
  for (const row of rows) {
    sheet.addRow(
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, typeof v === "string" ? neutraliseFormula(v) : v]),
      ),
    );
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  workbook
    .addWorksheet("About")
    .addRows([
      [
        "Standard",
        standard.pendingReview ? `${standard.name} (${PENDING_REVIEW_LABEL})` : standard.name,
      ],
      ...(standard.reviewNote ? [["Review", standard.reviewNote]] : []),
      ["Exported", new Date().toISOString()],
      ["Note", AUTOMATED_TESTING_DISCLAIMER],
      ["Note", NOT_A_CERTIFICATION_NOTE],
    ]);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      ...headers,
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
