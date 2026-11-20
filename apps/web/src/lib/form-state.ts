/** Result returned by server actions to forms using useActionState. */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
} | null;
