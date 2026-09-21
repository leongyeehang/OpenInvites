import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { baseUrl } from "@/instance/env";
import { isMailConfigured } from "@/mail/config";
import { sendPasswordResetEmail, sendVerificationEmail } from "./emails";

// Hosts are Better Auth users. Email and password is always on; other login methods are
// plugins added by later tickets. What mail changes is decided here, once: with SMTP,
// hosts verify their address and reset passwords by email; without it, neither exists.
function createAuth() {
  const mail = isMailConfigured();
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
    user: {
      changeEmail: { enabled: true, updateEmailWithoutVerification: !mail },
      deleteUser: { enabled: true },
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
