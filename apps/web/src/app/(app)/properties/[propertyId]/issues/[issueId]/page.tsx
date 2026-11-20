import { getCriterion } from "@app/compliance-data";
import { Badge, Card, CardHeader, PageHeader } from "@app/ui";
import { CircleHelp, ExternalLink, FileWarning, MapPin, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { IssueTriageForm } from "@/components/issues/issue-triage-form";
import { OccurrenceScreenshot } from "@/components/issues/occurrence-screenshot";
import {
  AUTOMATED_TESTING_DISCLAIMER,
  IMPACT_LABELS,
  ISSUE_STATUS_LABELS,
  label,
  VIEWPORT_LABELS,
} from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { loadProperty } from "@/lib/load-property";
import { canTriageIssues } from "@/lib/roles";
import { IMPACT_TONES, ISSUE_STATUS_TONES, tone } from "@/lib/status-tones";

export const metadata: Metadata = { title: "Issue" };

const OCCURRENCE_LIMIT = 100;

export default async function IssuePage(props: {
  params: Promise<{ propertyId: string; issueId: string }>;
}) {
  const params = await props.params;
  const { property, role, scope } = await loadProperty(params.propertyId);
  const id = z.string().min(1).max(100).safeParse(params.issueId);
  const found = id.success ? await scope.issues.get(id.data) : null;
  if (!found || found.issue.propertyId !== property.id) notFound();
  const { issue } = found;
  const criteria = issue.criteria
    .map((id) => getCriterion(id))
    .filter((c): c is NonNullable<typeof c> => c !== null && c.source === "wcag");
  const affects = [...new Set(criteria.flatMap((c) => c.affects))];
  const [occurrences, members] = await Promise.all([
    scope.issues.occurrences(issue, OCCURRENCE_LIMIT),
    scope.members.list(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/properties/${property.id}/issues`, label: "Back to issues" }}
        eyebrow={property.name}
        title={issue.helpText}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone(IMPACT_TONES, issue.impact)}>
              Impact: {label(IMPACT_LABELS, issue.impact)}
            </Badge>
            <Badge tone={tone(ISSUE_STATUS_TONES, issue.status)}>
              {label(ISSUE_STATUS_LABELS, issue.status)}
            </Badge>
            <code className="rounded-md bg-muted px-2 py-0.5 text-xs">{issue.ruleId}</code>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-3 lg:col-span-3">
          <CardHeader
            className="mb-2"
            icon={issue.needsReview ? CircleHelp : FileWarning}
            title={issue.needsReview ? "What to check" : "What is wrong"}
          />
          {issue.needsReview ? (
            <p>
              <strong>Needs manual review.</strong> The scanner cannot decide this on its own. Check
              the occurrences below by hand, then record the result in the manual tests.
            </p>
          ) : null}
          <p className="leading-relaxed">{issue.description || issue.helpText}</p>
          {issue.helpUrl && /dequeuniversity\.com/.test(issue.helpUrl) ? (
            <p>
              <a
                className="inline-flex items-center gap-1.5 font-medium text-primary underline"
                href={issue.helpUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Wrench className="size-4" />
                How to fix this (Deque University, opens in a new tab)
              </a>
            </p>
          ) : null}
          <p className="border-t border-border-subtle pt-3 text-xs text-muted-foreground">
            {AUTOMATED_TESTING_DISCLAIMER}
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="sr-only">Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">
                {label(ISSUE_STATUS_LABELS, issue.status)}
                {issue.statusReason ? ` — ${issue.statusReason}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Assignee</dt>
              <dd className="font-medium">{found.assigneeName ?? "Nobody"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Target date</dt>
              <dd className="font-medium">
                {issue.targetDate
                  ? formatDate(new Date(`${issue.targetDate}T00:00:00+05:30`))
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">WCAG criteria</dt>
              <dd>
                {criteria.length > 0 ? (
                  <ul className="space-y-1">
                    {criteria.map((c) => (
                      <li key={c.id}>
                        <a
                          className="text-primary underline"
                          href={c.url!}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {c.label} (Level {c.level}, opens W3C guidance in a new tab)
                          <ExternalLink className="ml-1 inline size-3.5 align-[-2px]" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : issue.needsReview ? (
                  "None"
                ) : (
                  "None (best practice)"
                )}
              </dd>
            </div>
            {affects.length > 0 ? (
              <div>
                <dt className="text-muted-foreground">Who it affects</dt>
                <dd className="font-medium">{affects.join(", ")}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Found in</dt>
              <dd>
                {issue.occurrenceCount} places on {issue.pageCount}{" "}
                {issue.pageCount === 1 ? "page" : "pages"} in the{" "}
                {issue.lastSeenScanId ? (
                  <Link className="text-primary underline" href={`/scans/${issue.lastSeenScanId}`}>
                    latest scan that saw it
                  </Link>
                ) : (
                  "latest scan that saw it"
                )}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {canTriageIssues(role) ? (
        <section aria-labelledby="triage-heading" className="max-w-3xl">
          <h2 id="triage-heading" className="sr-only">
            Update this issue
          </h2>
          <IssueTriageForm
            members={members.map((m) => ({ userId: m.userId, name: m.name }))}
            issueIds={[issue.id]}
            legend="Update this issue"
          />
        </section>
      ) : null}

      <section aria-labelledby="occurrences-heading" className="space-y-4">
        <h2 id="occurrences-heading" className="flex items-center gap-2 text-lg font-semibold">
          <MapPin className="size-5 text-muted-foreground" />
          Occurrences
          {occurrences.length >= OCCURRENCE_LIMIT ? ` (first ${OCCURRENCE_LIMIT})` : ""}
        </h2>
        {occurrences.length === 0 ? (
          <p className="text-sm text-muted-foreground">No occurrences in the latest scan.</p>
        ) : (
          <ol className="stagger space-y-4">
            {occurrences.map((occurrence) => (
              <li
                key={occurrence.id}
                className="space-y-3 rounded-xl border border-border-subtle bg-card p-5 shadow-card"
              >
                <h3 className="font-medium break-all">
                  {occurrence.pageUrl}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({label(VIEWPORT_LABELS, occurrence.viewport)})
                  </span>
                </h3>
                <p className="text-sm">
                  <span className="text-muted-foreground">Selector:</span>{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">
                    {occurrence.selector}
                  </code>
                </p>
                <pre className="rounded-lg border border-border-subtle bg-muted/60 p-3 text-xs leading-relaxed break-all whitespace-pre-wrap">
                  <code>{occurrence.htmlSnippet}</code>
                </pre>
                {occurrence.failureSummary ? (
                  <p className="text-sm whitespace-pre-line">{occurrence.failureSummary}</p>
                ) : null}
                <OccurrenceScreenshot
                  scanId={occurrence.scanId}
                  pageId={occurrence.pageId}
                  pageUrl={occurrence.pageUrl}
                  viewport={occurrence.viewport}
                  screenshot={occurrence.screenshots?.[occurrence.viewport]}
                  box={occurrence.bbox}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
