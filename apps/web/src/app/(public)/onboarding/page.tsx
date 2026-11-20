import { listOrganizationsForUser } from "@app/db";
import { Card, CardHeader } from "@app/ui";
import { Building2, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CreateOrganizationForm } from "@/components/org/create-organization-form";
import { OrganizationSwitchList } from "@/components/org/organization-switch-list";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, parseRole } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Set up your organisation" };

export default async function OnboardingPage() {
  const session = await requireUser();
  const organizations = await listOrganizationsForUser(getDb(), session.user.id);

  return (
    <div className="animate-enter space-y-6">
      <AuthHeading
        icon={Sparkles}
        title="Set up your organisation"
        description="Open an organisation you belong to, or create a new one."
      />
      {organizations.length > 0 ? (
        <Card>
          <CardHeader icon={Building2} title="Your organisations" />
          <OrganizationSwitchList
            organizations={organizations.map((org) => ({
              id: org.id,
              name: org.name,
              roleLabel: ROLE_LABELS[parseRole(org.role)],
            }))}
          />
        </Card>
      ) : null}
      <Card>
        <CardHeader
          icon={Plus}
          title="Create an organisation"
          description="You will be its owner. Owners and admins must turn on two-step verification."
        />
        <CreateOrganizationForm />
      </Card>
      <SignOutButton />
    </div>
  );
}
