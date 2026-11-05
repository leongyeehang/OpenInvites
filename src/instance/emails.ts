import { getTranslations } from "next-intl/server";
import { sendMail } from "@/mail/send";
import { instanceDisplayName } from "./home";
import { homePage } from "./repository";
import { HOST_INVITATION_DAYS } from "./host-invitation";

// Sent while the operator makes the invitation, so it is in the operator's language.
export async function sendHostInvitationEmail(to: string, url: string): Promise<void> {
  const [t, page] = await Promise.all([getTranslations("Mail.hostInvitation"), homePage()]);
  const instance = instanceDisplayName(page);
  await sendMail({ to, subject: t("subject", { instance }), text: t("body", { instance, url, days: HOST_INVITATION_DAYS }) });
}
