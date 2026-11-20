import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPORT_TEMPLATES_DIR } from "@app/compliance-data/templates";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { reportJsonSchemas } from "./json-schemas";
import { escapeMarkdown, renderReportHtml, renderStatementMarkdown } from "./render";
import type { AccessibilityStatementData } from "./schemas";
import { sampleReports } from "./testing/sample-reports";
import { buildReportXlsx, safeCell } from "./xlsx";

const samples = sampleReports();

describe("report templates", () => {
  it("render every report type as an accessible HTML document", async () => {
    for (const report of samples) {
      const html = await renderReportHtml(report);
      expect(html, report.type).toMatch(/<html lang="en">/);
      expect(html, report.type).toMatch(/<title>[^<]+<\/title>/);
      expect(html.match(/<h1>/g), report.type).toHaveLength(1);
      expect(html, report.type).not.toMatch(/<script/i);
      for (const table of html.match(/<table>[\s\S]*?<\/table>/g) ?? []) {
        expect(table, report.type).toMatch(/<caption>/);
        expect(table, report.type).toMatch(/scope="col"/);
      }
    }
  });

  it("escapes organisation data", async () => {
    const html = await renderReportHtml(samples[0]!);
    expect(html).toContain("Sample Broking &amp; Co &lt;Demo&gt;");
    expect(html).not.toContain("<Demo>");
  });

  it("carries the automated-testing and not-a-certification notes", async () => {
    for (const report of samples.filter((r) => r.type !== "accessibility_statement")) {
      const html = await renderReportHtml(report);
      expect(html).toMatch(/Automated checks find only part of all accessibility issues/);
      expect(html).toMatch(/not a certification/);
    }
  });

  it("rejects data that does not match the report's schema", async () => {
    const broken = { type: "platform_inventory", data: { meta: {} } } as never;
    await expect(renderReportHtml(broken)).rejects.toThrow();
  });

  it("keeps each template's schema.json in sync with the builders", () => {
    for (const { folder, schema } of reportJsonSchemas()) {
      const file = JSON.parse(
        readFileSync(join(REPORT_TEMPLATES_DIR, folder, "schema.json"), "utf8"),
      );
      expect(file, `run: pnpm --filter @app/reports schemas:write (${folder})`).toEqual(schema);
    }
  });
});

describe("accessibility statement Markdown", () => {
  const statement = samples.find((r) => r.type === "accessibility_statement")!
    .data as AccessibilityStatementData;

  it("renders headings and limitations as Markdown", async () => {
    const md = await renderStatementMarkdown(statement);
    expect(md).toMatch(/^# Accessibility statement for Main website\n/);
    expect(md).toMatch(/\n## Known limitations\n/);
    expect(md).toMatch(/\n- \*\*1\.1\.1 Non-text Content:\*\* Images must have alternative text\./);
    expect(md).toContain("<accessibility@sample-broking.example>");
    expect(md).not.toMatch(/\n{3,}/);
  });

  it("escapes Markdown in user-entered text", () => {
    expect(escapeMarkdown("[click](javascript:x) <b>*bold*</b>")).toBe(
      "\\[click\\](javascript:x) \\<b\\>\\*bold\\*\\</b\\>",
    );
    expect(escapeMarkdown("# Heading\n- item")).toBe("\\# Heading\n\\- item");
  });
});

describe("XLSX", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(safeCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeCell("Plain")).toBe("Plain");
    expect(safeCell(5)).toBe(5);
  });

  it("builds a workbook with an About sheet for every spreadsheet report", async () => {
    for (const report of samples.filter((r) => r.type !== "accessibility_statement")) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load((await buildReportXlsx(report)) as never);
      const about = workbook.getWorksheet("About")!;
      expect(about, report.type).toBeDefined();
      const values = about.getColumn(2).values.map(String).join("\n");
      expect(values).toMatch(/manual testing is required/);
      expect(workbook.worksheets.length, report.type).toBeGreaterThan(1);
    }
  });
});
