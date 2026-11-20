import { Alert, Button, Card } from "@app/ui";
import { MailOpen } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { z } from "zod";
import { AuthHeading } from "@/components/auth/auth-heading";
import { InvitationResponse } from "@/components/org/invitation-response";
import { getAuth } from "@/lib/auth";
import { ROLE_LABELS, parseRole } from "@/lib/roles";
import { withRedirect } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Accept invitation" };

const invitationIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

async function loadInvitation(id: string) {
  try {
    return await getAuth().api.getInvitation({ query: { id }, headers: await headers() });
  } catch {
    return null; // not found, expired, already used, or addressed to a different email
  }
}

export default async function AcceptInvitationPage(props: { params: Promise<{ id: string }> }) {
  const parsedId = invitationIdSchema.safeParse((await props.params).id);
  const session = await getSession();
  const here = parsedId.success ? `/accept-invitation/${parsedId.data}` : undefined;

  if (!parsedId.success) {
    return (
      <div className="animate-enter">
        <AuthHeading icon={MailOpen} title="Invitation" />
        <Alert variant="error">This invitation link is not valid.</Alert>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="animate-enter">
        <AuthHeading
          icon={MailOpen}
          title="You have been invited"
          description="To accept, sign in or create an account using the email address the invitation was sent to."
        />
        <Card>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={withRedirect("/sign-up", here)}>Create an account</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={withRedirect("/sign-in", here)}>Sign in</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const invitation = await loadInvitation(parsedId.data);

  return (
    <div className="animate-enter">
      <AuthHeading icon={MailOpen} title="Invitation" />
      {invitation && invitation.status === "pending" ? (
        <Card className="space-y-4">
          <p>
            You have been invited to join <strong>{invitation.organizationName}</strong> as{" "}
            <strong>{ROLE_LABELS[parseRole(invitation.role)]}</strong>.
          </p>
          <InvitationResponse invitationId={invitation.id} />
        </Card>
      ) : (
        <Alert variant="error">
          This invitation is no longer available. It may have expired, been cancelled or already
          used, or it was sent to a different email address than the one you are signed in with.
        </Alert>
      )}
    </div>
  );
}
