"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { user } from "@/db/schema";
import { isMailConfigured } from "@/mail/config";
import { getAuth } from "./auth";
import { authErrorMessage } from "./errors";
import { type Host, requireHost } from "./session";

// What a form gets back: nothing on success (the action redirects), or one message.
export type FormState = { error?: string; success?: string } | undefined;

// The Next.js guide's caveat: redirect() throws, so it stays outside every try/catch below.

const VERIFY_EMAIL_CALLBACK = "/verify-email";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const name = field(formData, "name").trim();
  if (!name) {
    const t = await getTranslations("Auth.errors");
    return { error: t("displayNameRequired") };
  }
  try {
    await getAuth().api.signUpEmail({
      body: {
        name,
        email: field(formData, "email").trim(),
        password: field(formData, "password"),
        callbackURL: VERIFY_EMAIL_CALLBACK,
      },
      headers: await headers(),
    });
  } catch (error) {
    return { error: await authErrorMessage(error) };
  }
  redirect("/dashboard");
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await getAuth().api.signInEmail({
      body: { email: field(formData, "email").trim(), password: field(formData, "password") },
      headers: await headers(),
    });
  } catch (error) {
    return { error: await authErrorMessage(error) };
  }
  redirect("/dashboard");
}

// Signs out this device only; sessions on other devices stay valid.
export async function signOut(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("Auth.forgotPassword");
  try {
    await getAuth().api.requestPasswordReset({
      body: { email: field(formData, "email").trim() },
      headers: await headers(),
    });
  } catch (error) {
    return { error: await authErrorMessage(error) };
  }
  // The same answer whether or not the account exists.
  return { success: t("sent") };
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await getAuth().api.resetPassword({
      body: { token: field(formData, "token"), newPassword: field(formData, "password") },
      headers: await headers(),
    });
  } catch (error) {
    return { error: await authErrorMessage(error) };
  }
  redirect("/sign-in?passwordChanged=1");
}

export async function resendVerificationEmail(): Promise<FormState> {
  const host = await requireHost();
  const t = await getTranslations("Auth.banner");
  try {
    await getAuth().api.sendVerificationEmail({
      body: { email: host.email, callbackURL: VERIFY_EMAIL_CALLBACK },
      headers: await headers(),
    });
  } catch (error) {
    return { error: await authErrorMessage(error) };
  }
  return { success: t("sent") };
}

export async function updateDisplayName(_: FormState, formData: FormData): Promise<FormState> {
  await requireHost();
  const name = field(formData, "name").trim();
  const t = await getTranslations("Account.displayName");
  if (!name) {
    const errors = await getTranslations("Auth.errors");
    return { error: errors("displayNameRequired") };
  }
  try {
    await getAuth().api.updateUser({ body: { name }, headers: await headers() });
  } catch (error) {
    return { error: await authErrorMessage(error) };
  }
  revalidatePath("/", "layout");
  return { success: t("saved") };
}

// With SMTP the new address gets a confirmation link and the change lands when it is opened;
// without SMTP the change is immediate.
export async function changeEmail(_: FormState, formData: FormData): Promise<FormState> {
  const host = await requireHost();
  const newEmail = field(formData, "email").trim().toLowerCase();
  const t = await getTranslations("Account.email");
  if (!isMailConfigured()) {
    const failure = await changeEmailWithoutMail(host, newEmail);
    if (failure) return failure;
    revalidatePath("/", "layout");
    return { success: t("changed") };
  }
  try {
    await getAuth().api.changeEmail({
      body: { newEmail, callbackURL: VERIFY_EMAIL_CALLBACK },
      headers: await headers(),
    });
  } catch (error) {
    return { error: await authErrorMessage(error) };
  }
  revalidatePath("/", "layout");
  return { success: t("verificationSent", { email: newEmail }) };
}

// Verification is skipped entirely without SMTP (spec, "Identity and access"). Better Auth will
// not drop a verified address without sending mail, so this branch writes the row itself.
async function changeEmailWithoutMail(host: Host, newEmail: string): Promise<FormState> {
  const errors = await getTranslations("Auth.errors");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return { error: errors("INVALID_EMAIL") };
  const db = getDb();
  const taken = await db.query.user.findFirst({ where: eq(user.email, newEmail) });
  if (taken && taken.id !== host.id) return { error: errors("USER_ALREADY_EXISTS") };
  await db
    .update(user)
    .set({ email: newEmail, emailVerified: false, updatedAt: new Date() })
    .where(eq(user.id, host.id));
  return undefined;
}

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  await requireHost();
  const t = await getTranslations("Account.password");
  try {
    await getAuth().api.changePassword({
      body: {
        currentPassword: field(formData, "currentPassword"),
        newPassword: field(formData, "newPassword"),
        revokeOtherSessions: false,
      },
      headers: await headers(),
    });
  } catch (error) {
    return { error: await authErrorMessage(error) };
  }
  return { success: t("changed") };
}

// Better Auth removes the account and every session with it. Events and RSVPs cascade
// through the database once they exist (ticket 16 verifies it).
export async function deleteAccount(_: FormState, formData: FormData): Promise<FormState> {
  await requireHost();
  try {
    await getAuth().api.deleteUser({
      body: { password: field(formData, "password") },
      headers: await headers(),
    });
  } catch (error) {
    return { error: await authErrorMessage(error) };
  }
  redirect("/sign-in?accountDeleted=1");
}
