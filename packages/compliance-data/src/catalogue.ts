import raw from "../generated/catalogue.json";
import {
  catalogueSchema,
  REVIEW_PENDING,
  type Automatable,
  type ReportTypeInfo,
  type RuleKind,
} from "./schema";

/**
 * Typed, indexed view of the compliance data files (criteria, standards, rule mapping,
 * checklists). Validated once at load: a malformed data file fails fast at startup.
 */

export type StandardSource = "wcag" | "gigw3" | "is17802";

export type Checklist = { tools: string[]; steps: string[] };

export type Criterion = {
  id: string;
  source: StandardSource;
  title: string;
  /** "1.4.3 Contrast (Minimum)" for WCAG; the title for GIGW / IS 17802 requirements. */
  label: string;
  summary: string;
  automatable: Automatable;
  affects: string[];
  level: "A" | "AA" | null;
  version: string | null;
  obsoleteIn: string | null;
  principle: string | null;
  guideline: string | null;
  url: string | null;
  clause: string | null;
  /** GIGW and IS 17802 placeholders must be shown as "Pending expert review". */
  pendingReview: boolean;
  relatedStandard: string | null;
  relatedCriteria: string[];
  relatedRules: string[];
  checklist: Checklist | null;
};

export type Standard = {
  id: string;
  name: string;
  shortName: string;
  source: StandardSource;
  isDefault: boolean;
  pendingReview: boolean;
  reviewNote: string | null;
  /** Criterion / requirement ids in display order. */
  criteria: string[];
};

export type RuleMapping = {
  id: string;
  source: "axe" | "custom";
  kind: RuleKind;
  criteria: string[];
};

/** Numeric ordering for WCAG ids ("1.4.3" before "1.4.10"). */
export function compareCriterionIds(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function build() {
  const data = catalogueSchema.parse(raw);
  const criteria = new Map<string, Criterion>();
  const wcag = data.sources.wcag;

  for (const c of [...wcag.criteria].sort((a, b) => compareCriterionIds(a.id, b.id))) {
    const [p, g] = c.id.split(".");
    criteria.set(c.id, {
      id: c.id,
      source: "wcag",
      title: c.title,
      label: `${c.id} ${c.title}`,
      summary: c.summary,
      automatable: c.automatable,
      affects: c.affects,
      level: c.level,
      version: c.version,
      obsoleteIn: c.obsoleteIn ?? null,
      principle: wcag.principles[p!] ?? null,
      guideline: wcag.guidelines[`${p}.${g}`] ?? null,
      url: wcag.understandingUrl.replace("{slug}", c.slug),
      clause: null,
      pendingReview: false,
      relatedStandard: null,
      relatedCriteria: [],
      relatedRules: [],
      checklist: data.checklists[c.id] ?? null,
    });
  }

  const reviewNotes = new Map<StandardSource, string>();
  for (const source of [data.sources.gigw3, data.sources.is17802]) {
    reviewNotes.set(source.standard, source.reviewNote);
    for (const r of source.requirements) {
      criteria.set(r.id, {
        id: r.id,
        source: source.standard,
        title: r.title,
        label: r.title,
        summary: r.summary,
        automatable: r.automatable,
        affects: [],
        level: null,
        version: null,
        obsoleteIn: null,
        principle: null,
        guideline: null,
        url: null,
        clause: r.clause,
        pendingReview: source.review === REVIEW_PENDING,
        relatedStandard: r.relatedStandard ?? null,
        relatedCriteria: r.relatedCriteria,
        relatedRules: r.relatedRules,
        checklist: { tools: [], steps: r.steps },
      });
    }
  }

  const standards: Standard[] = data.standards.map((s) => {
    const members = [...criteria.values()].filter((c) => {
      if (c.source !== s.source) return false;
      if (s.source !== "wcag") return true;
      if (s.versions && !s.versions.includes(c.version!)) return false;
      if (s.levels && !s.levels.includes(c.level!)) return false;
      return !(s.excludeObsoleteIn && c.obsoleteIn === s.excludeObsoleteIn);
    });
    return {
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      source: s.source,
      isDefault: s.default === true,
      pendingReview: reviewNotes.has(s.source),
      reviewNote: reviewNotes.get(s.source) ?? null,
      criteria: members.map((c) => c.id),
    };
  });

  const rules = new Map<string, RuleMapping>();
  for (const source of ["axe", "custom"] as const) {
    for (const [id, entry] of Object.entries(data.rules[source])) {
      rules.set(id, { id, source, kind: entry.kind, criteria: entry.criteria });
    }
  }
  return { criteria, standards, rules, reportTypes: data.reportTypes };
}

const catalogue = build();

export function listStandards(): Standard[] {
  return catalogue.standards;
}

export function getStandard(id: string): Standard | null {
  return catalogue.standards.find((s) => s.id === id) ?? null;
}

export const DEFAULT_STANDARD_ID = (catalogue.standards.find((s) => s.isDefault) ??
  catalogue.standards[0]!)!.id;

export function getCriterion(id: string): Criterion | null {
  return catalogue.criteria.get(id) ?? null;
}

export function listCriteria(): Criterion[] {
  return [...catalogue.criteria.values()];
}

export function criteriaForStandard(standardId: string): Criterion[] {
  return (getStandard(standardId)?.criteria ?? []).map((id) => catalogue.criteria.get(id)!);
}

/** "1.4.3 Contrast (Minimum)", or the id itself when unknown. */
export function criterionLabel(id: string): string {
  return catalogue.criteria.get(id)?.label ?? id;
}

export function getRuleMapping(ruleId: string): RuleMapping | null {
  return catalogue.rules.get(ruleId) ?? null;
}

export function listRuleMappings(): RuleMapping[] {
  return [...catalogue.rules.values()];
}

/** Rules that provide evidence for a criterion or requirement (excluding Level AAA rules). */
export function rulesForCriterion(criterionId: string): RuleMapping[] {
  const criterion = catalogue.criteria.get(criterionId);
  const related = new Set(criterion?.relatedRules ?? []);
  return listRuleMappings().filter(
    (rule) => rule.kind !== "aaa" && (rule.criteria.includes(criterionId) || related.has(rule.id)),
  );
}

/** Report types and their output formats (report-templates/reports.yaml). */
export function listReportTypes(): ReportTypeInfo[] {
  return catalogue.reportTypes;
}

export function getReportType(type: string): ReportTypeInfo | null {
  return catalogue.reportTypes.find((r) => r.type === type) ?? null;
}
