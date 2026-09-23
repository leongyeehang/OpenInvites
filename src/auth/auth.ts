import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { deleteHostEvents } from "@/events/repository";
import { baseUrl } from "@/instance/env";
import { isMailConfigured } from "@/mail/config";
import { fallbackDisplayName } from "./display-name";
import { sendPasswordResetEmail, sendVerificationEmail } from "./emails";
import { socialProviders } from "./providers";

// Hosts are Better Auth users. Email and password is always on; Google and GitHub join only
// when the operator has configured them (src/auth/providers.ts). What mail changes is decided
// here, once: with SMTP, hosts verify their address and reset passwords by email; without it,
// neither exists.
function createAuth() {
  const mail = isMailConfigured();
  const providers = socialProviders();
  return betterAuth({
    baseURL: baseUrl(),
    secret: process.env.AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      sendResetPassword: mail ? sendPasswordResetEmail : undefined,
    },
    emailVerification: mail
      ? { sendVerificationEmail, sendOnSignUp: true, autoSignInAfterVerification: true }
      : undefined,
    // Better Auth's own default account linking applies unmodified: a provider's email links
    // to an existing host only when the provider reports it verified and the host's own email
    // is already verified too. Nothing here widens that (no trustedProviders, no
    // allowDifferentEmails) — spec, "Identity and access".
    socialProviders: {
      ...(providers.google ? { google: providers.google } : {}),
      ...(providers.github ? { github: providers.github } : {}),
    },
    user: {
      changeEmail: { enabled: true, updateEmailWithoutVerification: !mail },
      // The host's events would cascade with the account in the database, but their uploaded
      // files are not in it: the events go first, through the one path that removes those too.
      deleteUser: { enabled: true, beforeDelete: (host) => deleteHostEvents(host.id) },
    },
    // Every new host is created here, whichever way they signed up: email and password, Google,
    // or GitHub. For ticket 04: this is the one place to gate new sign-ups by registration mode
    // (Open vs Invitation only) — return `false` from `before` to refuse creation. This ticket
    // adds no such gating. The hook also fills in a display name when the provider profile had
    // none (GitHub already falls back to the login; this covers the rest, such as Google).
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: { ...user, name: fallbackDisplayName({ name: user.name, email: user.email }) } }),
        },
      },
    },
    // Postgres generates UUIDv7 ids (ADR-0004); Better Auth must not generate its own.
    advanced: { database: { generateId: false } },
    // Nothing leaves the instance (ADR-0005). Better Auth's telemetry is off by default; said explicitly.
    telemetry: { enabled: false },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Created on first use, not at import: `next build` loads route modules without a database.
let auth: Auth | undefined;

export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}
