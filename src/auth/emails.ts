import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { user as users } from "@/db/schema";
import { baseUrl } from "@/instance/env";
import { sendMail } from "@/mail/send";

type Host = { name: string; email: string };

// Both run inside the request that asked for them, so the mail is in the host's language.

export async function sendVerificationEmail({ user, url }: { user: Host; url: string }): Promise<void> {
  const t = await getTranslations("Mail.verifyEmail");
  await sendMail({ to: user.email, subject: t("subject"), text: t("body", { name: user.name, url }) });
}

// Better Auth also offers a url, but it points at its own API, which only redirects to the
// reset page. The link goes straight there instead.
export async function sendPasswordResetEmail({ user, token }: { user: Host; token: string }): Promise<void> {
  const t = await getTranslations("Mail.resetPassword");
  const url = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({ to: user.email, subject: t("subject"), text: t("body", { name: user.name, url }) });
}

// The plugin asks for a mail to whatever address the request names, but a sign-in link never
// creates an account: an address with no host gets nothing, and the request answers as it does
// for one that has. Nor does a host who has not verified their address get one: the plugin would
// take that for proof of the address, deleting the account's password and logins and skipping the
// operator seat (instance/admission.ts) that verifying by email gives.
export async function sendMagicLinkEmail({ email, url }: { email: string; url: string }): Promise<void> {
  const host = await getDb().query.user.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (!host?.emailVerified) return;
  const t = await getTranslations("Mail.magicLink");
  await sendMail({ to: host.email, subject: t("subject"), text: t("body", { name: host.name, url }) });
}
