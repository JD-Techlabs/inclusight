export const IMPACTS = ["critical", "serious", "moderate", "minor"] as const;
export type Impact = (typeof IMPACTS)[number];

/** axe tags such as "wcag111" or "wcag1410" → WCAG success criterion numbers ("1.1.1", "1.4.10"). */
export function criteriaFromTags(tags: readonly string[]): string[] {
  const criteria = new Set<string>();
  for (const tag of tags) {
    const match = /^wcag(\d)(\d)(\d{1,2})$/.exec(tag);
    if (match) criteria.add(`${match[1]}.${match[2]}.${match[3]}`);
  }
  return [...criteria].sort(compareCriteria);
}

export function compareCriteria(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Best-practice rules carry no WCAG tag; they are reported separately and not scored (spec §7.4). */
export function isBestPracticeRule(tags: readonly string[]): boolean {
  return !tags.some((tag) => /^wcag\d/.test(tag));
}

export function toImpact(value: unknown): Impact {
  return IMPACTS.includes(value as Impact) ? (value as Impact) : "minor";
}

export function impactRank(impact: string): number {
  const index = IMPACTS.indexOf(impact as Impact);
  return index === -1 ? IMPACTS.length : index;
}
