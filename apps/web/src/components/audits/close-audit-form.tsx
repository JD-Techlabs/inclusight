"use client";

import { Button, Label } from "@app/ui";
import { useId } from "react";
import { closeAuditAction } from "@/app/(app)/audits/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";

/** Closing locks the findings; an explicit confirmation guards against doing it by accident. */
export function CloseAuditForm(props: { auditId: string }) {
  const [state, onSubmit, pending] = useFormAction(closeAuditAction);
  const error = state?.fieldErrors?.confirm;
  const id = useId();

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="auditId" value={props.auditId} />
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id={id}
          name="confirm"
          className="mt-0.5 h-5 w-5"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Label htmlFor={id}>
          I understand that closing locks the findings, conformance and manual results, and the
          audit cannot be edited afterwards.
        </Label>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          Error: {error}
        </p>
      ) : null}
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Closing…" : "Close audit and lock findings"}
      </Button>
    </form>
  );
}
