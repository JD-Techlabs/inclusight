import { fileURLToPath } from "node:url";

/**
 * Report template location (Node only). Templates are LiquidJS files in report-templates/,
 * one folder per report type (see report-templates/reports.yaml).
 */
export const REPORT_TEMPLATES_DIR = fileURLToPath(new URL("../report-templates/", import.meta.url));
