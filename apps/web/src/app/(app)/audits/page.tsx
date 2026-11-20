import { getStandard } from "@app/compliance-data";
import { auditDates } from "@app/reports/params";
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
import { ClipboardCheck, ClipboardPlus, Lock, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuditForm } from "@/components/audits/audit-form";
import { canManageAudits } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";

export const metadata: Metadata = { title: "Audits" };

/** Audits by IAAP-certified auditors (spec §8). */
export default async function AuditsPage() {
  const { role, scope } = await requireAppContext();
  const [audits, properties] = await Promise.all([scope.audits.list(), scope.properties.list()]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Audits"
        description="SEBI requires audits by an IAAP-certified accessibility professional. Record each audit here; while it is in progress the auditor records manual test results. Closing an audit locks its findings for the audit summary report."
      />

      <section aria-labelledby="list-heading" className="space-y-3">
        <h2 id="list-heading" className="text-lg font-semibold">
          All audits
        </h2>
        {audits.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No audits yet.">
            Create the first audit below.
          </EmptyState>
        ) : (
          <TableContainer>
            <table className={tableClass}>
              <caption className="sr-only">Audits, newest first</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Audit
                  </th>
                  <th scope="col" className={th}>
                    Auditor
                  </th>
                  <th scope="col" className={th}>
                    Dates
                  </th>
                  <th scope="col" className={th}>
                    Standard
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => (
                  <tr key={audit.id}>
                    <th scope="row" className={`${td} text-left font-normal`}>
                      <Link
                        className="font-medium text-primary underline"
                        href={`/audits/${audit.id}`}
                      >
                        {audit.title}
                      </Link>
                    </th>
                    <td className={td}>
                      {audit.auditorName}
                      <span className="block text-xs text-muted-foreground">
                        IAAP {audit.iaapCertId}
                      </span>
                    </td>
                    <td className={`${td} text-muted-foreground`}>{auditDates(audit)}</td>
                    <td className={td}>
                      {getStandard(audit.standardId)?.shortName ?? audit.standardId}
                    </td>
                    <td className={td}>
                      {audit.status === "closed" ? (
                        <Badge icon={Lock}>Closed (findings locked)</Badge>
                      ) : (
                        <Badge tone="info" icon={Timer}>
                          In progress
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </section>

      <section aria-labelledby="new-heading">
        <Card className="max-w-3xl">
          <CardHeader
            id="new-heading"
            icon={ClipboardPlus}
            title="Create an audit"
            description="Who is auditing, when, against which standard, and which properties."
          />
          {canManageAudits(role) ? (
            <AuditForm properties={properties.map((p) => ({ id: p.id, name: p.name }))} />
          ) : (
            <Alert variant="info">
              Only owners, admins, nodal officers and auditors can create audits.
            </Alert>
          )}
        </Card>
      </section>
    </div>
  );
}
