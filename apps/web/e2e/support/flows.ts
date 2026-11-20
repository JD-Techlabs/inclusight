import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { totp } from "./totp";

export const PASSWORD = "correct-horse-battery-staple-1";

/** Signs up a new owner, creates an organisation and completes the mandatory 2FA setup. */
export async function createOwnerWithOrganisation(page: Page, orgName: string) {
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const owner = { name: "Nisha Nodal", email: `owner-${run}@example.test` };
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(owner.name);
  await page.getByLabel("Work email address").fill(owner.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Organisation name").fill(`${orgName} ${run}`);
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page).toHaveURL(/\/two-factor-setup$/);
  await page.getByLabel("Confirm your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Start setup" }).click();
  const secret = (await page.getByTestId("totp-secret").innerText()).trim();
  await page.getByLabel("6-digit code from your app").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on two-step verification" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { ...owner, secret };
}

/** The fixture site reads its state from files (see fixtures/README.md). */
const fixtureState = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "fixtures",
  ".state",
);

export function setFixtureState(name: "version.txt" | "well-known.txt", value: string) {
  mkdirSync(fixtureState, { recursive: true });
  writeFileSync(join(fixtureState, name), value);
}

export function resetFixtureState() {
  rmSync(fixtureState, { recursive: true, force: true });
}
