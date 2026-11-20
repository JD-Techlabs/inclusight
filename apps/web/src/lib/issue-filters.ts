import type { IssueFilters, IssueSort } from "@app/db";
import { ISSUE_STATUSES, type IssueStatus } from "@app/db/domain";
import { IMPACTS } from "@app/scanner-core/pure";
import { z } from "zod";

export const PAGE_SIZE = 50;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const querySchema = z.object({
  type: z.enum(["violations", "best-practice", "review"]).catch("violations"),
  status: z.enum(["active", "all", ...ISSUE_STATUSES]).catch("active"),
  impact: z.enum(IMPACTS).optional().catch(undefined),
  criterion: z
    .string()
    .regex(/^\d\.\d{1,2}\.\d{1,2}$/)
    .optional()
    .catch(undefined),
  template: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional()
    .catch(undefined),
  page: z.string().trim().max(200).optional().catch(undefined),
  assignee: z.string().max(100).optional().catch(undefined),
  sort: z.enum(["severity", "occurrences"]).catch("severity"),
  p: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type IssueQuery = z.infer<typeof querySchema>;

/** Parses the issues-list URL. Invalid values fall back to defaults instead of erroring. */
export function parseIssueQuery(params: SearchParams): IssueQuery {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, first(v) || undefined]),
  );
  return querySchema.parse(flat);
}

export function toIssueFilters(query: IssueQuery): IssueFilters {
  let statuses: IssueStatus[] | undefined;
  if (query.status === "active") statuses = ["open", "in_progress"];
  else if (query.status !== "all") statuses = [query.status];
  return {
    statuses,
    impact: query.impact,
    criterion: query.criterion,
    templateHash: query.template,
    pageUrlContains: query.page || undefined,
    assignee: query.assignee,
    category:
      query.type === "best-practice"
        ? "best_practice"
        : query.type === "review"
          ? "review"
          : "wcag",
  };
}

export function issueSort(query: IssueQuery): IssueSort {
  return query.sort;
}

/** Query string for a link that keeps the current filters but changes some values. */
export function issueQueryString(query: IssueQuery, changes: Partial<IssueQuery> = {}): string {
  const merged = { ...query, ...changes };
  const params = new URLSearchParams();
  const defaults: Partial<Record<keyof IssueQuery, unknown>> = {
    type: "violations",
    status: "active",
    sort: "severity",
    p: 1,
  };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "" || defaults[key as keyof IssueQuery] === value)
      continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
