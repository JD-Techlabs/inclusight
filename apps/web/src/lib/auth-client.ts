"use client";

import {
  inferOrgAdditionalFields,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "./auth";
import { ac, orgRoles } from "./roles";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac,
      roles: orgRoles,
      schema: inferOrgAdditionalFields<Auth>(),
    }),
    twoFactorClient(),
    magicLinkClient(),
  ],
});

/** Normalises an auth client error into a message that is safe and useful to show. */
export function errorMessage(error: { message?: string } | null | undefined): string {
  return error?.message?.trim() || "Something went wrong. Please try again.";
}
