"use client";

import { Button, Label, SelectField } from "@app/ui";
import { useId } from "react";
import { signOffReportAction } from "@/app/(app)/reports/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";
import { SIGN_OFF_DESIGNATIONS } from "@/lib/compliance-input";

/** Records the signed-in person's approval of a report, with their designation. */
export function SignOffForm(props: { reportId: string }) {
  const [state, onSubmit, pending] = useFormAction(signOffReportAction);
  const errors = state?.fieldErrors ?? {};
  const id = useId();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormStatus state={state} />
      <input type="hidden" name="reportId" value={props.reportId} />
      <SelectField
        label="Your designation"
        name="designation"
        defaultValue=""
        error={errors.designation}
      >
        <option value="">Choose</option>
        {SIGN_OFF_DESIGNATIONS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </SelectField>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id={id}
          name="confirm"
          className="mt-0.5 h-5 w-5"
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={errors.confirm ? `${id}-error` : undefined}
        />
        <Label htmlFor={id}>I have reviewed this report and approve it.</Label>
      </div>
      {errors.confirm ? (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          Error: {errors.confirm}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Recording…" : "Record my approval"}
      </Button>
    </form>
  );
}
