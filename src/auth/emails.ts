import { getTranslations } from "next-intl/server";
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
