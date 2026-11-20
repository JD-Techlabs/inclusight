import { CONFORMANCE_STATUSES, getStandard } from "@app/compliance-data";
import { auditDates } from "@app/reports/params";
import { loadAuditSnapshot, type AuditSnapshot } from "@app/reports/snapshot";
import {
  Alert,
  Badge,
  buttonVariants,
  Card,
  CardHeader,
  PageHeader,
  TableContainer,
  tableClass,
  td,
  th,
} from "@app/ui";
import { ClipboardList, FileText, Lock, PencilLine, Timer, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AuditForm } from "@/components/audits/audit-form";
import { CloseAuditForm } from "@/components/audits/close-audit-form";
import { ConformanceStatusText } from "@/components/compliance/conformance-status";
import { formatDateTime } from "@/lib/format";
import { canGenerateReports, canManageAudits } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";

export const metadata: Metadata = { title: "Audit" };

export default async function AuditPage(props: { params: Promise<{ auditId: string }> }) {
  const { role, scope } = await requireAppContext();
  const id = z
    .string()
    .min(1)
    .max(100)
    .safeParse((await props.params).auditId);
  const found = id.success ? await scope.audits.get(id.data) : null;
  if (!found) notFound();
  const { audit, closedByName } = found;
  const closed = audit.status === "closed";
  // Closed: the locked snapshot. In progress: a live preview of what closing would lock.
  const snapshot =
    (audit.snapshot as AuditSnapshot | null) ?? (await loadAuditSnapshot(scope, audit));
  const standard = getStandard(audit.standardId);
  const counts = CONFORMANCE_STATUSES.map((status) => ({
    status,
    perProperty: snapshot.properties.map(
      (p) => (snapshot.conformance[p.id] ?? []).filter((r) => r.status === status).length,
    ),
  }));
  const properties = await scope.properties.list();

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/audits", label: "Back to audits" }}
        eyebrow="Audit"
        title={audit.title}
        meta={
          closed ? (
            <Badge icon={Lock}>Closed</Badge>
          ) : (
            <Badge tone="info" icon={Timer}>
              In progress
            </Badge>
          )
        }
      />

      <Card className="max-w-3xl">
        <CardHeader icon={UserCheck} title="Audit details" />
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Auditor</dt>
          <dd className="font-medium">
            {audit.auditorName}, {audit.auditorOrg}
          </dd>
          <dt className="text-muted-foreground">IAAP certification</dt>
          <dd className="font-medium">{audit.iaapCertId}</dd>
          <dt className="text-muted-foreground">Dates</dt>
          <dd className="font-medium">{auditDates(audit)}</dd>
          <dt className="text-muted-foreground">Standard</dt>
          <dd className="font-medium">{standard?.name ?? audit.standardId}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium" data-testid="audit-status">
            {closed
              ? `Closed on ${formatDateTime(audit.closedAt!)} by ${closedByName ?? "a former member"}; findings locked`
              : "In progress"}
          </dd>
        </dl>
      </Card>

      <section aria-labelledby="scope-heading" className="space-y-4">
        <div className="space-y-1">
          <h2 id="scope-heading" className="text-lg font-semibold">
            {closed ? "Locked results" : "Results so far"}
          </h2>
          {!closed ? (
            <p className="text-sm text-muted-foreground">
              A live preview. Closing the audit locks these results.
            </p>
          ) : null}
        </div>
        <TableContainer>
          <table className={tableClass}>
            <caption className="sr-only">
              Number of {standard?.shortName} criteria by result for each property
            </caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Result
                </th>
                {snapshot.properties.map((p) => (
                  <th key={p.id} scope="col" className={th}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {counts.map((row) => (
                <tr key={row.status}>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    <ConformanceStatusText status={row.status} />
                  </th>
                  {row.perProperty.map((n, i) => (
                    <td key={snapshot.properties[i]!.id} className={`${td} font-semibold`}>
                      {n}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
        <div className="flex flex-wrap items-center gap-2">
          {snapshot.properties.map((p) => (
            <Link
              key={p.id}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
              href={`/properties/${p.id}/manual-tests?standard=${audit.standardId}`}
            >
              <ClipboardList />
              Manual tests for {p.name}
            </Link>
          ))}
          {canGenerateReports(role) ? (
            <Link
              className={buttonVariants({ size: "sm" })}
              href={`/reports?type=audit_summary&auditId=${audit.id}`}
            >
              <FileText />
              Generate the audit summary report
            </Link>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Manual results recorded:{" "}
          {snapshot.manualTests.filter((m) => m.result !== "not_tested").length}. Evidence files:{" "}
          {snapshot.evidenceFiles}.
        </p>
      </section>

      {!closed && canManageAudits(role) ? (
        <div className="max-w-3xl space-y-6">
          <section aria-labelledby="edit-heading">
            <Card>
              <CardHeader id="edit-heading" icon={PencilLine} title="Edit audit details" />
              <AuditForm
                auditId={audit.id}
                properties={properties.map((p) => ({ id: p.id, name: p.name }))}
                values={{
                  title: audit.title,
                  auditorName: audit.auditorName,
                  iaapCertId: audit.iaapCertId,
                  auditorOrg: audit.auditorOrg,
                  startDate: audit.startDate,
                  endDate: audit.endDate ?? "",
                  standardId: audit.standardId,
                  propertyIds: audit.propertyIds,
                  methodology: audit.methodology,
                }}
              />
            </Card>
          </section>
          <section aria-labelledby="close-heading">
            <Card className="border-warning/40">
              <CardHeader
                id="close-heading"
                icon={Lock}
                title="Close the audit"
                description="When testing is complete, close the audit to lock its findings, conformance and manual results. Later scans and test results do not change a closed audit."
              />
              <CloseAuditForm auditId={audit.id} />
            </Card>
          </section>
        </div>
      ) : null}
      {!closed && !canManageAudits(role) ? (
        <Alert variant="info">
          Only owners, admins, nodal officers and auditors can edit or close audits.
        </Alert>
      ) : null}
    </div>
  );
}
