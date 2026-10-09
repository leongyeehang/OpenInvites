import { getTranslations } from "next-intl/server";
import { after } from "next/server";
import { baseUrl } from "@/instance/env";
import { operatorEmail } from "@/instance/repository";
import { isMailConfigured } from "@/mail/config";
import { queueMail } from "@/mail/outbox";
import { kickMailWorker } from "@/mail/worker";

// Emails the operator account about a report, when the instance has mail and an operator
// (spec, "Report an event"). The mail is in English, the language of the operator's documentation,
// whatever the reporter's. It never throws: the report is already saved, and a failure here must
// not tell the reporter otherwise, so it is logged instead.
export async function notifyOperatorOfReport(
  found: { id: string; title: string; slug: string },
  report: { reason: string; contact: string | null },
): Promise<void> {
  if (!isMailConfigured()) return;
  try {
    const to = await operatorEmail();
    if (!to) return;
    const t = await getTranslations({ locale: "en", namespace: "Mail.report" });
    const values = {
      title: found.title,
      url: `${baseUrl()}/e/${found.slug}`,
      reason: report.reason,
      contact: report.contact ?? t("noContact"),
      reportsUrl: `${baseUrl()}/instance/reports`,
    };
    await queueMail([{ eventId: found.id, to, subject: t("subject", values), text: t("body", values) }]);
    after(kickMailWorker);
  } catch (error) {
    console.error(`Mail: could not queue the operator's email about a report on event ${found.id}:`, error);
  }
}
