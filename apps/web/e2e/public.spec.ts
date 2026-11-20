import { expect, test, type Page } from "@playwright/test";
import {
  expectNextTabIsSkipLink,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
} from "./support/a11y";

const LIGHT_BACKGROUND = "rgb(246, 247, 251)";
const DARK_BACKGROUND = "rgb(11, 14, 23)";
const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("public pages", () => {
  test("sign-in page has no axe violations in light and dark schemes", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expectNoA11yViolations(page, "sign-in");

    expect(await background(page)).toBe(LIGHT_BACKGROUND);
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await background(page)).toBe(DARK_BACKGROUND); // the system dark setting applies
  });

  test("a chosen theme overrides the system setting and is remembered", async ({ page }) => {
    await page.goto("/sign-in");
    const html = page.locator("html");
    const choose = async (name: string) => {
      await page.getByRole("radio", { name, exact: true }).focus();
      await page.keyboard.press("Space");
      await expect(page.getByRole("radio", { name, exact: true })).toBeChecked();
    };

    await choose("Dark");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => background(page)).toBe(DARK_BACKGROUND);
    await page.reload(); // remembered in the theme cookie and rendered by the server
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();

    await choose("Light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => background(page)).toBe(LIGHT_BACKGROUND); // the choice wins

    await choose("System");
    await expect(html).not.toHaveAttribute("data-theme");
    await expect.poll(() => background(page)).toBe(DARK_BACKGROUND);
    await page.emulateMedia({ colorScheme: "light" });
  });

  test("sign-up page has no axe violations", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create an account");
    await expectNoA11yViolations(page, "sign-up");
  });

  test("two-factor page has no axe violations", async ({ page }) => {
    await page.goto("/two-factor");
    await expectNoA11yViolations(page, "two-factor");
  });

  test("skip link is the first focusable element and moves focus to main", async ({ page }) => {
    await page.goto("/sign-in");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
  });

  test("after moving to another page, the next Tab is the skip link", async ({ page }) => {
    await page.goto("/sign-in");
    // By mouse
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Create an account" })).toBeVisible();
    await expectNextTabIsSkipLink(page);
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
    // By keyboard
    await page.getByRole("link", { name: "Sign in" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expectNextTabIsSkipLink(page);
  });

  test("public pages fit a 320 px wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ["/sign-in", "/sign-up"]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page, path);
    }
  });

  test("the sign-in form can be completed with the keyboard and reports errors", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email address", { exact: true }).focus();
    await page.keyboard.type("nobody@example.test");
    await page.keyboard.press("Tab");
    await page.keyboard.type("not-the-right-password");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "Error" })).toBeVisible();
    await expectNoA11yViolations(page, "sign-in with error");
  });

  test("app pages redirect signed-out visitors to sign-in", async ({ page }) => {
    for (const path of ["/dashboard", "/members", "/audit-log", "/onboarding"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in/);
    }
  });

  test("redirect parameter cannot send users off-site", async ({ page }) => {
    await page.goto("/sign-up?redirect=https://evil.example");
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?redirect=%2Fonboarding",
    );
  });
});
