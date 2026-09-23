"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireOperator } from "@/auth/session";
import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/uuid";
import { isMailConfigured } from "@/mail/config";
import { consume } from "@/rate-limit/rate-limit";
import { sendHostInvitationEmail } from "./emails";
import { generateHostInvitationToken, hashHostInvitationToken, hostInvitationLink } from "./host-invitation-token";
import { isRegistrationMode } from "./registration";
import { createHostInvitation, revokeHostInvitation, setRegistrationMode } from "./repository";

// Every action here is the operator's alone; anyone else is told the page does not exist.

// Read on every sign-up, so a change takes effect at once, without a restart.
export async function setRegistrationModeAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireOperator();
  const t = await getTranslations("Instance.registration");
  const mode = formData.get("mode");
  if (!isRegistrationMode(mode)) return { error: t("unknown") };
  await setRegistrationMode(mode);
  revalidatePath("/instance");
  return { success: t("saved") };
}

// The link is handed back to the operator's page this once; only its hash is kept.
export type HostInvitationFormState = { error?: string; link?: string; sentTo?: string } | undefined;

export async function createHostInvitationAction(_: HostInvitationFormState, formData: FormData): Promise<HostInvitationFormState> {
  await requireOperator();
  const t = await getTranslations("Instance.invitations");
  const posted = formData.get("email");
  const email = typeof posted === "string" ? posted.trim().toLowerCase() : "";
  // The box is only offered when the instance has mail; without it there is nothing to send with.
  const send = formData.get("send") === "on" && isMailConfigured();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t("invalidEmail") };
  if (send && !email) return { error: t("emailToSend") };
  // Sending it is mail like any other, counted before the invitation is made.
  if (send && !(await consume("mail", await headers())).allowed) return { error: t("tooFast") };

  const token = generateHostInvitationToken();
  await createHostInvitation(hashHostInvitationToken(token), email || null, new Date());
  revalidatePath("/instance");
  const link = hostInvitationLink(token);
  if (!send) return { link };
  try {
    await sendHostInvitationEmail(email, link);
  } catch (error) {
    console.error(error);
    return { link, error: t("notSent") };
  }
  return { link, sentTo: email };
}

export async function revokeHostInvitationAction(id: string): Promise<void> {
  await requireOperator();
  if (!isUuid(id)) return;
  await revokeHostInvitation(id, new Date());
  revalidatePath("/instance");
}
