import { AUTOMATED_TESTING_DISCLAIMER } from "./labels";

export type ExportRow = Record<string, string | number | null>;

/**
 * Spreadsheet apps execute cells starting with = + - @ (and tab/CR) as formulas. Page content
 * ends up in exports, so such cells are prefixed with an apostrophe (OWASP CSV injection).
 */
export function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | null): string {
  const text =
    value === null ? "" : typeof value === "number" ? String(value) : neutraliseFormula(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 CSV with a header row and the automated-testing note as the last line. */
export function toCsv(columns: string[], rows: ExportRow[]): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows)
    lines.push(columns.map((column) => csvCell(row[column] ?? null)).join(","));
  lines.push(csvCell(`Note: ${AUTOMATED_TESTING_DISCLAIMER}`));
  return `${lines.join("\r\n")}\r\n`;
}

export function exportFilename(propertyName: string, extension: "csv" | "xlsx", now = new Date()) {
  const slug =
    propertyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "property";
  return `${slug}-issues-${now.toISOString().slice(0, 10)}.${extension}`;
}
