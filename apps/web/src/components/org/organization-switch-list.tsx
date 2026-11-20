"use client";

import { Alert, Button } from "@app/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, errorMessage } from "@/lib/auth-client";

type Item = { id: string; name: string; roleLabel: string };

export function OrganizationSwitchList({ organizations }: { organizations: Item[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function open(organizationId: string) {
    setPendingId(organizationId);
    setError(null);
    const result = await authClient.organization.setActive({ organizationId });
    if (result.error) {
      setPendingId(null);
      setError(errorMessage(result.error));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <ul className="space-y-2">
        {organizations.map((org) => (
          <li
            key={org.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle px-4 py-3"
          >
            <span className="min-w-0">
              <span className="block font-medium break-words">{org.name}</span>
              <span className="block text-sm text-muted-foreground">({org.roleLabel})</span>
            </span>
            <Button variant="secondary" disabled={pendingId !== null} onClick={() => open(org.id)}>
              Open<span className="sr-only"> {org.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
