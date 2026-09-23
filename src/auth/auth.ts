import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { deleteHostEvents } from "@/events/repository";
import { admitNewHost, seatAdmittedHost, seatVerifiedHost } from "@/instance/admission";
import { baseUrl } from "@/instance/env";
import { HOST_INVITATION_COOKIE } from "@/instance/host-invitation-token";
import { isMailConfigured } from "@/mail/config";
import { consume, retryAfter, type LimitName } from "@/rate-limit/rate-limit";
import { fallbackDisplayName } from "./display-name";
import { sendPasswordResetEmail, sendVerificationEmail } from "./emails";
import { socialProviders } from "./providers";

// The Better Auth endpoints the rate limits count, whether a form's server action calls them
// (actions.ts) or a request reaches them at /api/auth directly. A refusal is an error with its
// code, which the forms turn into the same sentence as their other errors (errors.ts).
const LIMITED: Record<string, LimitName> = {
  "/sign-up/email": "signUp",
  "/sign-in/email": "signIn",
  "/request-password-reset": "passwordReset",
  "/reset-password": "passwordReset",
};

const countAgainstLimits = createAuthMiddleware(async (context) => {
  const limit = LIMITED[context.path];
  if (!limit) return;
  const verdict = await consume(limit, context.headers ?? new Headers());
  if (!verdict.allowed) {
    throw new APIError("TOO_MANY_REQUESTS", { code: "TOO_MANY_REQUESTS", message: "Too many requests. Try again shortly." }, retryAfter(verdict));
  }
});

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
    // A verified email is what makes the account OPERATOR_EMAIL names the operator (instance/
    // admission.ts); this is where an email and password account gets one.
    emailVerification: mail
      ? { sendVerificationEmail, sendOnSignUp: true, autoSignInAfterVerification: true, afterEmailVerification: seatVerifiedHost }
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
    // login; this covers the rest, such as Google). `after` makes the first account the operator,
    // and the one OPERATOR_EMAIL names too when its email is verified or, without mail, when there
    // is no operator yet.
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
    hooks: { before: countAgainstLimits },
    // The app's RateLimit module keeps every limit and is the one reader of the client address
    // (rate-limit/). Better Auth's own limiter would count requests to /api/auth apart, and
    // would believe a client's own X-Forwarded-For; with it off, Better Auth reads no address at
    // all, so sessions record none.
    rateLimit: { enabled: false },
    // Postgres generates UUIDv7 ids (ADR-0004); Better Auth must not generate its own.
    advanced: { database: { generateId: false }, ipAddress: { disableIpTracking: true } },
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
