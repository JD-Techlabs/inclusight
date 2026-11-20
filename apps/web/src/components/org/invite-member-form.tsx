"use client";

import { Alert, Button, SelectField, TextField } from "@app/ui";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { authClient, errorMessage } from "@/lib/auth-client";
import { ASSIGNABLE_ROLES, parseRole, ROLE_LABELS } from "@/lib/roles";

export function InviteMemberForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const role = parseRole(form.get("role"));
    if (role === "owner") return;
    setPending(true);
    setError(null);
    setSentTo(null);
    const result = await authClient.organization.inviteMember({ email, role });
    setPending(false);
    if (result.error) {
      setError(errorMessage(result.error));
      return;
    }
    setSentTo(email);
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {sentTo ? <Alert variant="success">Invitation sent to {sentTo}.</Alert> : null}
      <TextField label="Email address" name="email" type="email" autoComplete="off" required />
      <SelectField
        label="Role"
        name="role"
        defaultValue="viewer"
        required
        hint="Admins can manage members. Admins must use two-step verification."
      >
        {ASSIGNABLE_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </SelectField>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
