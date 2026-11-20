import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Waits until entrance animations and colour transitions have finished, so axe measures the
 * final colours (a half-faded element would report false contrast failures). Endless
 * animations, such as a progress spinner, are not waited for.
 */
export async function settleAnimations(page: Page) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await waitForAnimations(page);
    } catch (error) {
      // The dev server can reload the page while it compiles; wait for the new page once.
      if (attempt > 1 || !String(error).includes("Execution context was destroyed")) throw error;
      await page.waitForLoadState("load");
    }
  }
}

async function waitForAnimations(page: Page) {
  await page.evaluate(async () => {
    const frames = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // Content that renders late (streaming, a refresh) starts new animations: re-check until
    // nothing finite is still running.
    for (let round = 0; round < 10; round++) {
      await frames();
      // Skip endless animations and ones on content that is not rendered (for example inside
      // a closed <details>): Chrome does not advance those, so they never finish.
      const running = document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return (
          animation.playState === "running" &&
          animation.effect?.getTiming().iterations !== Infinity &&
          (!(target instanceof Element) || target.checkVisibility())
        );
      });
      if (running.length === 0) return;
      await Promise.race([
        Promise.all(running.map((animation) => animation.finished.catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }
  });
}

/**
 * Runs axe on the current page in the light and the dark theme (the person's system setting,
 * as no theme cookie is set in tests). Fails on any serious or critical violation (the CI gate
 * in CLAUDE.md); we hold ourselves to zero violations of any impact for WCAG A/AA rules.
 */
export async function expectNoA11yViolations(page: Page, screen: string) {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await settleAnimations(page);
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
    expect(summary, `axe violations on ${screen} (${colorScheme} theme)`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: "light" });
}

/** WCAG 1.4.10 Reflow: at 320–390 CSS px wide nothing may force horizontal page scrolling. */
export async function expectNoHorizontalScroll(page: Page, screen: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `horizontal scrolling on ${screen}`).toBeLessThanOrEqual(clientWidth);
}

/** After moving to a new page, the next Tab must land on the visible skip link. */
export async function expectNextTabIsSkipLink(page: Page) {
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
}
