import { Card } from "@app/ui";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { TwoFactorVerifyForm } from "@/components/auth/two-factor-verify-form";
import { safeRedirect } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Two-step verification" };

export default async function TwoFactorPage(props: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect: redirectParam } = await props.searchParams;

  return (
    <div className="animate-enter">
      <AuthHeading
        icon={ShieldCheck}
        title="Two-step verification"
        description="One more step to keep your organisation's account secure."
      />
      <Card>
        <TwoFactorVerifyForm redirectTo={safeRedirect(redirectParam)} />
      </Card>
    </div>
  );
}
