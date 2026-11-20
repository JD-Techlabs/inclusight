import { Alert, Card } from "@app/ui";
import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Set up two-step verification" };

export default async function TwoFactorSetupPage() {
  const session = await requireUser();

  return (
    <div className="animate-enter">
      <AuthHeading
        icon={KeyRound}
        title="Two-step verification"
        description={
          session.user.twoFactorEnabled
            ? undefined
            : "Owners and admins must use two-step verification. You need an authenticator app such as Google Authenticator, Microsoft Authenticator or Aegis."
        }
      />
      {session.user.twoFactorEnabled ? (
        <div className="space-y-4">
          <Alert variant="success">Two-step verification is turned on for your account.</Alert>
          <p>
            <Link className="font-medium text-primary underline" href="/dashboard">
              Back to the dashboard
            </Link>
          </p>
        </div>
      ) : (
        <Card>
          <TwoFactorSetup />
        </Card>
      )}
    </div>
  );
}
