"use client";

import {
  ENTITY_TYPES,
  REPORTING_AUTHORITIES,
  type EntityType,
  type ReportingAuthority,
} from "@app/db/domain";
import { Alert, Button, SelectField, TextField } from "@app/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient, errorMessage } from "@/lib/auth-client";
import {
  ENTITY_TYPE_LABELS,
  organizationSlug,
  REPORTING_AUTHORITY_LABELS,
} from "@/lib/org-options";

function randomSuffix(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function CreateOrganizationForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    setPending(true);
    setError(null);
    const result = await authClient.organization.create({
      name,
      slug: organizationSlug(name, randomSuffix()),
      entityType: String(form.get("entityType")) as EntityType,
      reportingAuthority: String(form.get("reportingAuthority")) as ReportingAuthority,
    });
    if (result.error) {
      setPending(false);
      setError(errorMessage(result.error));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <TextField
        label="Organisation name"
        name="name"
        autoComplete="organization"
        required
        maxLength={120}
      />
      <SelectField label="Type of regulated entity" name="entityType" defaultValue="other" required>
        {ENTITY_TYPES.map((type) => (
          <option key={type} value={type}>
            {ENTITY_TYPE_LABELS[type]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Reporting authority"
        name="reportingAuthority"
        defaultValue="other"
        required
        hint="Where your annual accessibility compliance report is submitted."
      >
        {REPORTING_AUTHORITIES.map((authority) => (
          <option key={authority} value={authority}>
            {REPORTING_AUTHORITY_LABELS[authority]}
          </option>
        ))}
      </SelectField>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create organisation"}
      </Button>
    </form>
  );
}
