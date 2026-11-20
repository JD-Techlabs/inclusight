import { orgScope } from "@app/db";
import { headers } from "next/headers";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { parseRole, requiresTwoFactor } from "./roles";

/**
 * Like requireAppContext(), for route handlers: returns null instead of redirecting when the
 * caller is not a signed-in member of their active organisation (with 2FA where required).
 */
export async function getApiContext() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const orgId = session?.session.activeOrganizationId;
  if (!session || !orgId) return null;
  const scope = orgScope(getDb(), orgId);
  const membership = await scope.members.findByUserId(session.user.id);
  if (!membership) return null;
  const role = parseRole(membership.role);
  if (requiresTwoFactor(role) && !session.user.twoFactorEnabled) return null;
  return { user: session.user, role, scope };
}

export const notFound = () => new Response("Not found", { status: 404 });
