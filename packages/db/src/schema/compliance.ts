import {
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
import { properties } from "./scanning";

/**
 * Compliance workspace and report tables (spec §6, §8, §9). Every table carries org_id; all
 * access goes through orgScope(). Enumerated values are text validated in code.
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
const userRef = (name: string) => text(name).references(() => users.id, { onDelete: "set null" });

/** The latest manual result per property and criterion; history lives in the audit log. */
export const manualTests = pgTable(
  "manual_tests",
  {
    id: id(),
    orgId: orgId(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    criterionId: text("criterion_id").notNull(),
    result: text("result").notNull().default("not_tested"),
    notes: text("notes").notNull().default(""),
    testerId: userRef("tester_id"),
    testedAt: timestamptz("tested_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("manual_tests_property_criterion_uidx").on(t.propertyId, t.criterionId)],
);

/** Files supporting a finding or test (screenshots, recordings, notes). Stored in S3. */
export const evidence = pgTable(
  "evidence",
  {
    id: id(),
    orgId: orgId(),
    linkedType: text("linked_type").notNull(),
    linkedId: text("linked_id").notNull(),
    propertyId: text("property_id").references(() => properties.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    description: text("description").notNull().default(""),
    uploadedBy: userRef("uploaded_by"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("evidence_link_idx").on(t.orgId, t.linkedType, t.linkedId)],
);

export type AuditSnapshotJson = Record<string, unknown>;

/** An accessibility audit by an (IAAP-certified) auditor; its findings are locked at close. */
export const audits = pgTable(
  "audits",
  {
    id: id(),
    orgId: orgId(),
    title: text("title").notNull(),
    auditorName: text("auditor_name").notNull(),
    iaapCertId: text("iaap_cert_id").notNull(),
    auditorOrg: text("auditor_org").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    /** Scope: ids of properties in this organisation. */
    propertyIds: text("property_ids").array().notNull().default([]),
    standardId: text("standard_id").notNull(),
    methodology: text("methodology").notNull().default(""),
    status: text("status").notNull().default("in_progress"),
    snapshot: jsonb("snapshot").$type<AuditSnapshotJson>(),
    closedAt: timestamptz("closed_at"),
    closedBy: userRef("closed_by"),
    createdBy: userRef("created_by"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("audits_org_created_idx").on(t.orgId, t.createdAt)],
);

export type ReportFile = { key: string; size: number; contentType: string };
export type ReportSignOff = {
  userId: string;
  name: string;
  designation: string;
  signedAt: string;
};

/** A generated report. Generation runs in the worker; files live in object storage. */
export const reports = pgTable(
  "reports",
  {
    id: id(),
    orgId: orgId(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    period: text("period").notNull(),
    params: jsonb("params").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("queued"),
    error: text("error"),
    files: jsonb("files").$type<Partial<Record<string, ReportFile>>>().notNull().default({}),
    generatedBy: userRef("generated_by"),
    signedBy: jsonb("signed_by").$type<ReportSignOff[]>().notNull().default([]),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
  },
  (t) => [index("reports_org_created_idx").on(t.orgId, t.createdAt)],
);
