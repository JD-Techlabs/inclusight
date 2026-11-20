"use client";

import { Button, TextField } from "@app/ui";
import { deletePropertyAction } from "@/app/(app)/properties/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";

export function DeletePropertyForm(props: { propertyId: string; name: string }) {
  const [state, onSubmit, pending] = useFormAction(deletePropertyAction);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormStatus state={state} />
      <input type="hidden" name="propertyId" value={props.propertyId} />
      <TextField
        label={`Type "${props.name}" to confirm`}
        name="confirmName"
        autoComplete="off"
        required
        hint="This permanently deletes the property with all its scans, issues and screenshots records."
        error={state?.fieldErrors?.confirmName}
      />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Deleting…" : "Delete property"}
      </Button>
    </form>
  );
}
