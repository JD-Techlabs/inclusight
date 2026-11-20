import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findVeraPdf, validatePdfUa } from "@app/reports/testing";
import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll } from "./support/a11y";
import { createOwnerWithOrganisation, resetFixtureState } from "./support/flows";

const FIXTURE_URL = "http://localhost:4100";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.describe.configure({ timeout: 480_000 });
test.beforeAll(() => resetFixtureState());

async function addScannedProperty(page: Page, name: string) {
  await page.getByRole("link", { name: "Properties", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Website address").fill(FIXTURE_URL);
  await page.getByRole("button", { name: "Add property" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const propertyPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Scan this page" }).click();
  await expect(page.getByTestId("scan-status")).toHaveText("Status: Completed", {
    timeout: 150_000,
  });
  return propertyPath;
}

async function recordResult(page: Page, criterion: RegExp, result: string, notes: string) {
  await page.getByRole("link", { name: criterion }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: criterion })).toBeVisible();
  await page.getByRole("radio", { name: result, exact: true }).check();
  await page.getByLabel("Notes").fill(notes);
  await page.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Result saved." })).toBeVisible();
}

/** Generates a report from the reports page and waits until its files are ready. */
async function generateReport(page: Page, title: string, fill?: () => Promise<void>) {
  await page.goto("/reports");
  await page.getByRole("radio", { name: title, exact: true }).check();
  await fill?.();
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page).toHaveURL(/\/reports\/[\w-]+$/);
  await expect(page.getByTestId("report-status")).toHaveText("Status: Ready", { timeout: 120_000 });
  // The files list arrives with the refresh that follows "Ready".
  await expect(page.getByRole("heading", { level: 2, name: "Download" })).toBeVisible();
  return new URL(page.url()).pathname;
}

test("record an audit and generate all five reports as accessible PDFs", async ({ page }) => {
  const owner = await createOwnerWithOrganisation(page, "Audit Broking");
  const propertyPath = await addScannedProperty(page, "Fixture site");
  const pdfDir = mkdtempSync(join(tmpdir(), "inclusight-e2e-"));
  const pdfs: string[] = [];

  await test.step("custom rules report violations and findings that need review", async () => {
    await page.goto(`${propertyPath}/issues`);
    await expect(page.getByRole("link", { name: /working skip link/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Indian language/ })).toBeVisible();
    await page.getByRole("link", { name: "Needs review" }).click();
    await expect(
      page.getByRole("link", { name: /accessibility statement was found/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Linked PDF documents/ })).toBeVisible();
    await expectNoA11yViolations(page, "issues (needs review)");
  });

  await test.step("manual tests with a result, notes and evidence", async () => {
    await page.goto(propertyPath);
    await page.getByRole("link", { name: "Manual tests" }).click();
    await expect(page.getByRole("status").filter({ hasText: "0 of 50 criteria" })).toBeVisible();
    await expectNoA11yViolations(page, "manual tests");
    await recordResult(page, /^1\.4\.3 Contrast/, "Fail", "Grey risk disclaimer is 2.1:1");
    await expectNoA11yViolations(page, "manual test (criterion)");

    const file = page.getByLabel("File", { exact: true });
    await file.setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("<script>"),
    });
    await page.getByRole("button", { name: "Upload evidence" }).click();
    await expect(page.getByText(/content does not match its type/)).toBeVisible();
    await file.setInputFiles({ name: "contrast.png", mimeType: "image/png", buffer: PNG });
    await page.getByLabel("Description (optional)").fill("Colour picker on the disclaimer");
    await page.getByRole("button", { name: "Upload evidence" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Evidence uploaded." })).toBeVisible();
    const href = (await page.getByRole("link", { name: "contrast.png" }).getAttribute("href"))!;
    const download = await page.request.get(href);
    expect(download.headers()["content-type"]).toBe("image/png");
    expect(download.headers()["content-security-policy"]).toContain("sandbox");

    await page.getByRole("link", { name: /Back to manual tests/ }).click();
    await recordResult(page, /^2\.1\.1 Keyboard/, "Pass", "All journeys work with the keyboard");
  });

  await test.step("the conformance matrix combines scan and manual results", async () => {
    await page.getByRole("link", { name: "Conformance" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Conformance" })).toBeVisible();
    await expect(page.getByRole("row", { name: /^1\.4\.3 Contrast/ })).toContainText(
      "Does not support",
    );
    await expect(page.getByRole("row", { name: /^1\.1\.1 Non-text/ })).toContainText(
      "Partially supports",
    );
    await expect(page.getByRole("row", { name: /^2\.1\.1 Keyboard/ })).toContainText("Supports");
    await expectNoA11yViolations(page, "conformance (WCAG)");
    await page.getByRole("link", { name: /GIGW 3\.0/ }).click();
    await expect(page.getByText(/Pending expert review:/).first()).toBeVisible();
    await expectNoA11yViolations(page, "conformance (GIGW)");
    const csv = await (
      await page.request.get("/api/compliance/matrix?standard=wcag21aa&format=csv")
    ).text();
    expect(csv).toContain(
      "1.4.3 Contrast (Minimum),AA,Fixture site,Issues found,Fail,Does not support",
    );
    expect(csv).toContain("manual testing is required");
  });

  await test.step("set the property owner", async () => {
    await page.goto(`${propertyPath}/settings`);
    await page.getByLabel("Responsible person").selectOption({ label: owner.name });
    await page.getByRole("button", { name: "Save owner" }).click();
    await expect(page.getByText("Owner saved.")).toBeVisible();
  });

  let auditPath = "";
  await test.step("create an audit and close it to lock the findings", async () => {
    await page.getByRole("link", { name: "Audits" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Audits" })).toBeVisible();
    await expectNoA11yViolations(page, "audits");
    await page.getByLabel("Audit title").fill("FY 2026-27 accessibility audit");
    await page.getByLabel("Auditor's name").fill("R. Iyer");
    await page.getByLabel("IAAP certification number").fill("WAS-0000-1234");
    await page.getByLabel("Auditor's organisation").fill("Access Auditors LLP");
    await page.getByLabel("Start date").fill("2026-11-01");
    await page.getByLabel("Fixture site").check();
    await page.getByRole("button", { name: "Create audit" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "FY 2026-27 accessibility audit" }),
    ).toBeVisible();
    auditPath = new URL(page.url()).pathname;
    await expect(page.getByTestId("audit-status")).toHaveText("In progress");
    await expectNoA11yViolations(page, "audit (in progress)");
    await page.getByRole("button", { name: "Close audit and lock findings" }).click();
    await expect(page.getByText(/Confirm that the findings should be locked/)).toBeVisible();
    await page.getByLabel(/I understand that closing locks/).check();
    await page.getByRole("button", { name: "Close audit and lock findings" }).click();
    await expect(page.getByTestId("audit-status")).toContainText("findings locked");
    await expectNoA11yViolations(page, "audit (closed)");
  });

  const reportPaths: string[] = [];
  await test.step("generate all five reports and download every file", async () => {
    reportPaths.push(await generateReport(page, "Platform inventory"));
    await expectNoA11yViolations(page, "report (ready)");
    reportPaths.push(
      await generateReport(page, "Audit summary", async () => {
        await page
          .getByLabel("Audit", { exact: true })
          .selectOption({ label: "FY 2026-27 accessibility audit" });
      }),
    );
    reportPaths.push(await generateReport(page, "Remediation tracker"));
    reportPaths.push(
      await generateReport(page, "Annual accessibility compliance report (draft)", async () => {
        await page.getByLabel("CEO's name (optional)").fill("Meera Shah");
      }),
    );
    reportPaths.push(
      await generateReport(page, "Accessibility statement", async () => {
        await page.getByLabel("Property", { exact: true }).selectOption({ label: "Fixture site" });
        await page.getByLabel("Feedback email address").fill("accessibility@fixture.example");
      }),
    );
    await expectNoA11yViolations(page, "reports list");

    for (const [index, path] of reportPaths.entries()) {
      await page.goto(path);
      const links = page.getByRole("link", { name: /^Download / });
      expect(await links.count(), path).toBeGreaterThanOrEqual(2);
      for (const link of await links.all()) {
        const response = await page.request.get((await link.getAttribute("href"))!);
        expect(response.status()).toBe(200);
        const body = await response.body();
        if (response.headers()["content-type"] === "application/pdf") {
          expect(body.subarray(0, 5).toString()).toBe("%PDF-");
          const file = join(pdfDir, `report-${index}.pdf`);
          writeFileSync(file, body);
          pdfs.push(file);
        }
      }
    }
    expect(pdfs).toHaveLength(5);
  });

  await test.step("downloaded PDFs pass veraPDF PDF/UA-1", async () => {
    const runner = await findVeraPdf();
    if (!runner && process.env.VERAPDF_REQUIRED !== "1") {
      test.info().annotations.push({ type: "skipped", description: "veraPDF not available" });
      return;
    }
    expect(runner, "veraPDF is required").not.toBeNull();
    for (const result of await validatePdfUa(runner!, pdfs)) {
      expect(result.failures, result.file).toEqual([]);
      expect(result.compliant, result.file).toBe(true);
    }
    rmSync(pdfDir, { recursive: true, force: true });
  });

  await test.step("record a sign-off on the annual report", async () => {
    await page.goto(reportPaths[3]!);
    await page.getByLabel("Your designation").selectOption("Chief Executive Officer");
    await page.getByLabel("I have reviewed this report and approve it.").check();
    await page.getByRole("button", { name: "Record my approval" }).click();
    await expect(page.getByText("Your approval was recorded.")).toBeVisible();
    await expect(page.getByText(`${owner.name}, Chief Executive Officer`)).toBeVisible();
    await expectNoA11yViolations(page, "report (signed off)");
  });

  await test.step("new screens reflow at phone width", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      "/compliance",
      `${propertyPath}/manual-tests`,
      `${propertyPath}/manual-tests/1.4.3`,
      "/audits",
      auditPath,
      "/reports",
      reportPaths[3]!,
    ]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page, path);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  await test.step("every sensitive action is in the audit log", async () => {
    await page.goto("/audit-log");
    const log = page.getByRole("table", { name: /Audit log entries/ });
    for (const action of [
      "Manual test recorded",
      "Evidence uploaded",
      "Property owner changed",
      "Audit created",
      "Audit closed (findings locked)",
      "Report generated",
      "Report approved",
    ]) {
      await expect(
        log.getByRole("row", { name: new RegExp(action.replace(/[()]/g, "\\$&")) }).first(),
      ).toBeVisible();
    }
  });
});

test("another organisation cannot reach audits, reports, evidence or manual tests", async ({
  page,
  browser,
}) => {
  await createOwnerWithOrganisation(page, "Owner Org");
  const propertyPath = await addScannedProperty(page, "Private site");
  await page.goto(`${propertyPath}/manual-tests/1.1.1`);
  await page
    .getByLabel("File", { exact: true })
    .setInputFiles({ name: "e.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Upload evidence" }).click();
  const evidenceHref = (await page.getByRole("link", { name: "e.png" }).getAttribute("href"))!;
  await page.goto("/audits");
  await page.getByLabel("Audit title").fill("Private audit");
  await page.getByLabel("Auditor's name").fill("A");
  await page.getByLabel("IAAP certification number").fill("X");
  await page.getByLabel("Auditor's organisation").fill("Y");
  await page.getByLabel("Start date").fill("2026-11-01");
  await page.getByLabel("Private site").check();
  await page.getByRole("button", { name: "Create audit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Private audit" })).toBeVisible();
  const auditPath = new URL(page.url()).pathname;
  const reportPath = await generateReport(page, "Platform inventory");

  const other = await browser.newContext();
  const intruder = await other.newPage();
  await createOwnerWithOrganisation(intruder, "Intruder Org");
  for (const path of [
    auditPath,
    reportPath,
    `${propertyPath}/manual-tests`,
    `${propertyPath}/manual-tests/1.1.1`,
  ]) {
    expect((await intruder.goto(path))?.status(), path).toBe(404);
  }
  const reportId = reportPath.split("/")[2];
  for (const api of [
    evidenceHref,
    `/api/reports/${reportId}/files/pdf`,
    `/api/reports/${reportId}/status`,
  ]) {
    expect((await intruder.request.get(api)).status(), api).toBe(404);
  }
  const csv = await (await intruder.request.get("/api/compliance/matrix?format=csv")).text();
  expect(csv).not.toContain("Private site");
  await other.close();
});
