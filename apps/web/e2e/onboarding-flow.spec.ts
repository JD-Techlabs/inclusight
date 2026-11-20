import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./support/a11y";
import { emailTextsFor, waitForEmailLink } from "./support/mailpit";
import { totp } from "./support/totp";

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const password = "correct-horse-battery-staple-1";
const owner = { name: "Olivia Owner", email: `owner-${run}@example.test` };
const invitee = { name: "Ivan Invitee", email: `invitee-${run}@example.test` };
const orgName = `Alpha Broking ${run}`;

async function signUp(page: Page, person: { name: string; email: string }) {
  await page.getByLabel("Full name").fill(person.name);
  await page.getByLabel("Work email address").fill(person.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("sign-up → organisation → 2FA → invite → accept → audit log", async ({ page, browser }) => {
  let totpSecret = "";

  await test.step("owner signs up", async () => {
    await page.goto("/sign-up");
    await signUp(page, owner);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expectNoA11yViolations(page, "onboarding");
  });

  await test.step("owner creates an organisation", async () => {
    await page.getByLabel("Organisation name").fill(orgName);
    await page.getByLabel("Type of regulated entity").selectOption("broker");
    await page.getByLabel("Reporting authority").selectOption("nse");
    await page.getByRole("button", { name: "Create organisation" }).click();
  });

  await test.step("owner is required to set up two-step verification", async () => {
    await expect(page).toHaveURL(/\/two-factor-setup$/);
    await expectNoA11yViolations(page, "two-factor setup (start)");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/two-factor-setup$/); // cannot skip it

    await page.getByLabel("Confirm your password").fill(password);
    await page.getByRole("button", { name: "Start setup" }).click();
    totpSecret = (await page.getByTestId("totp-secret").innerText()).trim();
    expect(totpSecret.length).toBeGreaterThan(15);
    await expectNoA11yViolations(page, "two-factor setup (enrolment)");

    await page.getByLabel("6-digit code from your app").fill(totp(totpSecret));
    await page.getByRole("button", { name: "Turn on two-step verification" }).click();
  });

  await test.step("owner lands on the dashboard inside the app shell", async () => {
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText(orgName);
    await expect(page.getByText("Stock broker")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectNoA11yViolations(page, "dashboard");
  });

  await test.step("on a phone the navigation is behind a Menu button", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.getByRole("button", { name: "Menu" });
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(nav).toBeHidden();
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(nav).toBeVisible();
    await expectNoA11yViolations(page, "dashboard (phone, menu open)");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
    await expect(nav).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  await test.step("owner invites a developer", async () => {
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
    await page.getByLabel("Email address").fill(invitee.email);
    await page.getByLabel("Role", { exact: true }).selectOption("developer");
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText(`Invitation sent to ${invitee.email}.`)).toBeVisible();
    await expect(
      page
        .getByRole("table", { name: "Pending invitations" })
        .getByRole("rowheader", { name: invitee.email }),
    ).toBeVisible();
    await expectNoA11yViolations(page, "members (with pending invitation)");
  });

  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();

  await test.step("invitee accepts via the emailed link", async () => {
    const link = await waitForEmailLink(
      invitee.email,
      /http:\/\/localhost:3000\/accept-invitation\/[A-Za-z0-9_-]+/,
    );
    await inviteePage.goto(link);
    await expect(inviteePage.getByRole("heading", { level: 1 })).toHaveText(
      "You have been invited",
    );
    await expectNoA11yViolations(inviteePage, "accept invitation (signed out)");

    await inviteePage.getByRole("link", { name: "Create an account" }).click();
    await signUp(inviteePage, invitee);
    await expect(inviteePage).toHaveURL(/\/accept-invitation\//);
    await expect(inviteePage.getByText(orgName)).toBeVisible();
    await expectNoA11yViolations(inviteePage, "accept invitation (signed in)");

    await inviteePage.getByRole("button", { name: "Accept invitation" }).click();
    await expect(inviteePage).toHaveURL(/\/dashboard$/); // developers are not forced into 2FA
    await expect(inviteePage.getByRole("banner")).toContainText("Developer");
  });

  await test.step("developer role cannot manage members or see the audit log", async () => {
    await expect(inviteePage.getByRole("link", { name: "Audit log" })).toHaveCount(0);
    await inviteePage.goto("/audit-log");
    await expect(inviteePage.getByRole("alert")).toContainText("does not have access");
    await inviteePage.goto("/members");
    await expect(inviteePage.getByRole("button", { name: "Send invitation" })).toHaveCount(0);
    await expectNoA11yViolations(inviteePage, "members (read-only)");
  });

  await test.step("owner sees the new member and changes their role", async () => {
    await page.reload();
    const members = page.getByRole("table", { name: "Members of this organisation" });
    await expect(members.getByRole("row", { name: new RegExp(invitee.name) })).toContainText(
      "Developer",
    );
    await page.getByLabel(`Role for ${invitee.name}`).selectOption("auditor");
    await page.getByRole("button", { name: `Update role for ${invitee.name}` }).click();
    await expect(members.getByRole("row", { name: new RegExp(invitee.name) })).toContainText(
      "Auditor",
    );
    await expectNoA11yViolations(page, "members (managing)");
  });

  await test.step("sensitive actions are in the audit log", async () => {
    await page.getByRole("link", { name: "Audit log" }).click();
    const log = page.getByRole("table", { name: /Audit log entries/ });
    await expect(log.getByRole("row", { name: /Organisation created/ })).toContainText(owner.name);
    await expect(log.getByRole("row", { name: /Member invited/ })).toContainText(owner.name);
    await expect(log.getByRole("row", { name: /Invitation accepted/ })).toContainText(invitee.name);
    await expect(log.getByRole("row", { name: /Member role changed/ })).toContainText(
      "Role: Auditor",
    );
    await expect(log).not.toContainText(invitee.email); // no personal data in audit metadata
    await expectNoA11yViolations(page, "audit log");
  });

  await test.step("owner signs out and back in with password + authenticator code", async () => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.getByLabel("Email address", { exact: true }).fill(owner.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/two-factor/);
    await page.getByLabel("Verification code").fill(totp(totpSecret));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  await test.step("magic links are refused for accounts with two-step verification", async () => {
    const context = await browser.newContext();
    const anonymous = await context.newPage();
    await anonymous.goto("/sign-in");
    await anonymous.getByLabel("Email address for the sign-in link").fill(owner.email);
    await anonymous.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(anonymous.getByRole("status")).toContainText("we have sent a sign-in link");
    // The owner gets an explanatory email pointing at the sign-in page, not a sign-in token.
    await waitForEmailLink(owner.email, /http:\/\/localhost:3000\/sign-in\b/);
    const bodies = await emailTextsFor(owner.email);
    expect(bodies.join("\n")).not.toContain("magic-link/verify");
    await context.close();
  });

  await test.step("invitee signs back in with a magic link", async () => {
    await inviteePage.goto("/dashboard");
    await inviteePage.getByRole("button", { name: "Sign out" }).click();
    await expect(inviteePage).toHaveURL(/\/sign-in/);
    await inviteePage.getByLabel("Email address for the sign-in link").fill(invitee.email);
    await inviteePage.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(inviteePage.getByRole("status")).toContainText("we have sent a sign-in link");
    const link = await waitForEmailLink(
      invitee.email,
      /http:\/\/localhost:3000\/api\/auth\/magic-link\/verify\S+/,
    );
    await inviteePage.goto(link);
    await expect(inviteePage).toHaveURL(/\/dashboard$/);
    await expect(inviteePage.getByRole("banner")).toContainText(invitee.name);
  });

  await inviteeContext.close();
});
