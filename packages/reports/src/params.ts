import { z } from "zod";

export { auditDates } from "./format";

/**
 * What the person asks for when generating each report type (stored in reports.params and
 * validated again by the worker). Safe to import from the web app.
 */

const id = z.string().min(1).max(100);
const name = z.string().trim().max(120);

/** "2025-26": consecutive years, as Indian financial years are written. */
export const financialYearSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Use the form 2025-26")
  .refine((value) => {
    const start = Number(value.slice(0, 4));
    return (start + 1) % 100 === Number(value.slice(5));
  }, "The two years must be consecutive, for example 2025-26");

export const REPORT_PARAMS_SCHEMAS = {
  platform_inventory: z.object({}),
  audit_summary: z.object({ auditId: id }),
  remediation_tracker: z.object({
    propertyIds: z.array(id).min(1, "Choose at least one property"),
  }),
  sebi_annual: z.object({
    financialYear: financialYearSchema,
    ceoName: name.default(""),
    ctoName: name.default(""),
  }),
  accessibility_statement: z.object({
    propertyId: id,
    standardId: z.string().min(1).max(40),
    contactEmail: z.email("Enter an email address for accessibility feedback").max(200),
    contactPhone: z.string().trim().max(40).default(""),
    responseDays: z.coerce.number().int().min(1).max(60).default(7),
    limitationsNote: z.string().trim().max(2000).default(""),
  }),
} as const;

export type ReportParamsByType = {
  [K in keyof typeof REPORT_PARAMS_SCHEMAS]: z.infer<(typeof REPORT_PARAMS_SCHEMAS)[K]>;
};

/** Start, end and due date (30 days after year end) of an Indian financial year. */
export function financialYearDates(label: string) {
  const start = Number(label.slice(0, 4));
  return {
    start: new Date(Date.UTC(start, 3, 1)),
    end: new Date(Date.UTC(start + 1, 2, 31)),
    due: new Date(Date.UTC(start + 1, 3, 30)),
  };
}
