import type { ScanSummary } from "@app/db";
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  StatCard,
  TableContainer,
  tableClass,
  td,
  th,
} from "@app/ui";
import { ArrowRight, BadgeCheck, Bug, FileStack, Gauge, RotateCcw, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ScanProgress } from "@/components/scans/scan-progress";
import { formatDateTime } from "@/lib/format";
import { AUTOMATED_TESTING_DISCLAIMER, IMPACT_LABELS, label, SCAN_MODE_LABELS } from "@/lib/labels";
import { requireAppContext } from "@/lib/session";
import { IMPACT_TONES } from "@/lib/status-tones";

export const metadata: Metadata = { title: "Scan" };

const PAGE_SIZE = 50;

const IMPACT_BARS: Record<string, string> = {
  critical: "bg-destructive",
  serious: "bg-warning",
  moderate: "bg-info",
  minor: "bg-muted-foreground",
};

export default async function ScanPage(props: {
  params: Promise<{ scanId: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { scope } = await requireAppContext();
  const id = z
    .string()
    .min(1)
    .max(100)
    .safeParse((await props.params).scanId);
  const found = id.success ? await scope.scans.get(id.data) : null;
  if (!found) notFound();
  const { scan } = found;
  const pageNumber = Math.max(1, Number((await props.searchParams).p) || 1);
  const [progress, pages] = await Promise.all([
    scope.scans.progress(scan.id),
    scope.scans.listPages(scan.id, { limit: PAGE_SIZE, offset: (pageNumber - 1) * PAGE_SIZE }),
  ]);
  const summary = scan.summary as ScanSummary | null;
  const totalPages = Math.max(1, Math.ceil(scan.pagesFound / PAGE_SIZE));
  const issuesHref = `/properties/${scan.propertyId}/issues`;
  const impactTotal = summary
    ? Math.max(1, ...Object.values(summary.byImpact).map((n) => Number(n) || 0))
    : 1;

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/properties/${scan.propertyId}`, label: `Back to ${found.propertyName}` }}
        title={`Scan of ${found.propertyName}`}
        description={
          <>
            {label(SCAN_MODE_LABELS, scan.mode)} · started {formatDateTime(scan.createdAt)}
            {scan.finishedAt ? ` · finished ${formatDateTime(scan.finishedAt)}` : ""}
          </>
        }
      />

      <Card>
        <ScanProgress
          scanId={scan.id}
          initial={{ status: scan.status, pagesFound: scan.pagesFound, ...progress }}
        />
        {scan.error ? (
          <Alert variant="error" className="mt-4">
            {scan.error}
          </Alert>
        ) : null}
      </Card>

      {summary ? (
        <section aria-labelledby="summary-heading" className="space-y-4">
          <h2 id="summary-heading" className="text-lg font-semibold">
            Results
          </h2>
          <dl
            className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
            data-testid="scan-summary"
          >
            <StatCard
              label="Score"
              value={summary.score === null ? "—" : `${summary.score} / 100`}
              icon={Gauge}
            />
            <StatCard label="New issues" value={summary.newIssues} icon={Sparkles} tone="warning" />
            <StatCard
              label="Fixed issues"
              value={summary.fixedIssues}
              icon={BadgeCheck}
              tone="success"
            />
            <StatCard
              label="Reopened issues"
              value={summary.reopenedIssues}
              icon={RotateCcw}
              tone="danger"
            />
          </dl>
          <p className="text-sm text-muted-foreground">{AUTOMATED_TESTING_DISCLAIMER}</p>

          <Card className="max-w-2xl">
            <CardHeader
              as="h3"
              id="impact-heading"
              icon={Bug}
              title="Issues found in this scan by impact"
            />
            <table className="w-full text-sm" aria-labelledby="impact-heading">
              <tbody>
                {(["critical", "serious", "moderate", "minor"] as const).map((impact) => {
                  const count = summary.byImpact[impact];
                  return (
                    <tr key={impact}>
                      <th scope="row" className="w-32 py-1.5 pr-4 text-left font-normal">
                        <Badge tone={IMPACT_TONES[impact]}>{IMPACT_LABELS[impact]}</Badge>
                      </th>
                      <td className="py-1.5">
                        <span className="flex items-center gap-3">
                          <span className="w-10 font-semibold">{count}</span>
                          <span
                            aria-hidden="true"
                            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                          >
                            <span
                              className={`block h-full origin-left animate-enter rounded-full ${IMPACT_BARS[impact]}`}
                              style={{ width: `${(count / impactTotal) * 100}%` }}
                            />
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-4 text-sm">
              <span>{summary.openIssues} open issues on this property.</span>
              <Link
                className="inline-flex items-center gap-1 font-medium text-primary underline"
                href={issuesHref}
              >
                View issues
                <ArrowRight className="size-4" />
              </Link>
              {summary.bestPracticeIssues > 0 ? (
                <Link className="text-primary underline" href={`${issuesHref}?type=best-practice`}>
                  {summary.bestPracticeIssues} best-practice findings
                </Link>
              ) : null}
            </p>
          </Card>
        </section>
      ) : null}

      {pages.length > 0 ? (
        <section aria-labelledby="pages-heading" className="space-y-3">
          <h2 id="pages-heading" className="flex items-center gap-2 text-lg font-semibold">
            <FileStack className="size-5 text-muted-foreground" />
            Pages ({scan.pagesFound})
          </h2>
          <TableContainer>
            <table className={tableClass}>
              <caption className="sr-only">
                Pages in this scan, page {pageNumber} of {totalPages}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Page
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={th}>
                    Violations found
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.scanPageId}>
                    <td className={`${td} break-all`}>
                      {page.title ? <span className="block font-medium">{page.title}</span> : null}
                      <span className="text-muted-foreground">{page.url}</span>
                    </td>
                    <td className={td}>
                      {page.status === "done" ? (
                        <Badge tone="success">Checked</Badge>
                      ) : page.status === "failed" ? (
                        <Badge tone="danger" className="whitespace-normal">
                          Failed: {page.error ?? ""}
                        </Badge>
                      ) : (
                        <Badge tone="info">Waiting</Badge>
                      )}
                    </td>
                    <td className={`${td} font-semibold`}>
                      {page.status === "done" ? page.violationCount : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
          {totalPages > 1 ? (
            <nav aria-label="Pages table pagination" className="flex items-center gap-4 text-sm">
              {pageNumber > 1 ? (
                <Link className="text-primary underline" href={`?p=${pageNumber - 1}`}>
                  Previous
                </Link>
              ) : null}
              <span>
                Page {pageNumber} of {totalPages}
              </span>
              {pageNumber < totalPages ? (
                <Link className="text-primary underline" href={`?p=${pageNumber + 1}`}>
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
