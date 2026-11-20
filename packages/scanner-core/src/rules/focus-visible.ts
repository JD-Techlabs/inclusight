import type { Page } from "playwright";
import { browserCall } from "./scripts";
import type { CustomFinding } from "./types";

const FOCUSED_ELEMENT = browserCall("focused-element", "a11yFocusedElement");
const BLUR = `(() => { const el = document.activeElement; if (el && el.blur) el.blur(); })()`;
const PADDING = 8;

type Focused = {
  selector: string;
  html: string;
  rect: { x: number; y: number; width: number; height: number };
  scroll: { x: number; y: number };
};

type Clip = { x: number; y: number; width: number; height: number };

/** The element's area plus room for an outline, clamped to the viewport. */
function clipFor(rect: Focused["rect"], viewport: { width: number; height: number }): Clip | null {
  const x = Math.max(0, Math.floor(rect.x - PADDING));
  const y = Math.max(0, Math.floor(rect.y - PADDING));
  const right = Math.min(viewport.width, Math.ceil(rect.x + rect.width + PADDING));
  const bottom = Math.min(viewport.height, Math.ceil(rect.y + rect.height + PADDING));
  if (right - x < 2 || bottom - y < 2) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * cr-focus-visible (WCAG 2.4.7): presses Tab through the first focusable elements, takes a
 * screenshot of each element while focused, then again after focus is removed (same scroll
 * position). Pixel-identical images mean focus made no visible difference. Conservative:
 * anything that changes on focus (outline, colour, caret, animation) counts as visible.
 */
export async function findMissingFocusIndicators(page: Page, maxStops = 20) {
  const viewport = page.viewportSize() ?? { width: 1366, height: 768 };
  const stops: Array<{ focused: Focused; clip: Clip; image: Buffer }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press("Tab");
    const focused = (await page.evaluate(FOCUSED_ELEMENT)) as Focused | null;
    if (!focused || seen.has(focused.selector)) break; // left the page or wrapped around
    seen.add(focused.selector);
    const clip = clipFor(focused.rect, viewport);
    if (!clip) continue;
    const image = await page.screenshot({ clip, animations: "disabled", caret: "hide" });
    stops.push({ focused, clip, image });
  }

  await page.evaluate(BLUR);
  const findings: CustomFinding[] = [];
  for (const stop of stops) {
    await page.evaluate(`window.scrollTo(${stop.focused.scroll.x}, ${stop.focused.scroll.y})`);
    const unfocused = await page.screenshot({
      clip: stop.clip,
      animations: "disabled",
      caret: "hide",
    });
    if (!unfocused.equals(stop.image)) continue;
    findings.push({
      selector: stop.focused.selector,
      html: stop.focused.html,
      failureSummary:
        "Nothing on screen changed when this element received keyboard focus, so keyboard users cannot see where they are.",
    });
  }
  return findings;
}
