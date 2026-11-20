import { describe, expect, it } from "vitest";
import { buildAccessibilityStatement, conformanceWording } from "./builders/statement";
import { financialYearDates, financialYearSchema, REPORT_PARAMS_SCHEMAS } from "./params";
import { audit, ctx, properties, sampleReports, snapshot } from "./testing/sample-reports";

const reports = Object.fromEntries(sampleReports().map((r) => [r.type, r.data]));

describe("platform inventory", () => {
  it("lists every platform with owner, status and unresolved WCAG issues", () => {
    const data = reports.platform_inventory as import("./schemas").PlatformInventoryData;
    expect(data.totals).toEqual({ platforms: 2, investorFacing: 2, verified: 1, scanned: 1 });
    expect(data.platforms[0]).toMatchObject({
      owner: "Ravi Kumar",
      score: "72 / 100",
      unresolvedIssues: 4, // 2 image-alt + 1 contrast + 1 accepted risk; best practice excluded
      criticalOrSerious: 4,
    });
    expect(data.platforms[1]).toMatchObject({ owner: "Not assigned", lastScan: "Not scanned yet" });
    expect(data.meta.automatedNote).toMatch(/manual testing is required/);
    expect(data.meta.certificationNote).toMatch(/not a certification/);
  });
});

describe("audit summary", () => {
  const data = reports.audit_summary as import("./schemas").AuditSummaryData;

  it("reports the auditor, findings by severity and the locked snapshot", () => {
    expect(data.audit).toMatchObject({
      iaapCertId: "WAS-0000-1234",
      standard: "WCAG 2.1 Level AA",
    });
    expect(data.audit.status).toMatch(/^Closed on 16 November 2026/);
    expect(data.meta.draft).toBe(false);
    expect(data.audit.methodology).toHaveLength(2);
    expect(data.severity.find((s) => s.severity === "Critical")).toEqual({
      severity: "Critical",
      unresolved: 2,
      fixed: 1,
      total: 3,
    });
    expect(data.criteria.map((c) => c.criterion)).toEqual([
      "1.1.1 Non-text Content",
      "1.4.3 Contrast (Minimum)",
      "2.4.4 Link Purpose (In Context)",
      "4.1.2 Name, Role, Value",
    ]);
  });

  it("includes the WCAG matrix and the GIGW and IS 17802 placeholders marked for review", () => {
    expect(data.conformance.map((t) => t.pendingReview)).toEqual([false, true, true]);
    const wcag = data.conformance[0]!;
    expect(wcag.rows).toHaveLength(50);
    expect(wcag.properties).toEqual(["Main website", "Investor portal"]);
    const contrast = wcag.rows.find((r) => r.criterion.startsWith("1.4.3"))!;
    expect(contrast.statuses).toEqual(["Does not support", "Not evaluated"]);
    expect(contrast.overall).toBe("Partially supports");
    expect(data.conformance[1]!.standard).toMatch(/GIGW 3\.0.*Pending expert review/);
    expect(data.manualTesting).toEqual({ tested: 3, total: 100, evidenceFiles: 2 });
  });

  it("marks an audit that is still open as a draft", async () => {
    const { buildAuditSummary } = await import("./builders/audit-summary");
    const open = buildAuditSummary(
      ctx,
      { ...audit, status: "in_progress", closedAt: null },
      snapshot,
    );
    expect(open.meta.draft).toBe(true);
    expect(open.audit.status).toBe("In progress");
  });
});

describe("remediation tracker", () => {
  const data = reports.remediation_tracker as import("./schemas").RemediationTrackerData;

  it("lists WCAG findings with owner, target date, fixed date and verification", () => {
    expect(data.items).toHaveLength(4); // the review finding is not a remediation item
    expect(data.items[0]).toMatchObject({
      owner: "Ravi Kumar",
      targetDate: "31 October 2026",
      status: "Open",
    });
    expect(data.items.find((i) => i.rule === "label")).toMatchObject({
      fixedDate: "18 November 2026",
      verification: "Not found in the scan of 18 November 2026",
    });
    expect(data.overdue).toBe(1); // target 31 Oct, still open on 19 Nov
    expect(data.totals.find((t) => t.status === "Accepted risk")?.count).toBe(1);
  });
});

describe("annual report", () => {
  const data = reports.sebi_annual as import("./schemas").AnnualReportData;

  it("covers the financial year with its due date, audits, findings and signatories", () => {
    expect(data.financialYear).toEqual({
      label: "2026-27",
      start: "1 April 2026",
      end: "31 March 2027",
      due: "30 April 2027",
    });
    expect(data.audits).toHaveLength(1);
    expect(data.findings).toMatchObject({ total: 5, unresolved: 4, fixed: 1, acceptedRisk: 1 });
    expect(data.signatories.map((s) => [s.role, s.name])).toEqual([
      ["Chief Executive Officer", "Meera Shah"],
      ["Chief Technology Officer", ""],
    ]);
    expect(data.meta.draft).toBe(true);
    expect(data.meta.draftNote).toMatch(/signed outside Inclusight/);
  });

  it("validates financial years", () => {
    expect(financialYearSchema.safeParse("2025-26").success).toBe(true);
    expect(financialYearSchema.safeParse("2025-27").success).toBe(false);
    expect(financialYearSchema.safeParse("2099-00").success).toBe(true);
    expect(financialYearDates("2025-26").due.toISOString().slice(0, 10)).toBe("2026-04-30");
  });
});

describe("accessibility statement", () => {
  it("states partial conformance with known limitations and the audit", () => {
    const data = reports.accessibility_statement as import("./schemas").AccessibilityStatementData;
    expect(data.conformance.level).toBe("Partially conformant");
    expect(data.limitations.map((l) => l.criterion)).toEqual(
      expect.arrayContaining(["1.1.1 Non-text Content", "1.4.3 Contrast (Minimum)"]),
    );
    expect(data.limitations.find((l) => l.criterion.startsWith("1.1.1"))?.description).toBe(
      "Images must have alternative text.",
    );
    expect(data.method).toMatch(/IAAP certification WAS-0000-1234/);
    expect(data.extraLimitations).toHaveLength(1);
  });

  it("uses WCAG-EM wording for each conformance level", () => {
    const row = (status: string) => ({ criterionId: "1.1.1", status }) as never;
    expect(conformanceWording([row("supports"), row("not_applicable")], "WCAG").level).toBe(
      "Fully conformant",
    );
    expect(conformanceWording([row("supports"), row("not_evaluated")], "WCAG").level).toBe(
      "Assessment in progress",
    );
    expect(conformanceWording([row("does_not_support")], "WCAG").level).toBe(
      "Partially conformant",
    );
  });

  it("works without an audit and validates the contact email", () => {
    const params = REPORT_PARAMS_SCHEMAS.accessibility_statement.parse({
      propertyId: "p-web",
      standardId: "wcag22aa",
      contactEmail: "a11y@example.test",
    });
    expect(params.responseDays).toBe(7);
    const data = buildAccessibilityStatement(ctx, params, properties[0]!, [], [], null);
    expect(data.method).toMatch(/self-assessment/);
    expect(
      REPORT_PARAMS_SCHEMAS.accessibility_statement.safeParse({ ...params, contactEmail: "nope" })
        .success,
    ).toBe(false);
  });
});
