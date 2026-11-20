import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./client";
import { orgScope } from "./org-scope";
import * as schema from "./schema";
import { createTestDb, seedTwoOrgs } from "./testing/test-db";

let db: Database;
let propertyA: string;
let propertyB: string;

beforeAll(async () => {
  db = await createTestDb();
  await seedTwoOrgs(db);
  const create = (org: string, url: string) =>
    orgScope(db, org).properties.create({
      name: url,
      baseUrl: url,
      isInvestorFacing: true,
      verificationToken: "t",
      createdBy: org === "org-a" ? "u-a" : "u-b",
    });
  propertyA = (await create("org-a", "https://a.test")).id;
  propertyB = (await create("org-b", "https://b.test")).id;
});

describe("manual tests", () => {
  it("records and updates one result per property and criterion", async () => {
    const a = orgScope(db, "org-a");
    await a.manualTests.record({
      propertyId: propertyA,
      criterionId: "1.4.3",
      result: "fail",
      notes: "Grey footer text",
      testerId: "u-a",
    });
    await a.manualTests.record({
      propertyId: propertyA,
      criterionId: "1.4.3",
      result: "pass",
      notes: "Fixed",
      testerId: "u-a",
    });
    const rows = await a.manualTests.listForProperties([propertyA]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ result: "pass", notes: "Fixed", testerName: "Asha" });
  });

  it("cannot record results on another organisation's property", async () => {
    const intruder = orgScope(db, "org-b");
    const result = await intruder.manualTests.record({
      propertyId: propertyA,
      criterionId: "2.1.1",
      result: "pass",
      notes: "",
      testerId: "u-b",
    });
    expect(result).toBeNull();
    expect(await intruder.manualTests.ensure(propertyA, "2.1.1")).toBeNull();
    expect(await intruder.manualTests.listForProperties([propertyA])).toEqual([]);
    expect(await intruder.manualTests.get(propertyA, "1.4.3")).toBeNull();
  });
});

describe("evidence", () => {
  it("attaches files to the organisation's own manual tests only", async () => {
    const a = orgScope(db, "org-a");
    const test = (await a.manualTests.ensure(propertyA, "1.1.1"))!;
    expect(test.result).toBe("not_tested");
    const file = {
      linkedType: "manual_test" as const,
      linkedId: test.id,
      fileKey: "orgs/org-a/evidence/x.png",
      fileName: "x.png",
      contentType: "image/png",
      sizeBytes: 10,
      description: "Logo without alt",
    };
    const row = (await a.evidence.create({ ...file, uploadedBy: "u-a" }))!;
    expect(row.propertyId).toBe(propertyA);
    expect((await a.evidence.countByLink("manual_test", [test.id])).get(test.id)).toBe(1);

    const b = orgScope(db, "org-b");
    expect(await b.evidence.create({ ...file, uploadedBy: "u-b" })).toBeNull();
    expect(await b.evidence.get(row.id)).toBeNull();
    expect(await b.evidence.list("manual_test", test.id)).toEqual([]);
    expect(await b.evidence.delete(row.id)).toBeNull();
    expect(await a.evidence.get(row.id)).not.toBeNull();
  });
});

