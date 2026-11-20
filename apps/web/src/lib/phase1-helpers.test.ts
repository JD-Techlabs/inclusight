import { describe, expect, it } from "vitest";
import { exportFilename, neutraliseFormula, toCsv } from "./export";
import { issueQueryString, parseIssueQuery, toIssueFilters } from "./issue-filters";
import { issueUpdateSchema, parseBaseUrl, parseScanSettings } from "./property-input";

describe("parseIssueQuery", () => {
  it("defaults to active violations sorted by severity", () => {
    const query = parseIssueQuery({});
    expect(query).toMatchObject({ type: "violations", status: "active", sort: "severity", p: 1 });
    expect(toIssueFilters(query)).toMatchObject({
      statuses: ["open", "in_progress"],
      category: "wcag",
    });
    expect(toIssueFilters(parseIssueQuery({ type: "review" })).category).toBe("review");
    expect(toIssueFilters(parseIssueQuery({ type: "best-practice" })).category).toBe(
      "best_practice",
    );
  });

  it("accepts valid filters and drops invalid ones", () => {
    const query = parseIssueQuery({
      status: "false_positive",
      impact: "critical",
      criterion: "1.4.3",
      template: "nope",
      p: "-3",
      sort: ["occurrences", "severity"],
    });
    expect(query).toMatchObject({
      status: "false_positive",
      impact: "critical",
      criterion: "1.4.3",
      p: 1,
      sort: "occurrences",
    });
    expect(query.template).toBeUndefined();
    expect(toIssueFilters(parseIssueQuery({ status: "all" })).statuses).toBeUndefined();
  });

  it("builds query strings that omit defaults", () => {
    const query = parseIssueQuery({ impact: "serious" });
    expect(issueQueryString(query)).toBe("?impact=serious");
    expect(issueQueryString(query, { p: 2 })).toBe("?impact=serious&p=2");
    expect(issueQueryString(parseIssueQuery({}))).toBe("");
  });
});

describe("parseBaseUrl", () => {
  it("adds https and normalises", () => {
    expect(parseBaseUrl("Example.com/investors#x", { allowPrivateHosts: false })).toEqual({
      ok: true,
      url: "https://example.com/investors",
    });
  });

  it("rejects private and local addresses unless allowed", () => {
    for (const bad of [
      "http://localhost:4100",
      "http://127.0.0.1",
      "10.0.0.2",
      "http://192.168.1.10",
      "http://intranet",
    ]) {
      expect(parseBaseUrl(bad, { allowPrivateHosts: false }).ok, bad).toBe(false);
    }
    expect(parseBaseUrl("http://localhost:4100", { allowPrivateHosts: true })).toEqual({
      ok: true,
      url: "http://localhost:4100/",
    });
  });

  it("rejects garbage and credentials", () => {
    expect(parseBaseUrl("not a url", { allowPrivateHosts: false }).ok).toBe(false);
    expect(parseBaseUrl("https://user:pass@example.com", { allowPrivateHosts: false }).ok).toBe(
      false,
    );
  });
});

describe("parseScanSettings", () => {
  const form = (entries: Array<[string, string]>) => {
    const data = new FormData();
    for (const [k, v] of entries) data.append(k, v);
    return data;
  };
  const base: Array<[string, string]> = [
    ["maxPages", "100"],
    ["maxDepth", "3"],
    ["include", "/blog/**\n\n /news/* "],
    ["exclude", ""],
    ["viewports", "desktop"],
    ["respectRobots", "off"],
  ];

  it("parses lists and forces robots.txt for unverified properties", () => {
    const result = parseScanSettings(form(base), { verified: false, maxPagesLimit: 1000 });
    expect(result).toMatchObject({
      ok: true,
      config: {
        maxPages: 100,
        maxDepth: 3,
        include: ["/blog/**", "/news/*"],
        respectRobots: true,
        viewports: ["desktop"],
      },
    });
  });

  it("enforces the page limit and requires a viewport", () => {
    const tooMany = parseScanSettings(
      form([
        ["maxPages", "5000"],
        ["maxDepth", "3"],
        ["viewports", "mobile"],
      ]),
      {
        verified: true,
        maxPagesLimit: 1000,
      },
    );
    expect(tooMany).toMatchObject({
      ok: false,
      errors: { maxPages: "The current limit is 1000 pages." },
    });
    const noViewport = parseScanSettings(
      form([
        ["maxPages", "10"],
        ["maxDepth", "3"],
      ]),
      { verified: true, maxPagesLimit: 1000 },
    );
    expect(noViewport).toMatchObject({
      ok: false,
      errors: { viewports: "Choose at least one viewport." },
    });
  });
});

describe("issueUpdateSchema", () => {
  const input = {
    issueIds: ["a"],
    status: "",
    reason: "",
    assignee: "",
    targetDate: "",
    clearTargetDate: false,
  };

  it("requires a reason for false positives and accepted risk", () => {
    expect(issueUpdateSchema.safeParse({ ...input, status: "false_positive" }).success).toBe(false);
    expect(
      issueUpdateSchema.safeParse({ ...input, status: "false_positive", reason: "Decorative" })
        .success,
    ).toBe(true);
  });

  it("requires a selection and a change", () => {
    expect(issueUpdateSchema.safeParse({ ...input, issueIds: [], status: "fixed" }).success).toBe(
      false,
    );
    expect(issueUpdateSchema.safeParse(input).success).toBe(false);
  });

  it("accepts a target date, or clearing it, as the only change", () => {
    expect(issueUpdateSchema.safeParse({ ...input, targetDate: "2026-12-31" }).success).toBe(true);
    expect(issueUpdateSchema.safeParse({ ...input, clearTargetDate: true }).success).toBe(true);
    expect(issueUpdateSchema.safeParse({ ...input, targetDate: "31/12/2026" }).success).toBe(false);
  });
});

describe("CSV export", () => {
  it("quotes, escapes and neutralises formulas", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        { a: '=HYPERLINK("x")', b: 'say "hi", ok' },
        { a: 3, b: null },
      ],
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("a,b");
    expect(lines[1]).toBe(`"'=HYPERLINK(""x"")","say ""hi"", ok"`);
    expect(lines[2]).toBe("3,");
    expect(lines[3]).toContain("manual testing is required");
    expect(neutraliseFormula("-1")).toBe("'-1");
    expect(neutraliseFormula("plain")).toBe("plain");
  });

  it("builds a safe filename", () => {
    expect(
      exportFilename("Alpha Broking: Main site!", "xlsx", new Date("2026-11-17T10:00:00Z")),
    ).toBe("alpha-broking-main-site-issues-2026-11-17.xlsx");
  });
});
