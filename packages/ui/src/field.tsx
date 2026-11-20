"use client";

import { CircleAlert } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { Input, Select } from "./input";
import { Label } from "./label";

type FieldChrome = {
  label: string;
  hint?: ReactNode;
  error?: string | null;
};

function describedBy(hintId: string, errorId: string, hint: ReactNode, error?: string | null) {
  return [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
}

function FieldMessages(props: { hintId: string; errorId: string } & Omit<FieldChrome, "label">) {
  return (
    <>
      {props.hint ? (
        <p id={props.hintId} className="text-sm text-muted-foreground">
          {props.hint}
        </p>
      ) : null}
      {props.error ? (
        <p
          id={props.errorId}
          className="flex animate-enter items-start gap-1.5 text-sm font-medium text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>Error: {props.error}</span>
        </p>
      ) : null}
    </>
  );
}

/** Labelled text input with programmatically associated hint and error text. */
export function TextField({
  label,
  hint,
  error,
  id,
  ...props
}: FieldChrome & ComponentProps<"input">) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      <FieldMessages hintId={hintId} errorId={errorId} hint={hint} error={error} />
    </div>
  );
}

/** Labelled native select with programmatically associated hint and error text. */
export function SelectField({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: FieldChrome & ComponentProps<"select">) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={selectId}>{label}</Label>
      <Select
        id={selectId}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </Select>
      <FieldMessages hintId={hintId} errorId={errorId} hint={hint} error={error} />
    </div>
  );
}
