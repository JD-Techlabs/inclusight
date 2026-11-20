import { expect, test, type Page } from "@playwright/test";
import {
  expectNextTabIsSkipLink,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
} from "./support/a11y";
import { createOwnerWithOrganisation, resetFixtureState, setFixtureState } from "./support/flows";

const FIXTURE_URL = "http://localhost:4100";

test.describe.configure({ timeout: 360_000 });
test.afterAll(() => resetFixtureState());

async function startScanAndWait(page: Page) {
  await page.getByRole("button", { name: /Start full scan|Scan this page/ }).click();
  await expect(page).toHaveURL(/\/scans\/[\w-]+$/);
  await expect(page.getByTestId("scan-status")).toHaveText("Status: Completed", {
    timeout: 150_000,
  });
  await expect(page.getByTestId("scan-summary")).toBeVisible();
}

const summaryValue = (page: Page, term: string) =>
  page
    .getByTestId("scan-summary")
    .locator("div", { has: page.getByText(term, { exact: true }) })
    .locator("dd");

test("add property → verify → scan → triage → re-scan detects fixed and new → export", async ({
  page,
}) => {
  resetFixtureState();
  setFixtureState("version.txt", "v1");
  await createOwnerWithOrganisation(page, "Fixture Broking");

  await test.step("add a property", async () => {
    await page.getByRole("link", { name: "Properties", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Properties" })).toBeVisible();
    await expectNoA11yViolations(page, "properties (empty)");
    await page.getByLabel("Name", { exact: true }).fill("Fixture site");
    await page.getByLabel("Website address").fill(FIXTURE_URL);
    await page.getByRole("button", { name: "Add property" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Fixture site" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan this page" })).toBeVisible(); // unverified
    await expectNoA11yViolations(page, "property (unverified)");
  });

  await test.step("verify the domain with the well-known file", async () => {
    await page.getByLabel("File at /.well-known/inclusight.txt").check();
    const token = (await page.getByTestId("verification-value").innerText()).trim();
    await page.getByRole("button", { name: "Verify domain" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "could not be loaded" })).toBeVisible(); // file not there yet
    setFixtureState("well-known.txt", token);
    await page.getByRole("button", { name: "Verify domain" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Domain verified." })).toBeVisible();
    await expect(page.getByText(/Domain: Verified/)).toBeVisible();
    await expectNoA11yViolations(page, "property (just verified)");
  });

  await test.step("limit the crawl in settings", async () => {
    await page.getByRole("link", { name: "Settings" }).click();
    await expectNoA11yViolations(page, "property settings");
    await page.getByLabel("Maximum pages per scan").fill("8");
    await page.getByLabel("Maximum link depth").fill("2");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await page.getByRole("link", { name: /Back to Fixture site/ }).click();
  });

  await test.step("first scan finds issues and de-duplicates them by template", async () => {
    await startScanAndWait(page);
    await expect(summaryValue(page, "New issues")).not.toHaveText("0");
    await expect(
      page.getByRole("table", { name: /Pages in this scan/ }).getByRole("row"),
    ).toHaveCount(9);
    await expectNoA11yViolations(page, "scan (completed)");

    await page.getByRole("link", { name: "View issues" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Issues: Fixture site/ }),
    ).toBeVisible();
    await expectNoA11yViolations(page, "issues list");
    // The article chart image appears on every article page but is one issue.
    await page.getByLabel("Page address contains").fill("/articles/");
    await page.getByRole("button", { name: "Apply filters" }).click();
    const imageRows = page.getByRole("row").filter({ hasText: /Images must have alternat/ });
    // Header logo (7 pages sharing the main template) and article chart (4 article pages).
    await expect(imageRows).toHaveCount(2);
    await expect(
      imageRows.filter({ has: page.getByRole("cell", { name: "4", exact: true }) }),
    ).toHaveCount(1);
    await expect(
      imageRows.filter({ has: page.getByRole("cell", { name: "7", exact: true }) }),
    ).toHaveCount(1);
  });

  await test.step("issue detail shows occurrences with a screenshot", async () => {
    await page
      .getByRole("link", { name: /Images must have alternat/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Images must have alternat/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /Occurrences/ })).toBeVisible();
    await page
      .getByText(/Show screenshot/)
      .first()
      .click();
    const image = page.getByRole("img", { name: /Screenshot of http:\/\/localhost:4100/ }).first();
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expectNoA11yViolations(page, "issue detail");
  });

  await test.step("false positives need a reason and are audit-logged", async () => {
    await page.getByRole("link", { name: "Back to issues" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Issues: Fixture site/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: /color contrast/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: /color contrast/i })).toBeVisible();
    await page.getByLabel("New status").selectOption("false_positive");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText(/Give a reason/)).toBeVisible();
    await page.getByLabel("Reason").fill("Brand-approved disclaimer colour; reviewed manually");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText("Updated 1 issue.")).toBeVisible();
    await expect(page.getByText(/False positive — Brand-approved/)).toBeVisible();
  });

  await test.step("re-scan after the site changes marks one fixed and one new issue", async () => {
    setFixtureState("version.txt", "v2");
    await page.goto("/properties");
    await page.getByRole("link", { name: "Fixture site" }).click();
    await startScanAndWait(page);
    await expect(summaryValue(page, "Fixed issues")).toHaveText("1");
    await expect(summaryValue(page, "New issues")).toHaveText("1");
    await page.getByRole("link", { name: /Back to Fixture site/ }).click();
    await expect(
      page.getByRole("table", { name: /Score per completed scan/ }).getByRole("row"),
    ).toHaveCount(3);
    await expectNoA11yViolations(page, "property (verified, with trend)");
  });

  await test.step("export the issue list", async () => {
    const issuesUrl = (await page.getByRole("link", { name: /Issues \(/ }).getAttribute("href"))!;
    const propertyId = issuesUrl.split("/")[2];
    const csv = await page.request.get(
      `/api/properties/${propertyId}/issues/export?format=csv&status=all`,
    );
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const body = await csv.text();
    expect(body).toContain("image-alt");
    expect(body).toContain("button-name");
    expect(body).toContain("manual testing is required");
    const xlsx = await page.request.get(`/api/properties/${propertyId}/issues/export?format=xlsx`);
    expect(xlsx.status()).toBe(200);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  });

  await test.step("after moving between screens, the next Tab is the skip link", async () => {
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Members" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
    await expectNextTabIsSkipLink(page);
    await nav.getByRole("link", { name: "Properties", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Properties" })).toBeVisible();
    await expectNextTabIsSkipLink(page);
  });

  await test.step("main screens reflow at phone width without horizontal scrolling", async () => {
    await page.goto("/properties");
    await page.getByRole("link", { name: "Fixture site" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Fixture site" })).toBeVisible();
    const propertyPath = new URL(page.url()).pathname;
    const scanPath = (await page.getByRole("link", { name: /IST$/ }).first().getAttribute("href"))!;
    await page.goto(`${propertyPath}/issues`);
    const issuePath = (await page
      .getByRole("link", { name: /Images must have alternat/ })
      .first()
      .getAttribute("href"))!;
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      "/dashboard",
      "/properties",
      propertyPath,
      `${propertyPath}/settings`,
      `${propertyPath}/issues`,
      issuePath,
      scanPath,
      "/members",
      "/audit-log",
    ]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page, path);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  await test.step("sensitive actions are in the audit log", async () => {
    await page.getByRole("link", { name: "Audit log" }).click();
    const log = page.getByRole("table", { name: /Audit log entries/ });
    for (const action of [
      "Property added",
      "Domain verified",
      "Property settings changed",
      "Scan started",
      "Issue status changed",
    ]) {
      await expect(log.getByRole("row", { name: new RegExp(action) }).first()).toBeVisible();
    }
    await expect(log).toContainText("Reason: Brand-approved");
  });
});

test("another organisation cannot see the property, its scans or screenshots", async ({
  page,
  browser,
}) => {
  setFixtureState("version.txt", "v1");
  await createOwnerWithOrganisation(page, "Owner Org");
  await page.getByRole("link", { name: "Properties", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Private site");
  await page.getByLabel("Website address").fill(FIXTURE_URL);
  await page.getByRole("button", { name: "Add property" }).click();
  await startScanAndWait(page); // single-page scan (unverified)
  const scanUrl = page.url();
  const propertyUrl = (await page
    .getByRole("link", { name: /Back to Private site/ })
    .getAttribute("href"))!;

  const other = await browser.newContext();
  const intruder = await other.newPage();
  await createOwnerWithOrganisation(intruder, "Intruder Org");
  for (const path of [propertyUrl, `${propertyUrl}/issues`, new URL(scanUrl).pathname]) {
    const response = await intruder.goto(path);
    expect(response?.status(), path).toBe(404);
  }
  const scanId = new URL(scanUrl).pathname.split("/")[2];
  expect((await intruder.request.get(`/api/scans/${scanId}/progress`)).status()).toBe(404);
  expect(
    (
      await intruder.request.get(`/api/properties/${propertyUrl.split("/")[2]}/issues/export`)
    ).status(),
  ).toBe(404);
  await other.close();
});
