/**
 * Report generation (spec §9): data builders, LiquidJS templates from compliance-data, tagged
 * PDF (PDF/UA-1), XLSX, HTML and Markdown. Runs in the worker. The web app imports only
 * "@app/reports/params" and "@app/reports/snapshot".
 */
export * from "./schemas";
export * from "./params";
export * from "./snapshot";
export * from "./format";
export type * from "./inputs";
export { buildPlatformInventory } from "./builders/inventory";
export { buildAuditSummary } from "./builders/audit-summary";
export { buildRemediationTracker } from "./builders/remediation";
export { buildAnnualReport } from "./builders/annual";
export { buildAccessibilityStatement, conformanceWording } from "./builders/statement";
export { conformanceTable } from "./builders/conformance-table";
export { renderReportHtml, renderStatementMarkdown, escapeMarkdown } from "./render";
export { renderPdf, makePdfUa } from "./pdf";
export { buildReportXlsx, safeCell } from "./xlsx";
export { renderReportFiles, FORMAT_CONTENT_TYPES, type RenderedFile } from "./generate";
export { loadReportData, ReportInputError, TRACKER_LIMIT } from "./load";
