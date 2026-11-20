"use client";

import { Alert, Button, TextField } from "@app/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient, errorMessage } from "@/lib/auth-client";

/** Second sign-in step. Accepts a 6-digit authenticator code or a backup code. */
export function TwoFactorVerifyForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s+/g, "");
    setPending(true);
    setError(null);
    const result = /^\d{6}$/.test(code)
      ? await authClient.twoFactor.verifyTotp({ code })
      : await authClient.twoFactor.verifyBackupCode({ code });
    if (result.error) {
      setPending(false);
      setError(errorMessage(result.error));
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <TextField
        label="Verification code"
        name="code"
        inputMode="text"
        autoComplete="one-time-code"
        required
        hint="Enter the 6-digit code from your authenticator app, or one of your backup codes."
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verifying…" : "Verify"}
      </Button>
    </form>
  );
}
