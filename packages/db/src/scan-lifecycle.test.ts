import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./client";
import { orgScope } from "./org-scope";
import type { PageIssueInput } from "./scope/scan-results";
import { createTestDb, seedTwoOrgs } from "./testing/test-db";

let db: Database;
const score = (issues: Array<{ occurrences: number }>) => 100 - issues.length; // simple stand-in

function issue(fingerprint: string, selector = "main > img"): PageIssueInput {
  return {
    fingerprint,
    ruleId: "image-alt",
    impact: "critical",
    criteria: ["1.1.1"],
    isBestPractice: false,
    needsReview: false,
    helpText: "Images must have alternate text",
    description: "",
    helpUrl: null,
    normalisedSelector: selector,
    templateHash: "tpl",
    occurrences: [
      {
        viewport: "desktop",
        selector,
        htmlSnippet: "<img>",
        failureSummary: "",
        screenshotKey: null,
        bbox: null,
      },
    ],
  };
}

/** Runs one scan over the given pages. `results` maps URL → issues, or "fail" for a load failure. */
async function runScan(propertyId: string, results: Record<string, PageIssueInput[] | "fail">) {
  const scope = orgScope(db, "org-a");
  const scan = (await scope.scans.create({
    propertyId,
    mode: "full",
    trigger: "manual",
    createdBy: "u-a",
  }))!;
  const pageIds = await scope.scanResults.upsertPages(propertyId, Object.keys(results));
  const scanPages = await scope.scanResults.createScanPages(scan.id, [...pageIds.values()]);
  expect(scanPages).toHaveLength(Object.keys(results).length);

  for (const [url, result] of Object.entries(results)) {
    const pageId = pageIds.get(url)!;
    const row = (await scope.scans.listPages(scan.id, { limit: 100, offset: 0 })).find(
      (p) => p.pageId === pageId,
    )!;
    if (result === "fail") {
      await scope.scanResults.failScanPage(row.scanPageId, "timeout");
      continue;
    }
    const input = {
      scanId: scan.id,
      scanPageId: row.scanPageId,
      pageId,
      propertyId,
      title: url,
      templateHash: "tpl",
      screenshots: {},
      issues: result,
    };
    await scope.scanResults.recordPageResult(input);
    await scope.scanResults.recordPageResult(input); // a retried job must not duplicate anything
  }
  expect(await scope.scanResults.countPending(scan.id)).toBe(0);
  const summary = await scope.scanResults.finalize(scan.id, score);
  return { scanId: scan.id, summary: summary! };
}

async function statusOf(fingerprint: string) {
  const { rows } = await orgScope(db, "org-a").issues.list(
    "prop-a",
    {},
    { sort: "severity", limit: 100, offset: 0 },
  );
  const all = await Promise.all(rows.map((r) => orgScope(db, "org-a").issues.get(r.id)));
  return all.find((r) => r?.issue.fingerprint === fingerprint)?.issue;
}

beforeAll(async () => {
  db = await createTestDb();
  await seedTwoOrgs(db);
  await orgScope(db, "org-a").properties.create({
    name: "Alpha site",
    baseUrl: "https://alpha.test/",
    isInvestorFacing: true,
    verificationToken: "t",
    createdBy: "u-a",
  });
  const [p] = await orgScope(db, "org-a").properties.list();
  // Give the property a predictable id for the helpers above.
  await db.execute(`UPDATE properties SET id = 'prop-a' WHERE id = '${p!.id}'`);
});

