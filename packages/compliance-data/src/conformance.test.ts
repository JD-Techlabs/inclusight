import { describe, expect, it } from "vitest";
import { criteriaForStandard } from "./catalogue";
import {
  combineStatuses,
  conformanceForStandard,
  overallStatus,
  summariseFindings,
  type ConformanceInput,
  type ManualResult,
} from "./conformance";

const empty = summariseFindings([]);
const statusOf = (rows: ReturnType<typeof conformanceForStandard>, id: string) =>
  rows.find((r) => r.criterionId === id)?.status;

describe("overallStatus", () => {
  it.each([
    ["fail", "pass", "partially_supports"],
    ["fail", "not_tested", "partially_supports"],
    ["fail", "not_applicable", "partially_supports"],
    ["pass", "fail", "does_not_support"],
    ["not_scanned", "fail", "does_not_support"],
    ["pass", "pass", "supports"],
    ["not_covered", "pass", "supports"],
    ["review", "not_applicable", "not_applicable"],
    ["pass", "not_tested", "not_evaluated"],
    ["review", "not_tested", "not_evaluated"],
  ] as const)("automated %s + manual %s → %s", (automated, manual, expected) => {
    expect(overallStatus(automated, manual, "partial")).toBe(expected);
  });

  it("lets a clean scan decide only fully automatable criteria", () => {
    expect(overallStatus("pass", "not_tested", "full")).toBe("supports");
    expect(overallStatus("not_scanned", "not_tested", "full")).toBe("not_evaluated");
  });
});

describe("combineStatuses", () => {
  it.each([
    [[], "not_evaluated"],
    [["not_applicable", "not_applicable"], "not_applicable"],
    [["supports", "not_applicable"], "supports"],
    [["supports", "does_not_support"], "partially_supports"],
    [["does_not_support", "does_not_support"], "does_not_support"],
    [["supports", "not_evaluated"], "not_evaluated"],
    [["partially_supports", "not_evaluated"], "partially_supports"],
  ] as const)("%j → %s", (statuses, expected) => {
    expect(combineStatuses(statuses)).toBe(expected);
  });
});

describe("summariseFindings", () => {
  it("counts violations and review findings, ignoring best practice", () => {
    const summary = summariseFindings([
      {
        ruleId: "image-alt",
        criteria: ["1.1.1"],
        isBestPractice: false,
        needsReview: false,
        count: 3,
      },
      { ruleId: "region", criteria: ["1.3.1"], isBestPractice: true, needsReview: false, count: 9 },
      {
        ruleId: "cr-captcha-alternative",
        criteria: ["1.1.1", "3.3.8"],
        isBestPractice: true,
        needsReview: true,
        count: 1,
      },
    ]);
    expect(summary.byCriterion.get("1.1.1")).toEqual({ violations: 3, reviews: 1 });
    expect(summary.byCriterion.get("3.3.8")).toEqual({ violations: 0, reviews: 1 });
    expect(summary.byCriterion.has("1.3.1")).toBe(false);
    expect(summary.byRule.get("image-alt")).toEqual({ violations: 3, reviews: 0 });
  });
});

describe("conformanceForStandard", () => {
  const input = (overrides: Partial<ConformanceInput> = {}): ConformanceInput => ({
    scanned: true,
    findings: empty,
    manual: new Map(),
    ...overrides,
  });

  it("is not evaluated before any scan or manual test", () => {
    const rows = conformanceForStandard("wcag21aa", input({ scanned: false }));
    expect(rows).toHaveLength(50);
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(["not_evaluated"]));
  });

  it("combines scan findings with manual results", () => {
    const findings = summariseFindings([
      {
        ruleId: "image-alt",
        criteria: ["1.1.1"],
        isBestPractice: false,
        needsReview: false,
        count: 2,
      },
    ]);
    const manual = new Map<string, ManualResult>([
      ["1.4.3", "pass"],
      ["2.1.1", "fail"],
      ["1.2.4", "not_applicable"],
    ]);
    const rows = conformanceForStandard("wcag21aa", input({ findings, manual }));
    expect(statusOf(rows, "1.1.1")).toBe("partially_supports");
    expect(rows.find((r) => r.criterionId === "1.1.1")?.violations).toBe(2);
    expect(statusOf(rows, "1.4.3")).toBe("supports");
    expect(statusOf(rows, "2.1.1")).toBe("does_not_support");
    expect(statusOf(rows, "1.2.4")).toBe("not_applicable");
    expect(statusOf(rows, "4.1.1")).toBe("supports"); // obsolete, fully automatable
    expect(statusOf(rows, "2.4.3")).toBe("not_evaluated");
  });

  it("derives GIGW requirements from the criteria they relate to", () => {
    const allPass = new Map<string, ManualResult>(
      criteriaForStandard("wcag21aa").map((c) => [c.id, "pass"] as const),
    );
    let rows = conformanceForStandard("gigw3", input({ manual: allPass }));
    expect(statusOf(rows, "gigw3-wcag")).toBe("supports");
    expect(statusOf(rows, "gigw3-skip-link")).toBe("supports");
    expect(statusOf(rows, "gigw3-feedback")).toBe("not_evaluated"); // manual only

    const oneFail = new Map(allPass).set("2.4.1", "fail");
    rows = conformanceForStandard("gigw3", input({ manual: oneFail }));
    expect(statusOf(rows, "gigw3-wcag")).toBe("partially_supports");
    expect(statusOf(rows, "gigw3-skip-link")).toBe("does_not_support");
  });

  it("uses a requirement's own manual result and review findings", () => {
    const findings = summariseFindings([
      {
        ruleId: "cr-accessibility-statement",
        criteria: [],
        isBestPractice: true,
        needsReview: true,
        count: 1,
      },
    ]);
    let rows = conformanceForStandard("gigw3", input({ findings }));
    const row = rows.find((r) => r.criterionId === "gigw3-accessibility-statement")!;
    expect(row.automated).toBe("review");
    expect(row.status).toBe("not_evaluated");

    const manual = new Map<string, ManualResult>([["gigw3-accessibility-statement", "pass"]]);
    rows = conformanceForStandard("gigw3", input({ findings, manual }));
    expect(statusOf(rows, "gigw3-accessibility-statement")).toBe("supports");
  });
});
