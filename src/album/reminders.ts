import { and, eq, exists, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { event, photo } from "@/db/schema";
import { eventHosts } from "@/events/hosts";
import type { Event } from "@/events/repository";
import { eventEnd, isDated, type EventTime, type MaybeDated } from "@/events/time";
import { featureOn, siteFeatures } from "@/features";
import { baseUrl } from "@/instance/env";
import { chunks } from "@/lib/chunks";
import { formatSize } from "@/lib/sizes";
import { translatorFor } from "@/locale/messages";
import { isMailConfigured } from "@/mail/config";
import { queueMail, type QueuedMail } from "@/mail/outbox";
import { NO_ITEMS, type AlbumTotals } from "./album";
import { albumTotalsByEvent } from "./repository";

// The album's reminder (M7 ticket 09; spec, "Clearing up"): so many days after an event ends, its
// hosts are reminded once, on their pages and by email, to empty the album or keep it. The clock
// deletes nothing: a person does, after a confirmation that names what goes.

const DAY = 24 * 60 * 60 * 1000;
const BATCH = 1000;

// What deciding an album's reminder needs of its event: when it ends, the host's choice of days,
// whether the hosts were reminded already, and whether the album holds anything.
export type RemindedAlbum = MaybeDated<EventTime> & { id: string; albumReminderDays: number | null; albumRemindedAt: Date | null; items: number };

// The day the reminder is due: the chosen days after the event's end (an all-day event's is the end
// of its day); none when the host chose never, or while a draft has no date.
export function albumReminderDue(found: MaybeDated<EventTime> & { albumReminderDays: number | null }): Date | undefined {
  if (found.albumReminderDays === null || !isDated(found)) return undefined;
  return new Date(eventEnd(found).getTime() + found.albumReminderDays * DAY);
}

// Which events are reminded now: due, holding something, and not reminded before.
export function remindersDue(events: RemindedAlbum[], now: Date): string[] {
  return events
    .filter((each) => {
      const due = albumReminderDue(each);
      return each.albumRemindedAt === null && each.items > 0 && due !== undefined && due.getTime() <= now.getTime();
    })
    .map(({ id }) => id);
}

// The host's choice of days, and the mark taken off when the new day is still ahead, so a longer
// period reminds again on its day (plan ruling 8). Never (null) leaves the mark: the notice goes
// with the choice, and choosing days again whose day has passed shows it again, with no new email.
export async function setAlbumReminder(eventId: string, days: number | null, now: Date): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [found] = await tx
      .select({ startsAt: event.startsAt, endsAt: event.endsAt, allDay: event.allDay, timeZone: event.timeZone })
      .from(event)
      .where(eq(event.id, eventId))
      .for("no key update");
    if (!found) return;
    const due = albumReminderDue({ ...found, albumReminderDays: days });
    await tx
      .update(event)
      .set({ albumReminderDays: days, ...(due && due.getTime() > now.getTime() ? { albumRemindedAt: null } : {}) })
      .where(eq(event.id, eventId));
  });
}

// The clock's sweep, hourly in the app container (mail/worker.ts), with or without mail: one short
// transaction claims the events that may be due, by a superset Postgres finds (the end an event
// keeps is never later than its end; something not failed in the album), which the rule narrows;
// marks them; and with mail queues one email per host in the event's language. The claim skips rows
// another container holds, so each event is reminded once. While the operator has the Album
// switched off nothing is sent or marked (M8 ticket 01), so a reminder that falls due then goes
// out once the album is back.
export async function sendAlbumReminders(now: Date): Promise<void> {
  if (!featureOn(await siteFeatures(), "album")) return;
  await getDb().transaction(async (tx) => {
    const candidates = await tx
      .select({
        id: event.id,
        title: event.title,
        locale: event.locale,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
        timeZone: event.timeZone,
        albumReminderDays: event.albumReminderDays,
        albumRemindedAt: event.albumRemindedAt,
      })
      .from(event)
      .where(
        and(
          isNotNull(event.albumReminderDays),
          isNull(event.albumRemindedAt),
          sql`coalesce(${event.endsAt}, ${event.startsAt}) <= ${now.toISOString()}::timestamptz - ${event.albumReminderDays} * interval '1 day'`,
          exists(
            tx
              .select({ one: sql`1` })
              .from(photo)
              .where(and(eq(photo.eventId, event.id), ne(photo.status, "failed"))),
          ),
        ),
      )
      .for("no key update", { skipLocked: true });
    if (candidates.length === 0) return;
    const totals = await albumTotalsByEvent(
      candidates.map(({ id }) => id),
      tx,
    );
    const itemsOf = (id: string) => totals.get(id) ?? NO_ITEMS;
    const due = remindersDue(
      candidates.map((found) => ({ ...found, items: itemsOf(found.id).photos + itemsOf(found.id).videos })),
      now,
    );
    for (const ids of chunks(due, BATCH)) await tx.update(event).set({ albumRemindedAt: now }).where(inArray(event.id, ids));
    if (!isMailConfigured()) return;
    const reminded = new Set(due);
    for (const batch of chunks(
      candidates.filter(({ id }) => reminded.has(id)),
      BATCH,
    )) {
      const mails = (await Promise.all(batch.map((found) => reminders(found, itemsOf(found.id), tx)))).flat();
      for (const rows of chunks(mails, BATCH)) await queueMail(rows, tx);
    }
  });
}

type Reminded = Pick<Event, "id" | "title" | "locale" | "albumReminderDays">;

// One email to each host, owner and co-hosts, in the language the event was last saved in: what the
// album holds, that nothing goes on its own, the manage page, and how to stop the reminders. Hosts'
// mail carries no stop link; the setting is the way.
async function reminders(found: Reminded, album: AlbumTotals, db: Db): Promise<QueuedMail[]> {
  const t = await translatorFor(found.locale);
  const values = {
    title: found.title,
    photos: album.photos,
    videos: album.videos,
    size: formatSize(album.bytes, found.locale),
    days: found.albumReminderDays ?? 0,
    url: `${baseUrl()}/events/${found.id}`,
  };
  const subject = t("Mail.albumReminder.subject", values);
  const text = t("Mail.albumReminder.body", values);
  return (await eventHosts(found.id, db)).map((host) => ({ eventId: found.id, to: host.email, subject, text }));
}
