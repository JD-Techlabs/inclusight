import { Card } from "@app/ui";
import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { safeRedirect, withRedirect } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage(props: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect: redirectParam } = await props.searchParams;
  const redirectTo = safeRedirect(redirectParam, "/onboarding");
  if (await getSession()) redirect(redirectTo);
  const carried = redirectParam ? redirectTo : undefined;

  return (
    <div className="animate-enter">
      <AuthHeading
        icon={UserPlus}
        title="Create an account"
        description="Use your work email. You can create your organisation or accept an invitation next."
      />
      <Card>
        <SignUpForm redirectTo={redirectTo} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          className="font-medium text-primary underline"
          href={withRedirect("/sign-in", carried)}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
