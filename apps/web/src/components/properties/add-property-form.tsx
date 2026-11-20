"use client";

import { Button, TextField } from "@app/ui";
import { createPropertyAction } from "@/app/(app)/properties/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";

export function AddPropertyForm() {
  const [state, onSubmit, pending] = useFormAction(createPropertyAction);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormStatus state={state} />
      <TextField
        label="Name"
        name="name"
        required
        maxLength={120}
        error={state?.fieldErrors?.name}
      />
      <TextField
        label="Website address"
        name="baseUrl"
        type="text"
        inputMode="url"
        autoComplete="url"
        required
        hint="For example https://www.example.com. Only scan websites your organisation owns."
        error={state?.fieldErrors?.baseUrl}
      />
      <div className="flex items-start gap-2">
        <input
          id="isInvestorFacing"
          name="isInvestorFacing"
          type="checkbox"
          defaultChecked
          className="mt-1 h-5 w-5"
        />
        <label htmlFor="isInvestorFacing" className="text-sm">
          Investor-facing (in scope of the SEBI accessibility requirements)
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add property"}
      </Button>
    </form>
  );
}
