import type { Impact } from "./criteria";

/** Weight of one distinct issue by impact. See docs/DECISIONS.md (scoring). */
export const IMPACT_WEIGHTS: Record<Impact, number> = {
  critical: 10,
  serious: 6,
  moderate: 3,
  minor: 1,
};

/** Penalty points that take the score from 100 to ~37 (1/e). */
export const SCORE_SCALE = 100;

export type ScoredIssue = { impact: Impact; occurrences: number };

/**
 * Accessibility score 0–100 for one scan, weighted by impact and occurrence count:
 * penalty = Σ weight(impact) × (1 + log10(occurrences)), score = 100 × e^(−penalty / 100).
 * The log keeps one template-wide issue from outweighing many distinct problems. Only
 * WCAG violations that are not false positives are passed in. Automated checks find only
 * part of all issues, so a score of 100 never means "accessible".
 */
export function accessibilityScore(issues: readonly ScoredIssue[]): number {
  let penalty = 0;
  for (const issue of issues) {
    const occurrences = Math.max(1, issue.occurrences);
    penalty += IMPACT_WEIGHTS[issue.impact] * (1 + Math.log10(occurrences));
  }
  return Math.round(100 * Math.exp(-penalty / SCORE_SCALE));
}
