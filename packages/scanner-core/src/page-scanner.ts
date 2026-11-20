import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser } from "playwright";
import { boundingBoxesScript, PAGE_HEIGHT_SCRIPT, SKELETON_SCRIPT } from "./browser-scripts";
import { VIEWPORTS, type ViewportName } from "./config";
import type { AxeViolation } from "./normalise";
import { runCustomRules } from "./rules";
import type { SkeletonNode } from "./template";

/** axe tags from spec §7.4. Best-practice results are kept but reported separately. */
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const MAX_SCREENSHOT_HEIGHT = 8000;

export type BoundingBox = { x: number; y: number; width: number; height: number };

export type ViewportScan = {
  viewport: ViewportName;
  title: string;
  skeleton: SkeletonNode;
  violations: AxeViolation[];
  boxes: Record<string, BoundingBox | null>;
  screenshot: { body: Buffer; width: number; height: number } | null;
  /** Ids of custom rules that failed to run on this page (their findings are missing). */
  customRuleErrors: string[];
};

/** A load failure whose message is safe to show to the customer. */
export class PageLoadError extends Error {
  override name = "PageLoadError";
}

export type ScanPageOptions = {
  userAgent: string;
  viewport: ViewportName;
  waitSelector?: string | null;
  screenshot?: boolean;
  /** Run the Inclusight custom rules (spec §7.4) after axe and the screenshot. */
  customRules?: boolean;
  timeoutMs?: number;
  /** SSRF guard applied to every request the page makes (sub-resources included). */
  isHostAllowed?: (hostname: string) => Promise<boolean>;
};

export function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
}

/** Loads one URL in one viewport, runs axe and captures a screenshot. Read-only on the page. */
export async function scanPageInViewport(
  browser: Browser,
  url: string,
  options: ScanPageOptions,
): Promise<ViewportScan> {
  const size = VIEWPORTS[options.viewport];
  const mobile = options.viewport === "mobile";
  const context = await browser.newContext({
    viewport: size,
    userAgent: options.userAgent,
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1,
    acceptDownloads: false,
    serviceWorkers: "block",
  });

  try {
    const guard = options.isHostAllowed;
    if (guard) {
      await context.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
          return route.continue();
        }
        return (await guard(requestUrl.hostname))
          ? route.continue()
          : route.abort("blockedbyclient");
      });
    }

    const page = await context.newPage();
    const response = await page.goto(url, {
      waitUntil: "load",
      timeout: options.timeoutMs ?? 30_000,
    });
    if (!response) throw new PageLoadError("The page did not respond.");
    if (response.status() >= 400)
      throw new PageLoadError(`The page returned HTTP ${response.status()}.`);
    if (new URL(page.url()).host !== new URL(url).host) {
      throw new PageLoadError("The page redirected to a different site.");
    }
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    if (options.waitSelector) {
      await page.waitForSelector(options.waitSelector, { timeout: 10_000 }).catch(() => undefined);
    }

    const title = (await page.title()).slice(0, 500);
    const skeleton = (await page.evaluate(SKELETON_SCRIPT)) as SkeletonNode;
    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .options({ resultTypes: ["violations"], ancestry: true })
      .analyze();
    const violations = results.violations as unknown as AxeViolation[];

    const selectors = new Set<string>();
    for (const violation of violations) {
      for (const node of violation.nodes) {
        const target = node.target as unknown[];
        if (target.length === 1 && typeof target[0] === "string") selectors.add(target[0]);
      }
    }
    const boxes = (await page.evaluate(boundingBoxesScript([...selectors]))) as Record<
      string,
      BoundingBox | null
    >;

    let screenshot: ViewportScan["screenshot"] = null;
    if (options.screenshot !== false) {
      const pageHeight = Number(await page.evaluate(PAGE_HEIGHT_SCRIPT)) || size.height;
      const height = Math.min(Math.max(pageHeight, size.height), MAX_SCREENSHOT_HEIGHT);
      const body = await page.screenshot({
        type: "jpeg",
        quality: 70,
        fullPage: true,
        clip: { x: 0, y: 0, width: size.width, height },
        animations: "disabled",
        caret: "hide",
      });
      screenshot = { body, width: size.width, height };
    }

    // Custom rules run last: the focus check moves keyboard focus and scrolls the page.
    let customRuleErrors: string[] = [];
    if (options.customRules) {
      const custom = await runCustomRules(page);
      customRuleErrors = custom.errors;
      const customSelectors = custom.violations.flatMap((v) =>
        v.nodes.map((n) => (n.target as string[])[0]!),
      );
      Object.assign(boxes, await page.evaluate(boundingBoxesScript(customSelectors)));
      violations.push(...custom.violations);
    }

    return {
      viewport: options.viewport,
      title,
      skeleton,
      violations,
      boxes,
      screenshot,
      customRuleErrors,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
