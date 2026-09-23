import { getTranslations } from "next-intl/server";
import { sendMail } from "@/mail/send";
import { HOST_INVITATION_DAYS } from "./host-invitation";

// Sent while the operator makes the invitation, so it is in the operator's language.
export async function sendHostInvitationEmail(to: string, url: string): Promise<void> {
  const t = await getTranslations("Mail.hostInvitation");
  await sendMail({ to, subject: t("subject"), text: t("body", { url, days: HOST_INVITATION_DAYS }) });
}
