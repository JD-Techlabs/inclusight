"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/lib/form-state";

/**
 * useActionState without React 19's automatic form reset. The reset would wipe what the
 * user typed whenever validation fails, forcing them to enter it again (WCAG 3.3.7), and can
 * desynchronise controlled radios from what is submitted.
 */
export function useFormAction(
  action: (state: FormState, form: FormData) => Promise<FormState>,
): [FormState, (event: FormEvent<HTMLFormElement>) => void, boolean] {
  const [state, dispatch, pending] = useActionState(action, null);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
  return [state, onSubmit, pending];
}
