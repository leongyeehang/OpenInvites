"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireHost } from "@/auth/session";
import { findHostEvent } from "@/events/repository";
import { can } from "@/hosts/role";
import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/uuid";
import { isMailConfigured } from "@/mail/config";
import { queueGuestMail } from "@/mail/queue-guest-mail";
import { consume } from "@/rate-limit/rate-limit";
import { recipients } from "@/rsvps/audience";
import { listMailableRsvps } from "@/rsvps/repository";
import { DEFAULT_AUDIENCE, parseAnnouncement } from "./announcement";
import { createAnnouncement, deleteAnnouncement } from "./repository";

// The host posts an announcement to the event page and emails it to the guests they picked by
// status (spec, "Announcements").
export async function postAnnouncementAction(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  const [host, t] = await Promise.all([requireHost(), getTranslations("Announcements")]);
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "announcements")) return { error: t("errors.notFound") };

  // Without mail there is nobody to email, and the form's checkboxes are disabled, so they post
  // nothing: the announcement is for the page alone, and keeps the form's default audience.
  const mail = isMailConfigured();
  const body = formData.get("body");
  const parsed = parseAnnouncement({
    body: typeof body === "string" ? body : "",
    audience: mail ? formData.getAll("audience").map((value) => (typeof value === "string" ? value : "")) : [...DEFAULT_AUDIENCE],
  });
  if (!parsed.ok) return { error: t(`errors.${parsed.error}`) };

  // Emailing it counts once against the mail limit, however many guests it reaches, and before
  // anything is written, so a refused post can simply be sent again. One that reaches nobody sends
  // no mail, and is not counted.
  const guests = mail ? recipients(await listMailableRsvps(event.id), parsed.announcement.audience) : [];
  if (guests.length > 0 && !(await consume("mail", await headers())).allowed) return { error: t("errors.tooFast") };

  const posted = await createAnnouncement(event.id, parsed.announcement);
  if (!posted) return { error: t("errors.tooMany") };
  // The host's words as written, under a subject and above a footer in the language each guest
  // replied in (spec, "Guest mail"). A failure to queue is logged, and the post stands.
  const values = { title: event.title };
  await queueGuestMail(
    event,
    guests,
    (_, theirs) => ({ subject: theirs("Mail.announcement.subject", values), body: posted.body }),
    "an announcement to",
  );
  revalidatePath(`/events/${event.id}/announcements`);
  return { success: mail ? t("sent", { count: guests.length }) : t("postedNoMail") };
}

// It comes off the event page; the guests who were emailed keep their email.
export async function deleteAnnouncementAction(eventId: string, id: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "announcements") || !isUuid(id)) return;
  await deleteAnnouncement(event.id, id);
  revalidatePath(`/events/${event.id}/announcements`);
}
