import { z } from "zod";

/** Zod schemas for the raw YAML data (compiled to generated/catalogue.json). */

export const AUTOMATABLE = ["full", "partial", "none"] as const;
export const RULE_KINDS = ["violation", "best_practice", "review", "aaa"] as const;
export const REVIEW_PENDING = "pending_expert_review";

const text = z.string().trim().min(1);
const criterionId = z.string().regex(/^\d\.\d\.\d{1,2}$/, "WCAG criterion ids look like 1.4.10");

export const standardSchema = z.object({
  id: text,
  name: text,
  shortName: text,
  source: z.enum(["wcag", "gigw3", "is17802"]),
  versions: z.array(text).optional(),
  levels: z.array(z.enum(["A", "AA"])).optional(),
  excludeObsoleteIn: text.optional(),
  default: z.boolean().optional(),
});

const wcagCriterionSchema = z.object({
  id: criterionId,
  title: text,
  level: z.enum(["A", "AA"]),
  version: z.enum(["2.0", "2.1", "2.2"]),
  obsoleteIn: text.optional(),
  automatable: z.enum(AUTOMATABLE),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  summary: text,
  affects: z.array(text),
});

export const wcagSourceSchema = z.object({
  standard: z.literal("wcag"),
  title: text,
  understandingUrl: z.string().url().includes("{slug}"),
  principles: z.record(z.string(), text),
  guidelines: z.record(z.string(), text),
  criteria: z.array(wcagCriterionSchema),
});

const requirementSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+-[a-z0-9-]+$/),
  clause: text,
  title: text,
  summary: text,
  relatedStandard: text.optional(),
  relatedCriteria: z.array(criterionId).default([]),
  relatedRules: z.array(text).default([]),
  automatable: z.enum(AUTOMATABLE),
  steps: z.array(text).min(1),
});

export const requirementSourceSchema = z.object({
  standard: z.enum(["gigw3", "is17802"]),
  title: text,
  review: z.literal(REVIEW_PENDING),
  reviewNote: text,
  requirements: z.array(requirementSchema).min(1),
});

const ruleEntrySchema = z.object({
  kind: z.enum(RULE_KINDS),
  criteria: z.array(z.string()),
});

export const checklistSchema = z.object({
  tools: z.array(text),
  steps: z.array(text).min(1),
});

export const REPORT_TYPE_IDS = [
  "platform_inventory",
  "audit_summary",
  "remediation_tracker",
  "sebi_annual",
  "accessibility_statement",
] as const;

const reportTypeSchema = z.object({
  type: z.enum(REPORT_TYPE_IDS),
  folder: z.string().regex(/^[a-z0-9-]+$/),
  title: text,
  summary: text,
  formats: z.array(z.enum(["pdf", "xlsx", "html", "md"])).min(1),
  needs: z
    .array(z.enum(["audit", "financial_year", "signatories", "property", "contact"]))
    .default([]),
  formatNote: text.optional(),
});

export const catalogueSchema = z.object({
  standards: z.array(standardSchema).min(1),
  sources: z.object({
    wcag: wcagSourceSchema,
    gigw3: requirementSourceSchema,
    is17802: requirementSourceSchema,
  }),
  rules: z.object({
    axe: z.record(z.string(), ruleEntrySchema),
    custom: z.record(z.string(), ruleEntrySchema),
  }),
  checklists: z.record(criterionId, checklistSchema),
  reportTypes: z.array(reportTypeSchema).min(1),
});

export type ReportTypeId = (typeof REPORT_TYPE_IDS)[number];
export type ReportTypeInfo = z.infer<typeof reportTypeSchema>;

export type RawCatalogue = z.infer<typeof catalogueSchema>;
export type Automatable = (typeof AUTOMATABLE)[number];
export type RuleKind = (typeof RULE_KINDS)[number];
