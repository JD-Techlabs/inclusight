import { ISSUE_STATUSES } from "@app/db/domain";
import { IMPACTS } from "@app/scanner-core/pure";
import { Button, SelectField, TextField } from "@app/ui";
import Link from "next/link";
import type { IssueQuery } from "@/lib/issue-filters";
import { IMPACT_LABELS, ISSUE_STATUS_LABELS } from "@/lib/labels";

type Props = {
  query: IssueQuery;
  criteria: string[];
  templates: Array<{ templateHash: string; exampleUrl: string; pageCount: number }>;
  members: Array<{ userId: string; name: string }>;
  clearHref: string;
};

/** Plain GET form: filters live in the URL, so filtered views can be bookmarked and shared. */
export function IssueFiltersForm({ query, criteria, templates, members, clearHref }: Props) {
  return (
    <form method="get" className="space-y-4" aria-label="Filter issues">
      {query.type !== "violations" ? <input type="hidden" name="type" value={query.type} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Status" name="status" defaultValue={query.status}>
          <option value="active">Open and in progress</option>
          <option value="all">All statuses</option>
          {ISSUE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ISSUE_STATUS_LABELS[status]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Impact" name="impact" defaultValue={query.impact ?? ""}>
          <option value="">All impacts</option>
          {IMPACTS.map((impact) => (
            <option key={impact} value={impact}>
              {IMPACT_LABELS[impact]}
            </option>
          ))}
        </SelectField>
        <SelectField label="WCAG criterion" name="criterion" defaultValue={query.criterion ?? ""}>
          <option value="">All criteria</option>
          {criteria.map((criterion) => (
            <option key={criterion} value={criterion}>
              {criterion}
            </option>
          ))}
        </SelectField>
        <SelectField label="Assignee" name="assignee" defaultValue={query.assignee ?? ""}>
          <option value="">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Page template" name="template" defaultValue={query.template ?? ""}>
          <option value="">All templates</option>
          {templates.map((template) => (
            <option key={template.templateHash} value={template.templateHash}>
              Like {template.exampleUrl} ({template.pageCount} pages)
            </option>
          ))}
        </SelectField>
        <TextField label="Page address contains" name="page" defaultValue={query.page ?? ""} />
        <SelectField label="Sort by" name="sort" defaultValue={query.sort}>
          <option value="severity">Most severe first</option>
          <option value="occurrences">Most occurrences first</option>
        </SelectField>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
        <Link className="text-sm text-primary underline" href={clearHref}>
          Clear filters
        </Link>
      </div>
    </form>
  );
}
