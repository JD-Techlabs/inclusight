import { Alert, EmptyState, PageHeader, TableContainer, tableClass, td, th } from "@app/ui";
import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { auditActionLabel, describeAuditDetails } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/format";
import { canViewAuditLog } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage() {
  const { role, scope } = await requireAppContext();

  if (!canViewAuditLog(role)) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Organisation" title="Audit log" />
        <Alert variant="error">Your role does not have access to the audit log.</Alert>
      </div>
    );
  }

  const entries = await scope.auditLog.list({ limit: 200 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title="Audit log"
        description="The 200 most recent sensitive actions in this organisation, newest first."
      />
      {entries.length === 0 ? (
        <EmptyState icon={ScrollText} title="No actions have been recorded yet." />
      ) : (
        <TableContainer>
          <table className={tableClass}>
            <caption className="sr-only">Audit log entries, newest first</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  When
                </th>
                <th scope="col" className={th}>
                  Who
                </th>
                <th scope="col" className={th}>
                  Action
                </th>
                <th scope="col" className={th}>
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className={`${td} whitespace-nowrap text-muted-foreground`}>
                    <time dateTime={entry.createdAt.toISOString()}>
                      {formatDateTime(entry.createdAt)}
                    </time>
                  </td>
                  <td className={`${td} font-medium`}>
                    {entry.actorName ?? "Unknown or removed user"}
                  </td>
                  <td className={td}>{auditActionLabel(entry.action)}</td>
                  <td className={`${td} text-muted-foreground`}>
                    {describeAuditDetails(entry.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}
    </div>
  );
}
