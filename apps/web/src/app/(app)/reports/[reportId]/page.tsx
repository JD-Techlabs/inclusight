import { getReportType } from "@app/compliance-data";
import { Alert, Card, CardHeader, PageHeader } from "@app/ui";
import {
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileType2,
  Signature,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ReportStatus } from "@/components/reports/report-status";
import { SignOffForm } from "@/components/reports/sign-off-form";
import { formatDateTime } from "@/lib/format";
import { canSignOffReports } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";

export const metadata: Metadata = { title: "Report" };

const FORMATS: Record<string, { label: string; icon: LucideIcon }> = {
  pdf: { label: "PDF (tagged, accessible)", icon: FileText },
  xlsx: { label: "Excel spreadsheet", icon: FileSpreadsheet },
  html: { label: "Web page (HTML)", icon: FileCode2 },
  md: { label: "Markdown", icon: FileType2 },
};

export default async function ReportPage(props: { params: Promise<{ reportId: string }> }) {
  const { role, user, scope } = await requireAppContext();
  const id = z
    .string()
    .min(1)
    .max(100)
    .safeParse((await props.params).reportId);
  const found = id.success ? await scope.reports.get(id.data) : null;
  if (!found) notFound();
  const { report, generatedByName } = found;
  const info = getReportType(report.type);
  const files = Object.entries(report.files).filter(([, file]) => file);
  const signedByMe = report.signedBy.some((s) => s.userId === user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/reports", label: "Back to reports" }}
        eyebrow={info?.title ?? report.type}
        title={report.title}
      />

      <Card className="max-w-3xl space-y-4">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Report</dt>
          <dd className="font-medium">{info?.title ?? report.type}</dd>
          <dt className="text-muted-foreground">Period</dt>
          <dd className="font-medium">{report.period}</dd>
          <dt className="text-muted-foreground">Requested</dt>
          <dd className="font-medium">
            {formatDateTime(report.createdAt)} by {generatedByName ?? "a former member"}
          </dd>
        </dl>
        <div className="border-t border-border-subtle pt-4">
          <ReportStatus reportId={report.id} initial={report.status} />
        </div>
      </Card>
      {info?.formatNote ? (
        <Alert variant="info" className="max-w-3xl">
          {info.formatNote}
        </Alert>
      ) : null}
      {report.status === "failed" ? (
        <Alert variant="error" className="max-w-3xl">
          {report.error ?? "The report could not be generated."} Generate it again from the reports
          page.
        </Alert>
      ) : null}

      {report.status === "ready" ? (
        <section aria-labelledby="files-heading" className="max-w-3xl space-y-3">
          <h2 id="files-heading" className="text-lg font-semibold">
            Download
          </h2>
          <ul className="stagger grid gap-3 sm:grid-cols-2">
            {files.map(([format, file]) => {
              const meta = FORMATS[format] ?? { label: format, icon: FileText };
              const Icon = meta.icon;
              return (
                <li key={format}>
                  <a
                    className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-card p-4 shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised"
                    href={`/api/reports/${report.id}/files/${format}`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-primary underline">
                        Download {meta.label}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {Math.max(1, Math.round(file!.size / 1024))} KB
                      </span>
                    </span>
                    <Download className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-y-0.5" />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="approvals-heading" className="max-w-3xl">
        <Card>
          <CardHeader
            id="approvals-heading"
            icon={Signature}
            title="Approvals"
            description="Recording an approval notes who approved the report and when. Signatures (for example the CEO's and CTO's on the annual report) are added outside A11yComply."
          />
          {report.signedBy.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approvals recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.signedBy.map((s) => (
                <li
                  key={`${s.userId}-${s.designation}`}
                  className="rounded-lg border border-border-subtle bg-muted/40 px-3 py-2"
                >
                  {s.name}, {s.designation}, on {formatDateTime(new Date(s.signedAt))}
                </li>
              ))}
            </ul>
          )}
          {report.status === "ready" && canSignOffReports(role) ? (
            <div className="mt-6 border-t border-border-subtle pt-5">
              <h3 className="mb-3 font-semibold">
                {signedByMe ? "Record another approval" : "Record your approval"}
              </h3>
              <SignOffForm reportId={report.id} />
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
