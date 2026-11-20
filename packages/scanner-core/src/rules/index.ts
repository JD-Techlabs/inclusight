import { getCriterion, getRuleMapping } from "@app/compliance-data";
import type { Page } from "playwright";
import type { Impact } from "../criteria";
import type { AxeViolation } from "../normalise";
import { findMissingFocusIndicators } from "./focus-visible";
import { browserCall } from "./scripts";
import type { CustomFinding } from "./types";

export type { CustomFinding } from "./types";

/**
 * Inclusight custom rules (spec §7.4). Criteria and kind (violation / review) come from
 * compliance-data's rules.yaml; target size (2.5.8) is covered by axe's own target-size rule.
 */
export type CustomRule = {
  id: string;
  impact: Impact;
  help: string;
  description: string;
  run: (page: Page) => Promise<CustomFinding[]>;
};

function script(file: string, functionName: string): CustomRule["run"] {
  const expression = browserCall(file, functionName);
  return async (page) => (await page.evaluate(expression)) as CustomFinding[];
}

export const CUSTOM_RULES: readonly CustomRule[] = [
  {
    id: "cr-skip-link",
    impact: "moderate",
    help: "Pages with repeated navigation must start with a working skip link",
    description:
      "Checks that the first element reached with Tab is a link that skips to the main content, and that its target exists.",
    run: script("skip-link", "crSkipLink"),
  },
  {
    id: "cr-accessibility-statement",
    impact: "moderate",
    help: "No link to an accessibility statement was found",
    description:
      "Looks for a link to the accessibility statement (usually in the footer) on every page.",
    run: script("accessibility-statement", "crAccessibilityStatement"),
  },
  {
    id: "cr-lang-regional",
    impact: "serious",
    help: "Text in an Indian language must be marked with the matching lang attribute",
    description:
      "Finds Devanagari, Bengali, Tamil and other Indian-script text whose language attribute does not match, so screen readers would mispronounce it.",
    run: script("lang-regional", "crLangRegional"),
  },
  {
    id: "cr-captcha-alternative",
    impact: "serious",
    help: "CAPTCHA found without an audio or other alternative",
    description:
      "Flags home-grown CAPTCHAs that have no audio or other alternative nearby for a manual check.",
    run: script("captcha-alternative", "crCaptchaAlternative"),
  },
  {
    id: "cr-session-timeout",
    impact: "serious",
    help: "Session timeout detected: check users are warned and can extend it",
    description:
      "Flags scripts that appear to end sessions after inactivity, for a manual check of the warning and extend option.",
    run: script("session-timeout", "crSessionTimeout"),
  },
  {
    id: "cr-pdf-links",
    impact: "moderate",
    help: "Linked PDF documents need an accessibility check",
    description:
      "Lists linked PDFs so they can be checked for tags, structure and alternative text.",
    run: script("pdf-links", "crPdfLinks"),
  },
  {
    id: "cr-video-captions",
    impact: "serious",
    help: "Video or audio found: check captions, audio description and transcripts",
    description: "Flags video and audio players for a manual check of captions and alternatives.",
    run: script("video-captions", "crVideoCaptions"),
  },
  // Last: it moves keyboard focus and scrolls the page.
  {
    id: "cr-focus-visible",
    impact: "serious",
    help: "Focused elements must show a visible focus indicator",
    description:
      "Tabs through the first 20 focusable elements and compares screenshots with and without focus.",
    run: (page) => findMissingFocusIndicators(page),
  },
];

function helpUrlFor(ruleId: string): string {
  const first = getRuleMapping(ruleId)?.criteria[0];
  return (first && getCriterion(first)?.url) || "";
}

/**
 * Runs the custom rules on a loaded page and returns their findings in axe's result shape, so
 * they are normalised and fingerprinted exactly like axe violations. A rule that throws is
 * reported in `errors` and skipped, so one faulty rule cannot fail the page scan.
 */
export async function runCustomRules(
  page: Page,
  rules: readonly CustomRule[] = CUSTOM_RULES,
): Promise<{ violations: AxeViolation[]; errors: string[] }> {
  const violations: AxeViolation[] = [];
  const errors: string[] = [];
  for (const rule of rules) {
    let findings: CustomFinding[];
    try {
      findings = await rule.run(page);
    } catch {
      errors.push(rule.id);
      continue;
    }
    if (findings.length === 0) continue;
    violations.push({
      id: rule.id,
      impact: rule.impact,
      tags: ["inclusight-custom"],
      help: rule.help,
      description: rule.description,
      helpUrl: helpUrlFor(rule.id),
      nodes: findings.map((finding) => ({
        target: [finding.selector],
        ancestry: [finding.selector],
        html: finding.html,
        failureSummary: finding.failureSummary,
      })),
    });
  }
  return { violations, errors };
}
