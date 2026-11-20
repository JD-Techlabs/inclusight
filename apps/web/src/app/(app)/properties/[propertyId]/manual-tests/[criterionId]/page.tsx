import {
  AUTOMATABLE_LABELS,
  AUTOMATED_STATUS_LABELS,
  getCriterion,
  getStandard,
  listStandards,
  PENDING_REVIEW_LABEL,
  type ManualResult,
} from "@app/compliance-data";
import { loadConformance } from "@app/reports/snapshot";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@app/ui";
import {
  BookOpen,
  ExternalLink,
  FileText,
  ListOrdered,
  NotebookPen,
  Paperclip,
  Upload,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConformanceStatusText } from "@/components/compliance/conformance-status";
import { DeleteEvidenceButton, EvidenceUploadForm } from "@/components/compliance/evidence-forms";
import { ManualTestForm } from "@/components/compliance/manual-test-form";
import { formatDateTime } from "@/lib/format";
import { loadProperty } from "@/lib/load-property";
import { canRecordManualTests } from "@/lib/roles";

export const metadata: Metadata = { title: "Manual test" };

/** One criterion on one property: what it means, automated findings, how to test, result. */
export default async function CriterionTestPage(props: {
  params: Promise<{ propertyId: string; criterionId: string }>;
  searchParams: Promise<{ standard?: string }>;
}) {
  const params = await props.params;
  const { property, role, scope } = await loadProperty(params.propertyId);
  const criterion = getCriterion(params.criterionId); // unknown ids (any text) are a 404
  if (!criterion) notFound();
  const requested = getStandard((await props.searchParams).standard ?? "");
  const standard = requested?.criteria.includes(criterion.id)
    ? requested
    : listStandards().find((s) => s.criteria.includes(criterion.id))!;

  const [{ conformance }, manual] = await Promise.all([
    loadConformance(scope, [property.id], standard.id),
    scope.manualTests.get(property.id, criterion.id),
  ]);
  const row = conformance[property.id]?.find((r) => r.criterionId === criterion.id);
  const evidence = manual ? await scope.evidence.list("manual_test", manual.id) : [];
  const canRecord = canRecordManualTests(role);
  const back = `/properties/${property.id}/manual-tests?standard=${standard.id}`;

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: back, label: `Back to manual tests for ${property.name}` }}
        eyebrow={`${property.name} · ${standard.name}`}
        title={criterion.label}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {criterion.level ? (
              <Badge tone="primary">
                Level {criterion.level}
                {criterion.version ? ` · WCAG ${criterion.version}` : ""}
              </Badge>
            ) : null}
            <Badge>{AUTOMATABLE_LABELS[criterion.automatable]}</Badge>
          </div>
        }
      />
      {criterion.pendingReview ? (
        <Alert variant="info">
          {PENDING_REVIEW_LABEL}: {standard.reviewNote}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-3 lg:col-span-3">
          <CardHeader className="mb-2" icon={BookOpen} title="What it means" />
          <p className="leading-relaxed">{criterion.summary}</p>
          {criterion.clause || criterion.affects.length > 0 ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {criterion.clause ? (
                <>
                  <dt className="text-muted-foreground">Clause</dt>
                  <dd>{criterion.clause}</dd>
                </>
              ) : null}
              {criterion.affects.length > 0 ? (
                <>
                  <dt className="text-muted-foreground">Who it affects</dt>
                  <dd>{criterion.affects.join(", ")}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          {criterion.url ? (
            <p>
              <a
                className="inline-flex items-center gap-1.5 font-medium text-primary underline"
                href={criterion.url}
                target="_blank"
                rel="noreferrer"
              >
                Understanding {criterion.id} (W3C, opens in a new tab)
                <ExternalLink className="size-3.5" />
              </a>
            </p>
          ) : null}
        </Card>

        <section aria-labelledby="status-heading" className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader id="status-heading" className="mb-4" title="Current result" />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Result</dt>
                <dd className="mt-0.5 font-medium">
                  {row ? <ConformanceStatusText status={row.status} /> : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Automated checks</dt>
                <dd className="mt-0.5">
                  {row ? AUTOMATED_STATUS_LABELS[row.automated] : "—"}
                  {row && row.violations > 0 ? ` — ${row.violations} unresolved` : ""}
                  {row && row.reviews > 0 ? ` — ${row.reviews} to review` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Manual test</dt>
                <dd className="mt-0.5">
                  {manual && manual.result !== "not_tested" && manual.testedAt
                    ? `Recorded by ${manual.testerName ?? "a former member"} on ${formatDateTime(manual.testedAt)}`
                    : "Not tested yet"}
                </dd>
              </div>
            </dl>
            {criterion.source === "wcag" && row && row.violations + row.reviews > 0 ? (
              <p className="mt-4 border-t border-border-subtle pt-4 text-sm">
                <Link
                  className="font-medium text-primary underline"
                  href={`/properties/${property.id}/issues?criterion=${criterion.id}&type=${row.violations > 0 ? "violations" : "review"}`}
                >
                  See the issues found for {criterion.id}
                </Link>
              </p>
            ) : null}
          </Card>
        </section>
      </div>

      {criterion.checklist ? (
        <section aria-labelledby="how-heading" className="max-w-3xl">
          <Card>
            <CardHeader
              id="how-heading"
              icon={ListOrdered}
              title="How to test"
              description={
                criterion.checklist.tools.length > 0 ? (
                  <>
                    <span className="font-medium text-foreground">You need:</span>{" "}
                    {criterion.checklist.tools.join(", ")}
                  </>
                ) : undefined
              }
            />
            <ol className="space-y-3">
              {criterion.checklist.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="record-heading" className="max-w-3xl">
        <Card>
          <CardHeader id="record-heading" icon={NotebookPen} title="Record the result" />
          {canRecord ? (
            <ManualTestForm
              propertyId={property.id}
              criterionId={criterion.id}
              result={(manual?.result as ManualResult | undefined) ?? "not_tested"}
              notes={manual?.notes ?? ""}
            />
          ) : (
            <div className="space-y-3">
              {manual?.notes ? <p className="whitespace-pre-line">{manual.notes}</p> : null}
              <Alert variant="info">
                Only owners, admins, nodal officers and auditors can record results.
              </Alert>
            </div>
          )}
        </Card>
      </section>

      <section aria-labelledby="evidence-heading" className="max-w-3xl space-y-4">
        <h2 id="evidence-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Paperclip className="size-5 text-muted-foreground" />
          Evidence
        </h2>
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence attached yet.</p>
        ) : (
          <ul className="stagger space-y-3">
            {evidence.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border-subtle bg-card p-4 text-sm shadow-card"
              >
                <div className="flex min-w-0 gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <a
                      className="font-medium break-all text-primary underline"
                      href={`/api/evidence/${file.id}`}
                    >
                      {file.fileName}
                    </a>{" "}
                    <span className="text-muted-foreground">
                      ({Math.max(1, Math.round(file.sizeBytes / 1024))} KB,{" "}
                      {file.uploaderName ?? "a former member"}, {formatDateTime(file.createdAt)})
                    </span>
                    {file.description ? <p className="mt-1">{file.description}</p> : null}
                  </div>
                </div>
                {canRecord ? (
                  <DeleteEvidenceButton evidenceId={file.id} fileName={file.fileName} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canRecord ? (
          <Card>
            <CardHeader as="h3" icon={Upload} title="Attach evidence" className="mb-4" />
            <EvidenceUploadForm propertyId={property.id} criterionId={criterion.id} />
          </Card>
        ) : null}
      </section>
    </div>
  );
}
