import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderReportFiles } from "./generate";
import { sampleReports } from "./testing/sample-reports";
import { findVeraPdf, validatePdfUa } from "./testing/verapdf";

/**
 * Spec §19 Phase 2: generated PDFs must pass veraPDF PDF/UA checks. Uses VERAPDF_BIN or the
 * pinned veraPDF Docker image. CI sets VERAPDF_REQUIRED=1 so a missing validator fails the
 * build instead of skipping.
 */
const runner = await findVeraPdf();
const required = process.env.VERAPDF_REQUIRED === "1";
if (!runner && !required) {
  console.warn("veraPDF not available (set VERAPDF_BIN or start Docker): skipping PDF/UA test");
}

describe.skipIf(!runner && !required)("generated report PDFs", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    dir = mkdtempSync(join(tmpdir(), "a11ycomply-pdfua-"));
  });
  afterAll(async () => {
    await browser?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("are tagged and pass veraPDF PDF/UA-1 for all five report types", async () => {
    expect(runner, "veraPDF is required (VERAPDF_REQUIRED=1)").not.toBeNull();
    const files: string[] = [];
    for (const report of sampleReports()) {
      const pdf = (await renderReportFiles(report, browser)).find((f) => f.format === "pdf");
      expect(pdf, report.type).toBeDefined();
      const text = pdf!.body.toString("latin1");
      expect(text, `${report.type} is tagged`).toContain("/StructTreeRoot");
      expect(text).toContain("pdfuaid:part>1<");
      const path = join(dir, `${report.type}.pdf`);
      writeFileSync(path, pdf!.body);
      files.push(path);
    }

    const results = await validatePdfUa(runner!, files);
    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result.failures, `${result.file} PDF/UA failures`).toEqual([]);
      expect(result.compliant, result.file).toBe(true);
    }
  });
});
