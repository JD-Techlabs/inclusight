import {
  ENTITY_TYPES,
  REPORTING_AUTHORITIES,
  listOrganizationsForUser,
  orgScope,
  schema,
} from "@app/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization, twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AUDITED_PATHS, auditEventFor, clientIp } from "./audit-events";
import { getDb } from "./db";
import { env } from "./env";
import { sendEmail } from "./mailer";
import { ac, orgRoles, ROLE_LABELS, parseRole } from "./roles";

const APP_NAME = "A11yComply";

function createAuth() {
  const e = env();
  const db = getDb();

  return betterAuth({
    appName: APP_NAME,
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        organization: schema.organizations,
        member: schema.memberships,
        invitation: schema.invitations,
        twoFactor: schema.twoFactors,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 12, // sessions time out after 12 hours without activity
      updateAge: 60 * 60,
    },
    databaseHooks: {
      session: {
        create: {
          // New sessions start in the user's first organisation, if they have one.
          before: async (session) => {
            const orgs = await listOrganizationsForUser(db, session.userId);
            return { data: { ...session, activeOrganizationId: orgs[0]?.id ?? null } };
          },
        },
      },
    },
    hooks: {
      // Audit-log every successful organisation-management action (spec §16).
      after: createAuthMiddleware(async (ctx) => {
        if (!AUDITED_PATHS.includes(ctx.path)) return;
        const event = auditEventFor(ctx.path, ctx.context.returned);
        if (!event) return;
        const session = await getSessionFromCtx(ctx);
        await orgScope(db, event.orgId).auditLog.record({
          ...event.entry,
          actorId: session?.user.id ?? null,
          ip: clientIp(ctx.headers),
        });
      }),
    },
    plugins: [
      organization({
        ac,
        roles: orgRoles,
        creatorRole: "owner",
        disableOrganizationDeletion: true,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        cancelPendingInvitationsOnReInvite: true,
        schema: {
          organization: {
            additionalFields: {
              entityType: {
                type: "string",
                required: false,
                defaultValue: "other",
                validator: { input: z.enum(ENTITY_TYPES) },
              },
              reportingAuthority: {
                type: "string",
                required: false,
                defaultValue: "other",
                validator: { input: z.enum(REPORTING_AUTHORITIES) },
              },
            },
          },
        },
        sendInvitationEmail: async (data) => {
          await sendEmail({
            to: data.email,
            subject: `You have been invited to ${data.organization.name} on ${APP_NAME}`,
            paragraphs: [
              `${data.inviter.user.name} has invited you to join ${data.organization.name} on ${APP_NAME} as ${ROLE_LABELS[parseRole(data.role)]}.`,
              "This invitation expires in 7 days. If you were not expecting it, you can ignore this email.",
            ],
            link: {
              label: "Accept the invitation",
              url: `${e.APP_URL}/accept-invitation/${data.id}`,
            },
          });
        },
      }),
      twoFactor({ issuer: APP_NAME }),
      magicLink({
        disableSignUp: true,
        expiresIn: 60 * 10,
        sendMagicLink: async ({ email, url }) => {
          // A magic link would skip the TOTP step, so accounts with two-step verification
          // never receive one (docs/DECISIONS.md D-006).
          const [user] = await db
            .select({ twoFactorEnabled: schema.users.twoFactorEnabled })
            .from(schema.users)
            .where(eq(schema.users.email, email.toLowerCase()));
          if (user?.twoFactorEnabled) {
            await sendEmail({
              to: email,
              subject: `Sign in to ${APP_NAME}`,
              paragraphs: [
                "Email sign-in links are turned off for accounts that use two-step verification.",
                "Please sign in with your password and your authenticator code instead.",
              ],
              link: { label: "Go to sign in", url: `${e.APP_URL}/sign-in` },
            });
            return;
          }
          await sendEmail({
            to: email,
            subject: `Your ${APP_NAME} sign-in link`,
            paragraphs: [
              "Use the link below to sign in. It expires in 10 minutes and can be used once.",
              "If you did not request this, you can ignore this email.",
            ],
            link: { label: `Sign in to ${APP_NAME}`, url },
          });
        },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __a11yAuth?: Auth };

/** Lazy singleton so `next build` does not need runtime secrets or a database. */
export function getAuth(): Auth {
  globalForAuth.__a11yAuth ??= createAuth();
  return globalForAuth.__a11yAuth;
}
