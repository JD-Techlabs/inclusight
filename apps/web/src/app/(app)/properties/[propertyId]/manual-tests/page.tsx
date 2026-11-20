import {
  AUTOMATED_STATUS_LABELS,
  getCriterion,
  getStandard,
  MANUAL_RESULT_LABELS,
  PENDING_REVIEW_LABEL,
} from "@app/compliance-data";
import { loadConformance } from "@app/reports/snapshot";
import { Alert, PageHeader, TableContainer, tableClass, td, th } from "@app/ui";
import { Paperclip } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConformanceStatusText } from "@/components/compliance/conformance-status";
import { StandardTabs } from "@/components/compliance/standard-tabs";
import { standardFromQuery } from "@/lib/compliance-input";
import { AUTOMATED_TESTING_DISCLAIMER } from "@/lib/labels";
import { loadProperty } from "@/lib/load-property";

export const metadata: Metadata = { title: "Manual tests" };

/** Manual test checklist for one property (spec §8): one row per criterion of a standard. */
export default async function ManualTestsPage(props: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ standard?: string }>;
}) {
  const { property, scope } = await loadProperty((await props.params).propertyId);
  const standardId = standardFromQuery((await props.searchParams).standard);
  const standard = getStandard(standardId)!;
  const { conformance, manualTests } = await loadConformance(scope, [property.id], standardId);
  const rows = conformance[property.id] ?? [];
  const evidence = await scope.evidence.countByLink(
    "manual_test",
    manualTests.map((m) => m.id),
  );
  const evidenceByCriterion = new Map(
    manualTests.map((m) => [m.criterionId, evidence.get(m.id) ?? 0]),
  );
  const tested = rows.filter((r) => r.manual !== "not_tested").length;
  const base = `/properties/${property.id}/manual-tests`;
  const percent = rows.length === 0 ? 0 : Math.round((tested / rows.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/properties/${property.id}`, label: `Back to ${property.name}` }}
        title={`Manual tests: ${property.name}`}
        description={`Automated checks cannot decide most criteria. Test each one by hand using its steps, then record the result with notes and evidence. ${AUTOMATED_TESTING_DISCLAIMER}`}
      />
      <StandardTabs current={standardId} hrefFor={(id) => `${base}?standard=${id}`} />
      {standard.pendingReview ? (
        <Alert variant="info">
          {PENDING_REVIEW_LABEL}: {standard.reviewNote}
        </Alert>
      ) : null}
      <div className="max-w-xl space-y-2 rounded-xl border border-border-subtle bg-card p-4 shadow-card">
        <p role="status" className="font-medium">
          {tested} of {rows.length} criteria have a manual result for {standard.name}.
        </p>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full origin-left animate-enter rounded-full bg-linear-to-r from-brand-from to-brand-to"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <TableContainer>
        <table className={tableClass}>
          <caption className="sr-only">
            Criteria of {standard.name} with automated, manual and overall results
          </caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                Criterion
              </th>
              <th scope="col" className={th}>
                Automated checks
              </th>
              <th scope="col" className={th}>
                Manual test
              </th>
              <th scope="col" className={th}>
                Result
              </th>
              <th scope="col" className={th}>
                Evidence
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const criterion = getCriterion(row.criterionId)!;
              const files = evidenceByCriterion.get(row.criterionId) ?? 0;
              return (
                <tr key={row.criterionId}>
                  <th scope="row" className={`${td} min-w-64 text-left font-normal`}>
                    <Link
                      className="font-medium text-primary underline"
                      href={`${base}/${criterion.id}?standard=${standardId}`}
                    >
                      {criterion.label}
                    </Link>
                    {criterion.level ? (
                      <span className="block text-xs text-muted-foreground">
                        Level {criterion.level}
                      </span>
                    ) : null}
                  </th>
                  <td className={`${td} text-muted-foreground`}>
                    {AUTOMATED_STATUS_LABELS[row.automated]}
                    {row.violations > 0 ? ` (${row.violations})` : ""}
                  </td>
                  <td className={td}>{MANUAL_RESULT_LABELS[row.manual]}</td>
                  <td className={td}>
                    <ConformanceStatusText status={row.status} />
                  </td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-1">
                      {files > 0 ? <Paperclip className="size-3.5 text-muted-foreground" /> : null}
                      {files}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );
}
