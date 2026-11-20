import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normaliseViolations } from "../normalise";
import { launchBrowser } from "../page-scanner";
import { CUSTOM_RULES, runCustomRules } from "./index";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await launchBrowser();
  page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
}, 60_000);
afterAll(() => browser?.close());

const NAV = `<header><nav><a href="/a">A</a> <a href="/b">B</a> <a href="/c">C</a></nav></header>`;

async function findings(ruleId: string, body: string, lang = "en") {
  await page.setContent(
    `<!doctype html><html lang="${lang}"><head><title>t</title></head><body>${body}</body></html>`,
  );
  const rule = CUSTOM_RULES.find((r) => r.id === ruleId)!;
  return rule.run(page);
}

describe("cr-skip-link", () => {
  it("passes with a working skip link first", async () => {
    expect(
      await findings("cr-skip-link", `<a href="#main">Skip</a>${NAV}<main id="main">x</main>`),
    ).toEqual([]);
  });
  it("passes visually hidden skip links and pages without repeated navigation", async () => {
    const hidden = `<a href="#m" style="position:absolute;left:-9999px">Skip</a>${NAV}<main id="m"></main>`;
    expect(await findings("cr-skip-link", hidden)).toEqual([]);
    expect(await findings("cr-skip-link", `<main><a href="/x">x</a></main>`)).toEqual([]);
  });
  it("fails when the first focusable element is not a skip link", async () => {
    const [finding] = await findings("cr-skip-link", `${NAV}<main>x</main>`);
    expect(finding?.selector).toBe("html > body > header > nav > a:nth-child(1)");
    expect(finding?.failureSummary).toMatch(/not a skip link/);
  });
  it("fails when the skip link target does not exist", async () => {
    const [finding] = await findings(
      "cr-skip-link",
      `<a href="#nowhere">Skip</a>${NAV}<main>x</main>`,
    );
    expect(finding?.failureSummary).toMatch(/#nowhere/);
  });
});

describe("cr-accessibility-statement", () => {
  it("finds English and Hindi statement links", async () => {
    expect(
      await findings(
        "cr-accessibility-statement",
        `<footer><a href="/a11y">Accessibility statement</a></footer>`,
      ),
    ).toEqual([]);
    expect(
      await findings(
        "cr-accessibility-statement",
        `<footer><a href="/s">सुगम्यता विवरण</a></footer>`,
      ),
    ).toEqual([]);
  });
  it("reports the footer when there is no statement link", async () => {
    const [finding] = await findings(
      "cr-accessibility-statement",
      `<main></main><footer><a href="/t">Terms</a></footer>`,
    );
    expect(finding?.selector).toBe("html > body > footer");
  });
});

describe("cr-lang-regional", () => {
  it("flags Indian-script text without a matching lang attribute", async () => {
    const result = await findings(
      "cr-lang-regional",
      `<p>नमस्ते, आपका स्वागत है</p><p lang="hi">नमस्ते</p><a href="/ta">தமிழ்</a><p lang="hi-IN">हिंदी</p>`,
    );
    expect(result.map((f) => f.selector)).toEqual([
      "html > body > p:nth-child(1)",
      "html > body > a",
    ]);
    expect(result[1]?.failureSummary).toMatch(/Tamil.*lang="ta"/);
  });
  it("accepts a Hindi page", async () => {
    expect(await findings("cr-lang-regional", `<p>नमस्ते</p>`, "hi")).toEqual([]);
  });
});

describe("cr-captcha-alternative", () => {
  it("flags an image CAPTCHA without an audio alternative", async () => {
    const result = await findings(
      "cr-captcha-alternative",
      `<form><img src="/captcha.png" alt="captcha"><input name="captcha" aria-label="Code"></form>`,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.html).toMatch(/<img/);
  });
  it("accepts CAPTCHAs with an audio option and third-party widgets", async () => {
    const audio = `<form><img src="/captcha.png" alt="captcha"><button type="button">Play audio code</button></form>`;
    expect(await findings("cr-captcha-alternative", audio)).toEqual([]);
    expect(
      await findings(
        "cr-captcha-alternative",
        `<div class="g-recaptcha"><input id="captcha-x"></div>`,
      ),
    ).toEqual([]);
  });
});

describe("cr-session-timeout, cr-pdf-links, cr-video-captions", () => {
  it("flags session timeout scripts but not analytics", async () => {
    expect(
      await findings("cr-session-timeout", `<script>var sessionTimeout = 900000;</script>`),
    ).toHaveLength(1);
    expect(await findings("cr-session-timeout", `<script>var cart = 1;</script>`)).toEqual([]);
  });
  it("lists each linked PDF once", async () => {
    const result = await findings(
      "cr-pdf-links",
      `<a href="/docs/annual.pdf">Annual</a><a href="/docs/annual.pdf#p2">Again</a><a href="/f" type="application/pdf">Form</a><a href="/x.html">x</a>`,
    );
    expect(result.map((f) => f.failureSummary.split(" ")[2])).toEqual([
      expect.stringMatching(/annual\.pdf\.$/),
      expect.stringMatching(/\/f\.$/),
    ]);
  });
  it("flags videos and embedded players", async () => {
    const result = await findings(
      "cr-video-captions",
      `<video src="/v.mp4"></video><iframe title="Results call" src="https://www.youtube-nocookie.com/embed/x"></iframe><iframe title="Map" src="about:blank"></iframe>`,
    );
    expect(result).toHaveLength(2);
  });
});

describe("cr-focus-visible", () => {
  it("flags elements whose appearance does not change on focus", async () => {
    const result = await findings(
      "cr-focus-visible",
      `<style>.bare:focus{outline:none}</style><button>Visible ring</button><button class="bare">No ring</button>`,
    );
    expect(result.map((f) => f.html)).toEqual(['<button class="bare">No ring</button>']);
  });
});

describe("runCustomRules", () => {
  it("returns findings in axe's shape, classified by the compliance mapping", async () => {
    await page.setContent(
      `<!doctype html><html lang="en"><head><title>t</title></head><body>${NAV}<main><a href="/r.pdf">Report</a></main></body></html>`,
    );
    const { violations, errors } = await runCustomRules(page);
    expect(errors).toEqual([]);
    const ids = violations.map((v) => v.id);
    expect(ids).toEqual(
      expect.arrayContaining(["cr-skip-link", "cr-pdf-links", "cr-accessibility-statement"]),
    );
    const issues = normaliseViolations(violations, "tpl");
    const skip = issues.find((i) => i.ruleId === "cr-skip-link")!;
    expect(skip).toMatchObject({ criteria: ["2.4.1"], isBestPractice: false, needsReview: false });
    expect(skip.helpUrl).toMatch(/bypass-blocks/);
    const pdf = issues.find((i) => i.ruleId === "cr-pdf-links")!;
    expect(pdf).toMatchObject({ isBestPractice: true, needsReview: true, criteria: [] });
  });

  it("skips a rule that throws instead of failing the scan", async () => {
    const broken = { ...CUSTOM_RULES[0]!, run: () => Promise.reject(new Error("boom")) };
    expect(await runCustomRules(page, [broken])).toEqual({ violations: [], errors: [broken.id] });
  });
});
