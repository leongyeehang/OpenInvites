import { and, asc, eq, gt, isNull, lte, or, type Column, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event } from "@/db/schema";
import type { Event } from "@/events/repository";
import { formatWhen } from "@/events/time";
import { baseUrl } from "@/instance/env";
import type { Translator } from "@/locale/messages";
import { guestMails, type GuestMailContent } from "@/mail/guest-mail";
import { queueMail } from "@/mail/outbox";
import { recipients } from "@/rsvps/audience";
import { listMailableRsvps, type MailableRsvp } from "@/rsvps/repository";
import { REMINDERS, remindersDue, type ReminderKind } from "./due";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// An all-day event's reminders fall at midnight in its zone, which a clock change moves by up to
// two hours against the start less whole days.
const CLOCK_CHANGE = 2 * HOUR;

// The events that may have a reminder due now, for Postgres to find; remindersDue decides. A
// reminder falls due so many days before the start and stays due for a day, so its event starts
// within that day's span from now: (now, now + 1 day] for the day reminder, (now + 6 days, now + 7
// days] for the week reminder.
function mayBeDue(now: Date): SQL | undefined {
  const within = (daysBefore: number, sentAt: Column) =>
    and(
      isNull(sentAt),
      gt(event.startsAt, new Date(now.getTime() + (daysBefore - 1) * DAY - CLOCK_CHANGE)),
      lte(event.startsAt, new Date(now.getTime() + daysBefore * DAY + CLOCK_CHANGE)),
    );
  return and(
    eq(event.state, "published"),
    eq(event.remindersEnabled, true),
    or(within(REMINDERS.week.daysBefore, event.weekReminderSentAt), within(REMINDERS.day.daysBefore, event.dayReminderSentAt)),
  );
}

// Queues every reminder due now (spec, "Automatic reminders"). The mail worker calls it at the
// start of each run, before it sends, so a reminder goes out in the run that queues it. Events are
// taken soonest first. A failure is logged and leaves the event for the next run; the other events
// go on.
export async function queueDueReminders(now: Date): Promise<void> {
  const candidates = await getDb()
    .select({ id: event.id })
    .from(event)
    .where(mayBeDue(now))
    .orderBy(asc(event.startsAt), asc(event.id));
  for (const { id } of candidates) {
    try {
      await remind(id, now);
    } catch (error) {
      console.error(`Mail: could not queue the reminders for event ${id}:`, error);
    }
  }
}

// One event's due reminders, queued and marked sent in one transaction, which claims the event's
// row first. Another app container on the same database skips a row that is claimed, and finds
// the mark once it is free, so a reminder is sent once. The claim is NO KEY UPDATE, which guests'
// RSVPs (whose foreign key takes KEY SHARE) do not wait for. The mark is set even when no guest is
// reminded: guests who reply after a reminder was sent do not get it.
async function remind(id: string, now: Date): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [claimed] = await tx
      .select()
      .from(event)
      .where(and(eq(event.id, id), mayBeDue(now)))
      .for("no key update", { skipLocked: true });
    if (!claimed) return;
    const due = remindersDue(claimed, now);
    if (due.length === 0) return;

    const rsvps = await listMailableRsvps(claimed.id, tx);
    const mails = await Promise.all(
      due.map((kind) => guestMails(claimed, recipients(rsvps, [REMINDERS[kind].status]), (guest, t) => reminder(kind, claimed, guest, t))),
    );
    await queueMail(mails.flat(), tx);
    await tx
      .update(event)
      .set({
        weekReminderSentAt: due.includes("week") ? now : claimed.weekReminderSentAt,
        dayReminderSentAt: due.includes("day") ? now : claimed.dayReminderSentAt,
      })
      .where(eq(event.id, claimed.id));
  });
}

const MESSAGES = { week: "reminderWeek", day: "reminderDay" } as const;

// The reminder to one guest, in the language they replied in: the title, when in the event's zone
// (the guest's own is unknown), where when there is a place, their reply, and the event link.
function reminder(
  kind: ReminderKind,
  event: Pick<Event, "title" | "slug" | "startsAt" | "endsAt" | "allDay" | "timeZone" | "location">,
  guest: MailableRsvp,
  t: Translator,
): GuestMailContent {
  const values = {
    title: event.title,
    when: formatWhen(event, guest.locale),
    located: event.location ? "yes" : "no",
    location: event.location,
    plusOnes: guest.plusOnes,
    url: `${baseUrl()}/e/${event.slug}`,
  };
  return { subject: t(`Mail.${MESSAGES[kind]}.subject`, values), body: t(`Mail.${MESSAGES[kind]}.body`, values) };
}
