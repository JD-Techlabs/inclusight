import { getReportType } from "@app/compliance-data";
import type { ReportFormat } from "@app/db/domain";
import type { Browser } from "playwright";
import { renderPdf } from "./pdf";
import { renderReportHtml, renderStatementMarkdown } from "./render";
import type { ReportData } from "./schemas";
import { buildReportXlsx } from "./xlsx";

export const FORMAT_CONTENT_TYPES: Record<ReportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  html: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

export type RenderedFile = { format: ReportFormat; body: Buffer; contentType: string };

/** Renders every format the report type declares (report-templates/reports.yaml). */
export async function renderReportFiles(
  report: ReportData,
  browser: Browser,
): Promise<RenderedFile[]> {
  const info = getReportType(report.type);
  if (!info) throw new Error(`Unknown report type ${report.type}`);
  const html = await renderReportHtml(report);
  const files: RenderedFile[] = [];

  for (const format of info.formats) {
    let body: Buffer;
    if (format === "pdf") {
      body = await renderPdf(browser, html, {
        title: report.data.meta.title,
        lang: report.data.meta.lang,
      });
    } else if (format === "html") {
      body = Buffer.from(html, "utf8");
    } else if (format === "md") {
      if (report.type !== "accessibility_statement")
        throw new Error("Markdown is only for statements");
      body = Buffer.from(await renderStatementMarkdown(report.data), "utf8");
    } else {
      body = await buildReportXlsx(report);
    }
    files.push({ format, body, contentType: FORMAT_CONTENT_TYPES[format] });
  }
  return files;
}
