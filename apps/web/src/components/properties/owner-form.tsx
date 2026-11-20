"use client";

import { Button, SelectField } from "@app/ui";
import { setPropertyOwnerAction } from "@/app/(app)/properties/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";

/** Chooses the member responsible for the property (platform inventory). */
export function OwnerForm(props: {
  propertyId: string;
  ownerId: string | null;
  members: Array<{ userId: string; name: string }>;
}) {
  const [state, onSubmit, pending] = useFormAction(setPropertyOwnerAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormStatus state={state} />
      <input type="hidden" name="propertyId" value={props.propertyId} />
      <SelectField
        label="Responsible person"
        name="ownerId"
        defaultValue={props.ownerId ?? ""}
        hint="Shown as the owner in the platform inventory report."
        error={state?.fieldErrors?.ownerId}
      >
        <option value="">Not assigned</option>
        {props.members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save owner"}
      </Button>
    </form>
  );
}
