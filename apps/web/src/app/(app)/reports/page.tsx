import { listReportTypes, REPORT_TYPE_IDS, type ReportTypeId } from "@app/compliance-data";
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  TableContainer,
  tableClass,
  td,
  th,
} from "@app/ui";
import { FilePlus2, FileText, Signature } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReportRequestForm } from "@/components/reports/report-request-form";
import { REPORT_STATUS_LABELS } from "@/components/reports/report-status";
import { lastFinancialYear } from "@/lib/compliance-input";
import { formatDateTime } from "@/lib/format";
import { AUTOMATED_TESTING_DISCLAIMER } from "@/lib/labels";
import { canGenerateReports } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";
import { REPORT_STATUS_TONES, tone } from "@/lib/status-tones";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage(props: {
  searchParams: Promise<{ type?: string; auditId?: string }>;
}) {
  const { role, scope } = await requireAppContext();
  const query = await props.searchParams;
  const [reports, audits, properties] = await Promise.all([
    scope.reports.list(),
    scope.audits.list(),
    scope.properties.list(),
  ]);
  const types = listReportTypes();
  const initialType = REPORT_TYPE_IDS.find((t) => t === query.type) as ReportTypeId | undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Reports"
        description={`Reports are generated as tagged, accessible PDFs (with spreadsheet, web page or Markdown versions where useful). They assist your compliance work and do not certify compliance. ${AUTOMATED_TESTING_DISCLAIMER}`}
      />

      <section aria-labelledby="generate-heading">
        <Card className="max-w-3xl">
          <CardHeader
            id="generate-heading"
            icon={FilePlus2}
            title="Generate a report"
            description="Choose a report and fill in what it needs. Files are ready in about a minute."
          />
          {!canGenerateReports(role) ? (
            <Alert variant="info">
              Only owners, admins, nodal officers and auditors can generate reports.
            </Alert>
          ) : properties.length === 0 ? (
            <p>
              Add a property first.{" "}
              <Link className="text-primary underline" href="/properties">
                Go to properties
              </Link>
            </p>
          ) : (
            <ReportRequestForm
              types={types.map((t) => ({ type: t.type, title: t.title, summary: t.summary }))}
              audits={audits.map((a) => ({
                id: a.id,
                name: `${a.title}${a.status === "closed" ? "" : " (in progress)"}`,
              }))}
              properties={properties.map((p) => ({ id: p.id, name: p.name }))}
              defaultFinancialYear={lastFinancialYear()}
              initialType={initialType}
              initialAuditId={
                audits.some((a) => a.id === query.auditId) ? query.auditId : undefined
              }
            />
          )}
        </Card>
      </section>

      <section aria-labelledby="list-heading" className="space-y-3">
        <h2 id="list-heading" className="text-lg font-semibold">
          Generated reports
        </h2>
        {reports.length === 0 ? (
          <EmptyState icon={FileText} title="No reports yet." />
        ) : (
          <TableContainer>
            <table className={tableClass}>
              <caption className="sr-only">Generated reports, newest first</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Report
                  </th>
                  <th scope="col" className={th}>
                    Period
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={th}>
                    Requested
                  </th>
                  <th scope="col" className={th}>
                    Approvals
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map(({ report, generatedByName }) => (
                  <tr key={report.id}>
                    <th scope="row" className={`${td} min-w-56 text-left font-normal`}>
                      <Link
                        className="font-medium text-primary underline"
                        href={`/reports/${report.id}`}
                      >
                        {report.title}
                      </Link>
                    </th>
                    <td className={`${td} text-muted-foreground`}>{report.period}</td>
                    <td className={td}>
                      <Badge tone={tone(REPORT_STATUS_TONES, report.status)}>
                        {REPORT_STATUS_LABELS[report.status] ?? report.status}
                      </Badge>
                    </td>
                    <td className={td}>
                      {formatDateTime(report.createdAt)}
                      <span className="block text-xs text-muted-foreground">
                        by {generatedByName ?? "a former member"}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-1">
                        {report.signedBy.length > 0 ? (
                          <Signature className="size-3.5 text-muted-foreground" />
                        ) : null}
                        {report.signedBy.length}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </section>
    </div>
  );
}
