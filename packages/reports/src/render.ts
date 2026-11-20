import { getReportType } from "@app/compliance-data";
import { REPORT_TEMPLATES_DIR } from "@app/compliance-data/templates";
import { Liquid } from "liquidjs";
import { REPORT_DATA_SCHEMAS, type AccessibilityStatementData, type ReportData } from "./schemas";

/**
 * Renders report templates (compliance-data/report-templates). HTML output escapes every value
 * by default; templates contain no scripts and render with JavaScript disabled.
 */
const htmlEngine = new Liquid({
  root: REPORT_TEMPLATES_DIR,
  extname: ".html",
  outputEscape: "escape",
  strictFilters: true,
  ownPropertyOnly: true,
  cache: true,
});

/** Escapes characters with meaning in Markdown so user-entered text stays plain text. */
export function escapeMarkdown(value: unknown): string {
  return String(value ?? "")
    .replace(/([\\`*_[\]{}<>#|!])/g, "\\$1")
    .replace(/^(\s*)([-+]|\d+\.)(\s)/gm, "$1\\$2$3");
}

const markdownEngine = new Liquid({
  root: REPORT_TEMPLATES_DIR,
  strictFilters: true,
  ownPropertyOnly: true,
  cache: true,
});
markdownEngine.registerFilter("md", escapeMarkdown);

/** Validates the data against the report's schema and renders its HTML template. */
export async function renderReportHtml(report: ReportData): Promise<string> {
  const info = getReportType(report.type);
  if (!info) throw new Error(`Unknown report type ${report.type}`);
  const data = REPORT_DATA_SCHEMAS[report.type].parse(report.data);
  return htmlEngine.renderFile(`${info.folder}/template.html`, data);
}

/** Markdown export of the accessibility statement. */
export async function renderStatementMarkdown(data: AccessibilityStatementData): Promise<string> {
  const valid = REPORT_DATA_SCHEMAS.accessibility_statement.parse(data);
  const markdown = await markdownEngine.renderFile("accessibility-statement/statement.md", valid);
  return `${markdown.replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
