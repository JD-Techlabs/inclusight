"use client";

import { Alert, Button, TextField } from "@app/ui";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { authClient, errorMessage } from "@/lib/auth-client";

type Enrolment = { secret: string; qrDataUrl: string; backupCodes: string[] };

/**
 * Two steps: (1) confirm password to get a setup key, (2) confirm a code from the app.
 * The setup key is shown as text as well as a QR code, so it works without a camera.
 */
export function TwoFactorSetup() {
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setPending(true);
    setError(null);
    const result = await authClient.twoFactor.enable({ password });
    if (result.error || !result.data || !("totpURI" in result.data)) {
      setPending(false);
      setError(errorMessage(result.error));
      return;
    }
    const { totpURI, backupCodes } = result.data;
    setEnrolment({
      secret: new URL(totpURI).searchParams.get("secret") ?? "",
      qrDataUrl: await QRCode.toDataURL(totpURI, { margin: 2, width: 200 }),
      backupCodes,
    });
    setPending(false);
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s+/g, "");
    setPending(true);
    setError(null);
    const result = await authClient.twoFactor.verifyTotp({ code });
    if (result.error) {
      setPending(false);
      setError(errorMessage(result.error));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (!enrolment) {
    return (
      <form onSubmit={start} className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <TextField
          label="Confirm your password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Starting…" : "Start setup"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="tfa-step-1" className="space-y-3">
        <h2 id="tfa-step-1" className="text-lg font-semibold">
          Step 1: Add the account to your authenticator app
        </h2>
        <p className="text-sm">Scan the QR code, or type the setup key into your app.</p>
        <img
          src={enrolment.qrDataUrl}
          width={200}
          height={200}
          className="rounded-xl border border-border-subtle bg-white p-2 shadow-card"
          alt="QR code for your authenticator app. The same information is in the setup key below."
        />
        <p className="text-sm">
          Setup key:{" "}
          <code
            data-testid="totp-secret"
            className="rounded-md bg-muted px-2 py-1 font-mono break-all"
          >
            {enrolment.secret}
          </code>
        </p>
      </section>

      <section aria-labelledby="tfa-step-2" className="space-y-3">
        <h2 id="tfa-step-2" className="text-lg font-semibold">
          Step 2: Save your backup codes
        </h2>
        <p className="text-sm">
          Each code works once if you lose your device. Store them somewhere safe; they are not
          shown again.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border-subtle bg-muted/60 p-3 font-mono text-sm">
          {enrolment.backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tfa-step-3" className="space-y-3">
        <h2 id="tfa-step-3" className="text-lg font-semibold">
          Step 3: Enter a code to finish
        </h2>
        <form onSubmit={confirm} className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <TextField
            label="6-digit code from your app"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Verifying…" : "Turn on two-step verification"}
          </Button>
        </form>
      </section>
    </div>
  );
}