describe("audits", () => {
  const input = (propertyIds: string[]) => ({
    title: "FY 2026-27 audit",
    auditorName: "R. Iyer",
    iaapCertId: "WAS-123",
    auditorOrg: "Access Auditors LLP",
    startDate: "2026-11-01",
    endDate: null,
    propertyIds,
    standardId: "wcag21aa",
    methodology: "",
  });

  it("only accepts properties of the same organisation in scope", async () => {
    const a = orgScope(db, "org-a");
    expect(
      await a.audits.create({ ...input([propertyA, propertyB]), createdBy: "u-a" }),
    ).toBeNull();
    expect(await a.audits.create({ ...input([]), createdBy: "u-a" })).toBeNull();
    expect(await a.audits.create({ ...input([propertyA]), createdBy: "u-a" })).not.toBeNull();
  });

  it("closes once, locks the snapshot and is invisible to other organisations", async () => {
    const a = orgScope(db, "org-a");
    const audit = (await a.audits.create({ ...input([propertyA]), createdBy: "u-a" }))!;
    const b = orgScope(db, "org-b");
    expect(await b.audits.get(audit.id)).toBeNull();
    expect(await b.audits.close(audit.id, { version: 1 }, "u-b")).toBeNull();
    expect(await b.audits.update(audit.id, input([propertyB]))).toBeNull();

    const closed = (await a.audits.close(audit.id, { version: 1, locked: true }, "u-a"))!;
    expect(closed.status).toBe("closed");
    expect(await a.audits.close(audit.id, { version: 2 }, "u-a")).toBeNull();
    expect(await a.audits.update(audit.id, input([propertyA]))).toBeNull(); // closed: read-only
    expect((await a.audits.get(audit.id))?.audit.snapshot).toEqual({ version: 1, locked: true });
  });
});

describe("reports", () => {
  it("moves through generation and records each sign-off once", async () => {
    const a = orgScope(db, "org-a");
    const report = await a.reports.create({
      type: "sebi_annual",
      title: "Annual report",
      period: "FY 2025-26",
      params: {},
      generatedBy: "u-a",
    });
    const signOff = { userId: "u-a", name: "Asha", designation: "CEO", signedAt: "2026-11-19" };
    expect(await a.reports.addSignOff(report.id, signOff)).toBe(false); // not ready yet
    expect(await a.reports.markGenerating(report.id)).toBe(true);
    await a.reports.markReady(report.id, {
      pdf: { key: "k.pdf", size: 1, contentType: "application/pdf" },
    });
    expect(await a.reports.markGenerating(report.id)).toBe(false); // done: not regenerated
    expect(await a.reports.addSignOff(report.id, signOff)).toBe(true);
    expect(await a.reports.addSignOff(report.id, signOff)).toBe(false);
    expect(await a.reports.addSignOff(report.id, { ...signOff, designation: "CTO" })).toBe(true);
    expect((await a.reports.get(report.id))?.report.signedBy).toHaveLength(2);

    const b = orgScope(db, "org-b");
    expect(await b.reports.get(report.id)).toBeNull();
    expect(await b.reports.list()).toEqual([]);
    expect(await b.reports.addSignOff(report.id, { ...signOff, userId: "u-b" })).toBe(false);
  });
});

describe("compliance inputs", () => {
  it("aggregates unresolved findings and never reads another organisation's issues", async () => {
    const base = {
      ruleId: "image-alt",
      impact: "critical",
      criteria: ["1.1.1"],
      helpText: "Images must have alternate text",
      normalisedSelector: "img",
      templateHash: "t",
    };
    await db.insert(schema.issues).values([
      { ...base, orgId: "org-a", propertyId: propertyA, fingerprint: "f1", status: "open" },
      { ...base, orgId: "org-a", propertyId: propertyA, fingerprint: "f2", status: "fixed" },
      { ...base, orgId: "org-b", propertyId: propertyB, fingerprint: "f3", status: "open" },
    ]);
    const a = orgScope(db, "org-a");
    const rows = await a.complianceInputs.findingRows([propertyA, propertyB], ["open"]);
    expect(rows).toEqual([
      expect.objectContaining({ propertyId: propertyA, ruleId: "image-alt", count: 1 }),
    ]);
    expect(await a.complianceInputs.issuesForReport([propertyB])).toEqual([]);
    expect((await a.complianceInputs.propertiesWithOwners()).map((p) => p.property.id)).toEqual([
      propertyA,
    ]);
  });

  it("only assigns property owners who are members", async () => {
    const a = orgScope(db, "org-a");
    expect(await a.properties.setOwner(propertyA, "u-b")).toBe(false);
    expect(await a.properties.setOwner(propertyA, "u-a")).toBe(true);
    expect(await orgScope(db, "org-b").properties.setOwner(propertyA, "u-b")).toBe(false);
    const [row] = await a.complianceInputs.propertiesWithOwners();
    expect(row?.ownerName).toBe("Asha");
  });
});
