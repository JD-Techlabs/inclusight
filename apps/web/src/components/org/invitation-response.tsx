"use client";

import { Alert, Button } from "@app/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, errorMessage } from "@/lib/auth-client";

export function InvitationResponse({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function respond(accept: boolean) {
    setPending(true);
    setError(null);
    const result = accept
      ? await authClient.organization.acceptInvitation({ invitationId })
      : await authClient.organization.rejectInvitation({ invitationId });
    if (result.error) {
      setPending(false);
      setError(errorMessage(result.error));
      return;
    }
    router.push(accept ? "/dashboard" : "/onboarding");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={pending} onClick={() => respond(true)}>
          Accept invitation
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => respond(false)}>
          Decline
        </Button>
      </div>
    </div>
  );
}
