import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";

/**
 * Web scanning tables (spec §6). Every table carries org_id; all access goes through
 * orgScope(). Enumerated values are text validated in code (see domain.ts).
 */

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const orgId = () =>
  text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

export type ScreenshotRef = { key: string; width: number; height: number };
export type OccurrenceBox = { x: number; y: number; width: number; height: number };

export const properties = pgTable(
  "properties",
  {
    id: id(),
    orgId: orgId(),
    type: text("type").notNull().default("web"),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    isInvestorFacing: boolean("is_investor_facing").notNull().default(true),
    verified: boolean("verified").notNull().default(false),
    verificationMethod: text("verification_method"),
    verificationToken: text("verification_token").notNull(),
    verifiedAt: timestamptz("verified_at"),
    /** Member responsible for the platform (platform inventory report). */
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    scanConfig: jsonb("scan_config").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("properties_org_base_url_uidx").on(t.orgId, t.baseUrl)],
);

export const scans = pgTable(
  "scans",
  {
    id: id(),
    orgId: orgId(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull().default("manual"),
    /** full = crawl the verified site; single_page = only the base URL (unverified properties). */
    mode: text("mode").notNull().default("full"),
    status: text("status").notNull().default("queued"),
    startedAt: timestamptz("started_at"),
    finishedAt: timestamptz("finished_at"),
    pagesFound: integer("pages_found").notNull().default(0),
    pagesScanned: integer("pages_scanned").notNull().default(0),
    pagesFailed: integer("pages_failed").notNull().default(0),
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    error: text("error"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("scans_property_created_idx").on(t.propertyId, t.createdAt),
    index("scans_org_created_idx").on(t.orgId, t.createdAt),
  ],
);

export const pages = pgTable(
  "pages",
  {
    id: id(),
    orgId: orgId(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    templateHash: text("template_hash"),
    lastScannedAt: timestamptz("last_scanned_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pages_property_url_uidx").on(t.propertyId, t.url)],
);

/** One row per page per scan: drives progress, retries and "was this page re-checked?". */
export const scanPages = pgTable(
  "scan_pages",
  {
    id: id(),
    orgId: orgId(),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    screenshots: jsonb("screenshots").$type<Partial<Record<string, ScreenshotRef>>>(),
    violationCount: integer("violation_count").notNull().default(0),
    finishedAt: timestamptz("finished_at"),
  },
  (t) => [
    uniqueIndex("scan_pages_scan_page_uidx").on(t.scanId, t.pageId),
    index("scan_pages_scan_status_idx").on(t.scanId, t.status),
  ],
);

export const issues = pgTable(
  "issues",
  {
    id: id(),
    orgId: orgId(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    ruleId: text("rule_id").notNull(),
    source: text("source").notNull().default("axe"),
    impact: text("impact").notNull(),
    criteria: text("criteria").array().notNull().default([]),
    /** Not a confirmed WCAG violation: excluded from scores and violation counts. */
    isBestPractice: boolean("is_best_practice").notNull().default(false),
    /** A finding a person must check (custom rules of kind "review"); also isBestPractice. */
    needsReview: boolean("needs_review").notNull().default(false),
    helpText: text("help_text").notNull(),
    description: text("description").notNull().default(""),
    helpUrl: text("help_url"),
    normalisedSelector: text("normalised_selector").notNull(),
    templateHash: text("template_hash").notNull(),
    status: text("status").notNull().default("open"),
    statusReason: text("status_reason"),
    /** Remediation target date (remediation tracker report). */
    targetDate: date("target_date"),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    firstSeenScanId: text("first_seen_scan_id").references(() => scans.id, {
      onDelete: "set null",
    }),
    lastSeenScanId: text("last_seen_scan_id").references(() => scans.id, { onDelete: "set null" }),
    fixedInScanId: text("fixed_in_scan_id").references(() => scans.id, { onDelete: "set null" }),
    reopenedInScanId: text("reopened_in_scan_id").references(() => scans.id, {
      onDelete: "set null",
    }),
    /** Occurrences and distinct pages in the last scan that saw this issue. */
    occurrenceCount: integer("occurrence_count").notNull().default(0),
    pageCount: integer("page_count").notNull().default(0),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("issues_property_fingerprint_uidx").on(t.propertyId, t.fingerprint),
    index("issues_property_status_idx").on(t.propertyId, t.status),
  ],
);

export const issueOccurrences = pgTable(
  "issue_occurrences",
  {
    id: id(),
    orgId: orgId(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    viewport: text("viewport").notNull(),
    selector: text("selector").notNull(),
    htmlSnippet: text("html_snippet").notNull().default(""),
    failureSummary: text("failure_summary").notNull().default(""),
    screenshotKey: text("screenshot_key"),
    bbox: jsonb("bbox").$type<OccurrenceBox>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("issue_occurrences_dedupe_uidx").on(
      t.issueId,
      t.scanId,
      t.pageId,
      t.viewport,
      t.selector,
    ),
    index("issue_occurrences_scan_idx").on(t.scanId),
    index("issue_occurrences_page_idx").on(t.pageId, t.scanId),
  ],
);
