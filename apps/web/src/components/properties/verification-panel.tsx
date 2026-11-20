"use client";

import { Button, choiceCardClasses } from "@app/ui";
import { useId, useState } from "react";
import { verifyPropertyAction } from "@/app/(app)/properties/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";

export type VerificationOption = { method: string; label: string; where: string; value: string };

/** Lets an owner/admin prove control of the domain with one of three methods (spec §7.1). */
export function VerificationPanel(props: { propertyId: string; options: VerificationOption[] }) {
  const [state, onSubmit, pending] = useFormAction(verifyPropertyAction);
  const [method, setMethod] = useState(props.options[0]?.method ?? "");
  const selected = props.options.find((option) => option.method === method);
  const groupId = useId();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormStatus state={state} />
      <input type="hidden" name="propertyId" value={props.propertyId} />
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Verification method</legend>
        {props.options.map((option) => (
          <div key={option.method} className={`${choiceCardClasses} items-center`}>
            <input
              type="radio"
              id={`${groupId}-${option.method}`}
              name="method"
              value={option.method}
              checked={method === option.method}
              onChange={() => setMethod(option.method)}
              className="h-5 w-5"
            />
            <label htmlFor={`${groupId}-${option.method}`} className="text-sm font-medium">
              {option.label}
            </label>
          </div>
        ))}
      </fieldset>
      {selected ? (
        <div className="animate-enter space-y-2 rounded-lg border border-border-subtle bg-muted/60 p-4 text-sm">
          <p>
            <strong>Where:</strong> {selected.where}
          </p>
          <p>
            <strong>Value:</strong>{" "}
            <code
              data-testid="verification-value"
              className="rounded bg-card px-1.5 py-0.5 font-mono break-all"
            >
              {selected.value}
            </code>
          </p>
        </div>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Verify domain"}
      </Button>
    </form>
  );
}
