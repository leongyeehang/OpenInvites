import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { user as users } from "@/db/schema";
import { baseUrl } from "@/instance/env";
import { instanceDisplayName } from "@/instance/home";
import { homePage } from "@/instance/repository";
import { sendMail } from "@/mail/send";

type Host = { name: string; email: string };

// Both run inside the request that asked for them, so the mail is in the host's language. Each
// says the instance's name as the operator typed it: the mail is plain text, so nothing escapes it.

const instanceName = async () => instanceDisplayName(await homePage());

export async function sendVerificationEmail({ user, url }: { user: Host; url: string }): Promise<void> {
  const [t, instance] = await Promise.all([getTranslations("Mail.verifyEmail"), instanceName()]);
  await sendMail({ to: user.email, subject: t("subject", { instance }), text: t("body", { name: user.name, instance, url }) });
}

// Better Auth also offers a url, but it points at its own API, which only redirects to the
// reset page. The link goes straight there instead.
export async function sendPasswordResetEmail({ user, token }: { user: Host; token: string }): Promise<void> {
  const [t, instance] = await Promise.all([getTranslations("Mail.resetPassword"), instanceName()]);
  const url = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({ to: user.email, subject: t("subject", { instance }), text: t("body", { name: user.name, instance, url }) });
}

// The plugin asks for a mail to whatever address the request names, but a sign-in link never
// creates an account: an address with no host gets nothing, and the request answers as it does
// for one that has. Nor does a host who has not verified their address get one: the plugin would
// take that for proof of the address, deleting the account's password and logins and skipping the
// operator seat (instance/admission.ts) that verifying by email gives.
export async function sendMagicLinkEmail({ email, url }: { email: string; url: string }): Promise<void> {
  const host = await getDb().query.user.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (!host?.emailVerified) return;
  const [t, instance] = await Promise.all([getTranslations("Mail.magicLink"), instanceName()]);
  await sendMail({ to: host.email, subject: t("subject", { instance }), text: t("body", { name: host.name, instance, url }) });
}
