import {
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
import { MailOpen, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { CancelInvitationButton } from "@/components/org/cancel-invitation-button";
import { InviteMemberForm } from "@/components/org/invite-member-form";
import { MemberActions } from "@/components/org/member-actions";
import { formatDate } from "@/lib/format";
import { canManageMembers, parseRole, ROLE_LABELS } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const { user, role, scope } = await requireAppContext();
  const canManage = canManageMembers(role);
  const [members, pendingInvitations] = await Promise.all([
    scope.members.list(),
    canManage ? scope.invitations.listPending() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organisation"
        title="Members"
        description="Everyone in this organisation, their role and whether they use two-step verification."
      />

      <section aria-labelledby="members-heading" className="space-y-3">
        <h2 id="members-heading" className="text-lg font-semibold">
          People in this organisation
        </h2>
        <TableContainer>
          <table className={tableClass}>
            <caption className="sr-only">Members of this organisation</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Name
                </th>
                <th scope="col" className={th}>
                  Email
                </th>
                <th scope="col" className={th}>
                  Role
                </th>
                <th scope="col" className={th}>
                  Two-step verification
                </th>
                {canManage ? (
                  <th scope="col" className={th}>
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const memberRole = parseRole(member.role);
                const editable = canManage && memberRole !== "owner" && member.userId !== user.id;
                return (
                  <tr key={member.id}>
                    <th scope="row" className={`${td} text-left font-medium`}>
                      {member.name}
                      {member.userId === user.id ? " (you)" : ""}
                    </th>
                    <td className={`${td} text-muted-foreground`}>{member.email}</td>
                    <td className={td}>
                      <Badge tone="primary">{ROLE_LABELS[memberRole]}</Badge>
                    </td>
                    <td className={td}>
                      {member.twoFactorEnabled ? (
                        <Badge tone="success" icon={ShieldCheck}>
                          On
                        </Badge>
                      ) : (
                        <Badge icon={ShieldOff}>Off</Badge>
                      )}
                    </td>
                    {canManage ? (
                      <td className={td}>
                        {editable ? (
                          <MemberActions
                            memberId={member.id}
                            memberName={member.name}
                            currentRole={memberRole}
                          />
                        ) : (
                          <span className="text-muted-foreground">No actions available</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableContainer>
      </section>

      {canManage ? (
        <>
          <section aria-labelledby="invite-heading">
            <Card className="max-w-2xl">
              <CardHeader
                id="invite-heading"
                icon={UserPlus}
                title="Invite a member"
                description="They get an email with a link to join this organisation."
              />
              <InviteMemberForm />
            </Card>
          </section>

          <section aria-labelledby="pending-heading" className="space-y-3">
            <h2 id="pending-heading" className="text-lg font-semibold">
              Pending invitations
            </h2>
            {pendingInvitations.length === 0 ? (
              <EmptyState icon={MailOpen} title="There are no pending invitations." />
            ) : (
              <TableContainer>
                <table className={tableClass}>
                  <caption className="sr-only">Pending invitations</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={th}>
                        Email
                      </th>
                      <th scope="col" className={th}>
                        Role
                      </th>
                      <th scope="col" className={th}>
                        Expires
                      </th>
                      <th scope="col" className={th}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <th scope="row" className={`${td} text-left font-medium`}>
                          {invitation.email}
                        </th>
                        <td className={td}>
                          <Badge tone="primary">{ROLE_LABELS[parseRole(invitation.role)]}</Badge>
                        </td>
                        <td className={td}>
                          <time dateTime={invitation.expiresAt.toISOString()}>
                            {formatDate(invitation.expiresAt)}
                          </time>
                        </td>
                        <td className={td}>
                          <CancelInvitationButton
                            invitationId={invitation.id}
                            email={invitation.email}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableContainer>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
