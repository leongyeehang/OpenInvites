import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { deleteHostEvents } from "@/events/repository";
import { admitNewHost, seatAdmittedHost } from "@/instance/admission";
import { baseUrl } from "@/instance/env";
import { HOST_INVITATION_COOKIE } from "@/instance/host-invitation-token";
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
    // or GitHub. `before` lets them in or refuses them by the registration mode (instance/
    // admission.ts), reading the host invitation from the cookie its link left, which survives
    // the round trip to Google or GitHub. A refusal is thrown with its code, so the sign-up form
    // and the sign-in page (where a refused social sign-up lands) can each say why. It also fills
    // in a display name when the provider profile had none (GitHub already falls back to the
    // login; this covers the rest, such as Google). `after` makes the first account, or the one
    // OPERATOR_EMAIL names, the operator.
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            const refusal = await admitNewHost(user.email, context?.getCookie(HOST_INVITATION_COOKIE) ?? null);
            if (refusal) throw new APIError("FORBIDDEN", { code: refusal, message: "Signing up here needs a host invitation" });
            return { data: { ...user, name: fallbackDisplayName({ name: user.name, email: user.email }) } };
          },
          after: (user) => seatAdmittedHost(user),
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
