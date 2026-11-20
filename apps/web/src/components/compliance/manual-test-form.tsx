"use client";

import {
  MANUAL_RESULT_LABELS,
  MANUAL_RESULTS,
  type ManualResult,
} from "@app/compliance-data/client";
import { Button, choiceCardClasses, Label, Textarea } from "@app/ui";
import { useId } from "react";
import { recordManualTestAction } from "@/app/(app)/properties/[propertyId]/manual-tests/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";

const HINTS: Record<ManualResult, string> = {
  pass: "The criterion is met everywhere you tested.",
  fail: "At least one part of the content does not meet it.",
  not_applicable: "The content does not use what the criterion is about (for example, no video).",
  not_tested: "Clears an earlier result.",
};

/** Records a manual result and notes for one criterion on one property. */
export function ManualTestForm(props: {
  propertyId: string;
  criterionId: string;
  result: ManualResult;
  notes: string;
}) {
  const [state, onSubmit, pending] = useFormAction(recordManualTestAction);
  const errors = state?.fieldErrors ?? {};
  const id = useId();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormStatus state={state} />
      <input type="hidden" name="propertyId" value={props.propertyId} />
      <input type="hidden" name="criterionId" value={props.criterionId} />
      <fieldset
        className="grid gap-2 sm:grid-cols-2"
        aria-describedby={errors.result ? `${id}-result-error` : undefined}
      >
        <legend className="mb-2 font-medium">Result</legend>
        {MANUAL_RESULTS.map((result) => (
          <div key={result} className={choiceCardClasses}>
            <input
              type="radio"
              id={`${id}-${result}`}
              name="result"
              value={result}
              defaultChecked={props.result === result}
              aria-describedby={`${id}-${result}-hint`}
              className="mt-0.5 h-5 w-5"
            />
            <div>
              <Label htmlFor={`${id}-${result}`}>{MANUAL_RESULT_LABELS[result]}</Label>
              <p id={`${id}-${result}-hint`} className="text-sm text-muted-foreground">
                {HINTS[result]}
              </p>
            </div>
          </div>
        ))}
        {errors.result ? (
          <p
            id={`${id}-result-error`}
            className="text-sm font-medium text-destructive sm:col-span-2"
          >
            Error: {errors.result}
          </p>
        ) : null}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-notes`}>Notes</Label>
        <Textarea
          id={`${id}-notes`}
          name="notes"
          rows={4}
          maxLength={5000}
          defaultValue={props.notes}
          aria-describedby={`${id}-notes-hint${errors.notes ? ` ${id}-notes-error` : ""}`}
          aria-invalid={errors.notes ? true : undefined}
        />
        <p id={`${id}-notes-hint`} className="text-sm text-muted-foreground">
          What you tested, with which tools, and what you found. Do not include personal data.
        </p>
        {errors.notes ? (
          <p id={`${id}-notes-error`} className="text-sm font-medium text-destructive">
            Error: {errors.notes}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save result"}
      </Button>
    </form>
  );
}
