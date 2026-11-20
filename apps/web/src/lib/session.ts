import { orgScope } from "@app/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { parseRole, requiresTwoFactor } from "./roles";

export const getSession = cache(async () => {
  // Read the request headers first: this marks the page as dynamic before any runtime
  // configuration is touched, so `next build` works without secrets or a database.
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

/** For pages that need a signed-in user but not (yet) an organisation. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/**
 * For every page inside the app shell: a signed-in user who is a current member of their
 * active organisation, with two-step verification set up where their role requires it.
 * Returns the tenant data-access scope — pages must use it for all organisation data.
 */
export const requireAppContext = cache(async () => {
  const session = await requireUser();
  const orgId = session.session.activeOrganizationId;
  if (!orgId) redirect("/onboarding");

  const scope = orgScope(getDb(), orgId);
  const [membership, organization] = await Promise.all([
    scope.members.findByUserId(session.user.id),
    scope.organization.get(),
  ]);
  if (!membership || !organization) redirect("/onboarding");

  const role = parseRole(membership.role);
  if (requiresTwoFactor(role) && !session.user.twoFactorEnabled) redirect("/two-factor-setup");

  return { user: session.user, role, membershipId: membership.id, organization, scope };
});