describe("scan lifecycle", () => {
  it("records new issues once, de-duplicated across pages of a template", async () => {
    const { summary } = await runScan("prop-a", {
      "https://alpha.test/": [issue("fp-logo", "header > img"), issue("fp-hero")],
      "https://alpha.test/a": [issue("fp-logo", "header > img")],
      "https://alpha.test/b": [issue("fp-only-b")],
    });
    expect(summary.newIssues).toBe(3);
    expect(summary.fixedIssues).toBe(0);
    expect(summary.byImpact.critical).toBe(3);
    const logo = await statusOf("fp-logo");
    expect(logo?.occurrenceCount).toBe(2);
    expect(logo?.pageCount).toBe(2);
  });

  it("marks issues fixed only when their pages were re-scanned successfully", async () => {
    const { scanId, summary } = await runScan("prop-a", {
      "https://alpha.test/": [issue("fp-logo", "header > img"), issue("fp-new")],
      "https://alpha.test/a": [],
      "https://alpha.test/b": "fail",
    });
    expect(summary.newIssues).toBe(1); // fp-new
    expect(summary.fixedIssues).toBe(1); // fp-hero; fp-only-b's page failed
    expect((await statusOf("fp-hero"))?.status).toBe("fixed");
    expect((await statusOf("fp-hero"))?.fixedInScanId).toBe(scanId);
    expect((await statusOf("fp-only-b"))?.status).toBe("open");
    expect((await statusOf("fp-logo"))?.occurrenceCount).toBe(1);
  });

  it("reopens a fixed issue when it comes back", async () => {
    const { summary } = await runScan("prop-a", {
      "https://alpha.test/": [issue("fp-logo", "header > img"), issue("fp-new"), issue("fp-hero")],
    });
    expect(summary.reopenedIssues).toBe(1);
    expect((await statusOf("fp-hero"))?.status).toBe("open");
  });

  it("is idempotent when finalised twice", async () => {
    const scope = orgScope(db, "org-a");
    const { scanId, summary } = await runScan("prop-a", {
      "https://alpha.test/": [issue("fp-logo", "header > img")],
    });
    expect(await scope.scanResults.finalize(scanId, score)).toEqual(summary);
    const scan = await scope.scans.get(scanId);
    expect(scan?.scan.status).toBe("completed");
    expect(scan?.scan.pagesScanned).toBe(1);
  });

  it("fails a scan in which no page could be loaded, without fixing anything", async () => {
    const before = (await statusOf("fp-logo"))?.status;
    const { scanId } = await runScan("prop-a", { "https://alpha.test/": "fail" });
    const scan = await orgScope(db, "org-a").scans.get(scanId);
    expect(scan?.scan.status).toBe("failed");
    expect((await statusOf("fp-logo"))?.status).toBe(before);
  });

  it("does not let a manual false positive reopen or count against the score", async () => {
    const scope = orgScope(db, "org-a");
    const logo = (await statusOf("fp-logo"))!;
    await scope.issues.setStatus(
      [logo.id],
      "false_positive",
      "Decorative logo has text next to it",
    );
    const { summary } = await runScan("prop-a", {
      "https://alpha.test/": [issue("fp-logo", "header > img")],
    });
    expect((await statusOf("fp-logo"))?.status).toBe("false_positive");
    expect(summary.byImpact.critical).toBe(0);
  });
});

describe("cross-organisation isolation for scanning data", () => {
  it("hides properties, scans and issues of other organisations", async () => {
    const other = orgScope(db, "org-b");
    expect(await other.properties.get("prop-a")).toBeNull();
    expect(await other.properties.list()).toEqual([]);
    expect(await other.scans.listForProperty("prop-a")).toEqual([]);
    const issueId = (await statusOf("fp-new"))!.id;
    expect(await other.issues.get(issueId)).toBeNull();
    const { rows } = await other.issues.list(
      "prop-a",
      {},
      { sort: "severity", limit: 10, offset: 0 },
    );
    expect(rows).toEqual([]);
  });

  it("cannot start scans on, change or delete another organisation's data", async () => {
    const other = orgScope(db, "org-b");
    const statusBefore = (await statusOf("fp-new"))?.status;
    expect(
      await other.scans.create({
        propertyId: "prop-a",
        mode: "full",
        trigger: "manual",
        createdBy: "u-b",
      }),
    ).toBeNull();
    const issueId = (await statusOf("fp-new"))!.id;
    expect(await other.issues.setStatus([issueId], "accepted_risk", "x")).toEqual([]);
    expect(await other.issues.assign([issueId], null)).toEqual([]);
    expect(await other.properties.update("prop-a", { name: "hijacked" })).toBe(false);
    expect(await other.properties.markVerified("prop-a", "dns_txt")).toBe(false);
    expect(await other.properties.delete("prop-a")).toBe(false);
    expect((await orgScope(db, "org-a").properties.get("prop-a"))?.name).toBe("Alpha site");
    expect((await statusOf("fp-new"))?.status).toBe(statusBefore);
  });

  it("only assigns issues to members of the same organisation", async () => {
    const scope = orgScope(db, "org-a");
    const issueId = (await statusOf("fp-new"))!.id;
    expect(await scope.issues.assign([issueId], "u-b")).toEqual([]);
    expect(await scope.issues.assign([issueId], "u-a")).toHaveLength(1);
  });
});
