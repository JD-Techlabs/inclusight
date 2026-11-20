import { getRuleMapping, type RuleKind } from "@app/compliance-data";
import { criteriaFromTags, isBestPracticeRule, toImpact, type Impact } from "./criteria";
import { issueFingerprint } from "./fingerprint";
import { normaliseSelector, targetToSelector } from "./selector";

const MAX_HTML_SNIPPET = 2000;
const MAX_FAILURE_SUMMARY = 2000;

/** The subset of an axe result we rely on (keeps us decoupled from axe's full types). */
export type AxeViolation = {
  id: string;
  impact?: string | null;
  tags: string[];
  help: string;
  description: string;
  helpUrl: string;
  nodes: Array<{
    target: unknown;
    /** Full CSS path from <html> (axe `ancestry` option); preferred for fingerprinting. */
    ancestry?: unknown;
    html: string;
    failureSummary?: string;
    impact?: string | null;
  }>;
};

export type NormalisedNode = {
  selector: string;
  html: string;
  failureSummary: string;
};

export type NormalisedIssue = {
  fingerprint: string;
  ruleId: string;
  impact: Impact;
  criteria: string[];
  /** Not a confirmed WCAG violation (best practice or needs review): not scored. */
  isBestPractice: boolean;
  /** A finding a person must check (rule kind "review"). */
  needsReview: boolean;
  help: string;
  description: string;
  helpUrl: string;
  normalisedSelector: string;
  nodes: NormalisedNode[];
};

/**
 * Criteria and kind come from compliance-data (rules.yaml). Rules missing from the mapping fall
 * back to axe's own WCAG tags, so a new axe rule is still reported.
 */
export function classifyRule(violation: Pick<AxeViolation, "id" | "tags">): {
  criteria: string[];
  kind: RuleKind;
} {
  const mapping = getRuleMapping(violation.id);
  if (mapping && mapping.kind !== "aaa")
    return { criteria: [...mapping.criteria], kind: mapping.kind };
  return {
    criteria: criteriaFromTags(violation.tags),
    kind: isBestPracticeRule(violation.tags) ? "best_practice" : "violation",
  };
}

/**
 * Turns axe violations from one page into fingerprinted issues. Nodes whose ancestry paths
 * normalise to the same value (e.g. every image in a repeated list) group into one issue.
 */
export function normaliseViolations(
  violations: readonly AxeViolation[],
  templateHash: string,
): NormalisedIssue[] {
  const byFingerprint = new Map<string, NormalisedIssue>();

  for (const violation of violations) {
    const { criteria, kind } = classifyRule(violation);
    const isBestPractice = kind !== "violation";
    const needsReview = kind === "review";

    for (const node of violation.nodes) {
      const selector = targetToSelector(node.target);
      // axe's shortest selector often relies on attribute values (img[src$="logo.svg"]), which
      // normalisation removes; the full ancestry path keeps elements in different places apart.
      const normalisedSelector = normaliseSelector(
        node.ancestry ? targetToSelector(node.ancestry) : selector,
      );
      const fingerprint = issueFingerprint(violation.id, normalisedSelector, templateHash);

      let issue = byFingerprint.get(fingerprint);
      if (!issue) {
        issue = {
          fingerprint,
          ruleId: violation.id,
          impact: toImpact(node.impact ?? violation.impact),
          criteria,
          isBestPractice,
          needsReview,
          help: violation.help,
          description: violation.description,
          helpUrl: violation.helpUrl,
          normalisedSelector,
          nodes: [],
        };
        byFingerprint.set(fingerprint, issue);
      }
      if (!issue.nodes.some((existing) => existing.selector === selector)) {
        issue.nodes.push({
          selector,
          html: node.html.slice(0, MAX_HTML_SNIPPET),
          failureSummary: (node.failureSummary ?? "").slice(0, MAX_FAILURE_SUMMARY),
        });
      }
    }
  }
  return [...byFingerprint.values()];
}
