import {
  combineStatuses,
  CONFORMANCE_STATUSES,
  criteriaForStandard,
  getStandard,
  PENDING_REVIEW_LABEL,
  type ConformanceStatus,
} from "@app/compliance-data";
import { loadConformance } from "@app/reports/snapshot";
import {
  Alert,
  buttonVariants,
  EmptyState,
  PageHeader,
  TableContainer,
  tableClass,
  td,
  th,
} from "@app/ui";
import { ChevronRight, Download, Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ConformanceLegend,
  ConformanceStatusText,
} from "@/components/compliance/conformance-status";
import { StandardTabs } from "@/components/compliance/standard-tabs";
import { standardFromQuery } from "@/lib/compliance-input";
import { AUTOMATED_TESTING_DISCLAIMER } from "@/lib/labels";
import { requireAppContext } from "@/lib/session";

export const metadata: Metadata = { title: "Conformance" };

/** Conformance matrix (spec §8): criteria × properties, automated + manual → overall status. */
export default async function CompliancePage(props: {
  searchParams: Promise<{ standard?: string }>;
}) {
  const { scope } = await requireAppContext();
  const standardId = standardFromQuery((await props.searchParams).standard);
  const standard = getStandard(standardId)!;
  const properties = await scope.properties.list();
  const { conformance } = await loadConformance(
    scope,
    properties.map((p) => p.id),
    standardId,
  );
  const criteria = criteriaForStandard(standardId);
  const statusOf = (propertyId: string, criterionId: string) =>
    conformance[propertyId]?.find((r) => r.criterionId === criterionId);
  const overall = criteria.map((c) =>
    combineStatuses(properties.map((p) => statusOf(p.id, c.id)?.status ?? "not_evaluated")),
  );
  const count = (status: ConformanceStatus) => overall.filter((s) => s === status).length;
  const exportLink = buttonVariants({ variant: "secondary", size: "sm" });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Conformance"
        description={
          <>
            <p>
              How each property measures up against a standard, combining automated scan results
              with manual test results. Select a result to record or update the manual test for it.
            </p>
            <p className="mt-1">{AUTOMATED_TESTING_DISCLAIMER}</p>
          </>
        }
      />

      <StandardTabs current={standardId} hrefFor={(id) => `/compliance?standard=${id}`} />
      {standard.pendingReview ? (
        <Alert variant="info">
          {PENDING_REVIEW_LABEL}: {standard.reviewNote}
        </Alert>
      ) : null}

      {properties.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Add a property first."
          action={
            <Link className="text-primary underline" href="/properties">
              Go to properties
            </Link>
          }
        />
      ) : (
        <>
          <section aria-labelledby="summary-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="summary-heading" className="text-lg font-semibold">
                Summary for {standard.name}
              </h2>
              <p className="flex flex-wrap gap-2 text-sm">
                <a
                  className={exportLink}
                  href={`/api/compliance/matrix?standard=${standardId}&format=csv`}
                >
                  <Download />
                  Export CSV
                </a>
                <a
                  className={exportLink}
                  href={`/api/compliance/matrix?standard=${standardId}&format=xlsx`}
                >
                  <Download />
                  Export Excel
                </a>
              </p>
            </div>
            <ul className="stagger grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {CONFORMANCE_STATUSES.map((status) => (
                <li
                  key={status}
                  className="rounded-xl border border-border-subtle bg-card px-4 py-3 shadow-card"
                >
                  <span className="block text-sm text-muted-foreground">
                    <ConformanceStatusText status={status} />
                  </span>
                  <strong className="mt-1 block text-2xl font-semibold">{count(status)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <details className="group max-w-3xl rounded-xl border border-border-subtle bg-card px-4 py-3 shadow-card">
            <summary className="flex items-center gap-2 text-sm font-medium">
              <ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" />
              What the results mean
            </summary>
            <div className="animate-enter pt-3">
              <ConformanceLegend />
            </div>
          </details>

          <TableContainer>
            <table className={tableClass}>
              <caption className="sr-only">
                Conformance with {standard.name}: one row per criterion, one column per property
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Criterion
                  </th>
                  {properties.map((p) => (
                    <th key={p.id} scope="col" className={th}>
                      <Link
                        className="text-primary underline"
                        href={`/properties/${p.id}/manual-tests?standard=${standardId}`}
                      >
                        {p.name}
                      </Link>
                    </th>
                  ))}
                  {properties.length > 1 ? (
                    <th scope="col" className={th}>
                      Overall
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {criteria.map((criterion, index) => (
                  <tr key={criterion.id}>
                    <th scope="row" className={`${td} min-w-64 text-left font-normal`}>
                      <span className="font-medium">{criterion.label}</span>
                      {criterion.level ? (
                        <span className="block text-xs text-muted-foreground">
                          Level {criterion.level}
                        </span>
                      ) : null}
                    </th>
                    {properties.map((p) => {
                      const row = statusOf(p.id, criterion.id);
                      return (
                        <td key={p.id} className={td}>
                          <Link
                            className="text-primary underline"
                            href={`/properties/${p.id}/manual-tests/${criterion.id}?standard=${standardId}`}
                          >
                            <ConformanceStatusText status={row?.status ?? "not_evaluated"} />
                            <span className="sr-only">
                              : {criterion.label} on {p.name}
                            </span>
                          </Link>
                          {row && row.violations > 0 ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {row.violations} {row.violations === 1 ? "issue" : "issues"} found
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                    {properties.length > 1 ? (
                      <td className={td}>
                        <ConformanceStatusText status={overall[index]!} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        </>
      )}
    </div>
  );
}
