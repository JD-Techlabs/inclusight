"use client";

import { Alert, Button } from "@app/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, errorMessage } from "@/lib/auth-client";

export function CancelInvitationButton(props: { invitationId: string; email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function cancel() {
    setPending(true);
    setError(null);
    const result = await authClient.organization.cancelInvitation({
      invitationId: props.invitationId,
    });
    setPending(false);
    if (result.error) setError(errorMessage(result.error));
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button variant="secondary" disabled={pending} onClick={cancel}>
        Cancel invitation<span className="sr-only"> for {props.email}</span>
      </Button>
    </div>
  );
}
