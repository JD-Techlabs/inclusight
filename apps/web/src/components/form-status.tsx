import { Alert } from "@app/ui";
import type { FormState } from "@/lib/form-state";

/** Form-level error/success message. Field errors are shown next to their fields. */
export function FormStatus({ state }: { state: FormState }) {
  if (state?.error) return <Alert variant="error">{state.error}</Alert>;
  if (state?.success) return <Alert variant="success">{state.success}</Alert>;
  if (state?.fieldErrors && Object.keys(state.fieldErrors).length > 0) {
    return <Alert variant="error">Please correct the highlighted fields.</Alert>;
  }
  return null;
}
