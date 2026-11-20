"use client";

import type { Role } from "@app/db/domain";
import { Alert, Button, Select } from "@app/ui";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { authClient, errorMessage } from "@/lib/auth-client";
import { ASSIGNABLE_ROLES, parseRole, ROLE_LABELS } from "@/lib/roles";

/** Per-member role change and removal. Rendered only for members the viewer may manage. */
export function MemberActions(props: { memberId: string; memberName: string; currentRole: Role }) {
  const router = useRouter();
  const selectId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function updateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const role = parseRole(new FormData(event.currentTarget).get("role"));
    if (role === "owner") return;
    setPending(true);
    setError(null);
    const result = await authClient.organization.updateMemberRole({
      memberId: props.memberId,
      role,
    });
    setPending(false);
    if (result.error) setError(errorMessage(result.error));
    else router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Remove ${props.memberName} from this organisation?`)) return;
    setPending(true);
    setError(null);
    const result = await authClient.organization.removeMember({ memberIdOrEmail: props.memberId });
    setPending(false);
    if (result.error) setError(errorMessage(result.error));
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <form onSubmit={updateRole} className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="sr-only">
          Role for {props.memberName}
        </label>
        <Select id={selectId} name="role" defaultValue={props.currentRole} className="w-auto">
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" disabled={pending}>
          Update role<span className="sr-only"> for {props.memberName}</span>
        </Button>
        <Button variant="destructive" disabled={pending} onClick={remove}>
          Remove<span className="sr-only"> {props.memberName}</span>
        </Button>
      </form>
    </div>
  );
}
