import {
  Badge,
  buttonVariants,
  Card,
  EmptyState,
  PageHeader,
  TableContainer,
  TabNav,
  tableClass,
  td,
  th,
} from "@app/ui";
import { Download, SearchCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IssueFiltersForm } from "@/components/issues/issue-filters-form";
import { IssueTriageForm } from "@/components/issues/issue-triage-form";
import {
  issueQueryString,
  issueSort,
  PAGE_SIZE,
  parseIssueQuery,
  toIssueFilters,
} from "@/lib/issue-filters";
import {
  AUTOMATED_TESTING_DISCLAIMER,
  IMPACT_LABELS,
  ISSUE_STATUS_LABELS,
  label,
} from "@/lib/labels";
import { loadProperty } from "@/lib/load-property";
import { canTriageIssues } from "@/lib/roles";
import { IMPACT_TONES, ISSUE_STATUS_TONES, tone } from "@/lib/status-tones";

export const metadata: Metadata = { title: "Issues" };

export default async function IssuesPage(props: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { property, role, scope } = await loadProperty((await props.params).propertyId);
  const query = parseIssueQuery(await props.searchParams);
  const [{ rows, total }, options, members] = await Promise.all([
    scope.issues.list(property.id, toIssueFilters(query), {
      sort: issueSort(query),
      limit: PAGE_SIZE,
      offset: (query.p - 1) * PAGE_SIZE,
    }),
    scope.issues.filterOptions(property.id),
    scope.members.list(),
  ]);
  const base = `/properties/${property.id}/issues`;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportQuery = issueQueryString(query, { p: 1 }).replace(/^\?/, "&");
  const memberOptions = members.map((m) => ({ userId: m.userId, name: m.name }));
  const triage = canTriageIssues(role);
  const bestPractice = query.type === "best-practice";
  const review = query.type === "review";
  const listName = bestPractice
    ? "Best-practice findings"
    : review
      ? "Findings that need review"
      : "Issues";
  const exportLink = buttonVariants({ variant: "secondary", size: "sm" });

  const table = (
    <TableContainer>
      <table className={tableClass}>
        <caption className="sr-only">
          {listName}, page {query.p} of {totalPages}
        </caption>
        <thead>
          <tr>
            {triage ? (
              <th scope="col" className={th}>
                <span className="sr-only">Select</span>
              </th>
            ) : null}
            <th scope="col" className={th}>
              Issue
            </th>
            <th scope="col" className={th}>
              Impact
            </th>
            <th scope="col" className={th}>
              WCAG
            </th>
            <th scope="col" className={th}>
              Occurrences
            </th>
            <th scope="col" className={th}>
              Pages
            </th>
            <th scope="col" className={th}>
              Status
            </th>
            <th scope="col" className={th}>
              Assignee
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((issue) => (
            <tr key={issue.id}>
              {triage ? (
                <td className={td}>
                  <input
                    type="checkbox"
                    name="issueIds"
                    value={issue.id}
                    id={`select-${issue.id}`}
                    className="h-5 w-5"
                  />
                  <label htmlFor={`select-${issue.id}`} className="sr-only">
                    Select {issue.helpText} ({issue.ruleId})
                  </label>
                </td>
              ) : null}
              <th scope="row" className={`${td} min-w-56 text-left font-normal`}>
                <Link className="font-medium text-primary underline" href={`${base}/${issue.id}`}>
                  {issue.helpText}
                </Link>
                <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                  {issue.ruleId}
                </span>
              </th>
              <td className={td}>
                <Badge tone={tone(IMPACT_TONES, issue.impact)}>
                  {label(IMPACT_LABELS, issue.impact)}
                </Badge>
              </td>
              <td className={td}>{issue.criteria.join(", ") || "—"}</td>
              <td className={`${td} font-semibold`}>{issue.occurrenceCount}</td>
              <td className={td}>{issue.pageCount}</td>
              <td className={td}>
                <Badge tone={tone(ISSUE_STATUS_TONES, issue.status)}>
                  {label(ISSUE_STATUS_LABELS, issue.status)}
                </Badge>
              </td>
              <td className={td}>{issue.assigneeName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableContainer>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/properties/${property.id}`, label: `Back to ${property.name}` }}
        title={`Issues: ${property.name}`}
        description={AUTOMATED_TESTING_DISCLAIMER}
      />

      <TabNav
        label="Issue type"
        items={(
          [
            ["violations", "WCAG violations"],
            ["review", "Needs review"],
            ["best-practice", "Best practices (not counted in the score)"],
          ] as const
        ).map(([type, text]) => ({
          key: type,
          href: `${base}${issueQueryString({ ...query, p: 1, type })}`,
          label: text,
          current: query.type === type,
        }))}
      />

      <Card className="p-5">
        <IssueFiltersForm
          query={query}
          criteria={options.criteria}
          templates={options.templates}
          members={memberOptions}
          clearHref={query.type === "violations" ? base : `${base}?type=${query.type}`}
        />
      </Card>
      {review ? (
        <p className="text-sm">
          These findings come from checks that cannot decide on their own (for example a CAPTCHA, a
          session timeout or a video). Check each one by hand, then record the result in the manual
          tests. They are not counted in the score.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p role="status" className="font-medium">
          {total} {total === 1 ? "issue" : "issues"} match these filters
        </p>
        <p className="flex flex-wrap gap-2 text-sm">
          <a
            className={exportLink}
            href={`/api/properties/${property.id}/issues/export?format=csv${exportQuery}`}
          >
            <Download />
            Export CSV
          </a>
          <a
            className={exportLink}
            href={`/api/properties/${property.id}/issues/export?format=xlsx${exportQuery}`}
          >
            <Download />
            Export Excel
          </a>
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={SearchCheck} title="No issues match these filters." />
      ) : triage ? (
        <IssueTriageForm members={memberOptions} legend="Change the selected issues">
          {table}
        </IssueTriageForm>
      ) : (
        table
      )}

      {totalPages > 1 ? (
        <nav aria-label="Issues pagination" className="flex items-center gap-4 text-sm">
          {query.p > 1 ? (
            <Link
              className="text-primary underline"
              href={`${base}${issueQueryString(query, { p: query.p - 1 })}`}
            >
              Previous page
            </Link>
          ) : null}
          <span>
            Page {query.p} of {totalPages}
          </span>
          {query.p < totalPages ? (
            <Link
              className="text-primary underline"
              href={`${base}${issueQueryString(query, { p: query.p + 1 })}`}
            >
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
