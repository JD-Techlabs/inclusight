"use client";

import { Alert, Button, TextField } from "@app/ui";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export function MagicLinkForm({ redirectTo }: { redirectTo: string }) {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setSent(false);
    // The outcome is deliberately not revealed, so the form cannot be used to discover
    // which email addresses have accounts.
    await authClient.signIn.magicLink({
      email: String(form.get("email") ?? ""),
      callbackURL: redirectTo,
    });
    setPending(false);
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {sent ? (
        <Alert variant="success">
          If an account exists for that address, we have sent a sign-in link. It expires in 10
          minutes.
        </Alert>
      ) : null}
      <TextField
        label="Email address for the sign-in link"
        name="email"
        type="email"
        autoComplete="email"
        required
        hint="We will email you a single-use sign-in link. Not available for accounts with two-step verification."
      />
      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
