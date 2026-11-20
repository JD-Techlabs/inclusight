import { Card } from "@app/ui";
import { LogIn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth/auth-heading";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeRedirect, withRedirect } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(props: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect: redirectParam } = await props.searchParams;
  const redirectTo = safeRedirect(redirectParam);
  if (await getSession()) redirect(redirectTo);
  const carried = redirectParam ? redirectTo : undefined;

  return (
    <div className="animate-enter">
      <AuthHeading
        icon={LogIn}
        title="Sign in"
        description="Welcome back. Sign in to your organisation's accessibility compliance workspace."
      />
      <Card className="space-y-6">
        <div>
          <h2 className="mb-4 text-base font-semibold">With your password</h2>
          <SignInForm redirectTo={redirectTo} />
        </div>
        <div aria-hidden="true" className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border-subtle" />
          or
          <span className="h-px flex-1 bg-border-subtle" />
        </div>
        <div>
          <h2 className="mb-4 text-base font-semibold">With an email link</h2>
          <MagicLinkForm redirectTo={redirectTo} />
        </div>
      </Card>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to A11yComply?{" "}
        <Link
          className="font-medium text-primary underline"
          href={withRedirect("/sign-up", carried)}
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
