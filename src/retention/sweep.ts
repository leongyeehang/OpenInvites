import { and, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event, instanceSettings } from "@/db/schema";
import { eventHosts } from "@/events/hosts";
import { removeEvents, type Event } from "@/events/repository";
import { formatDay } from "@/events/time";
import { baseUrl } from "@/instance/env";
import { translatorFor } from "@/locale/messages";
import { isMailConfigured } from "@/mail/config";
import { queueMail, type QueuedMail } from "@/mail/outbox";
import { deletionDate, retentionPlan, WARNING_DAYS } from "./plan";

const DAY = 24 * 60 * 60 * 1000;

// The clock's sweep (spec, "Retention"), at most once an hour in each app container, with or
// without mail (mail/worker.ts). One short transaction reads the period, claims the events that may
// be old enough, marks those whose hosts are now to be warned, queues the warnings when the
// instance has mail, and commits. The marked events show the day they will be deleted to their
// hosts whether or not an email told them. The events whose time has come are then deleted through
// the one removal (events/repository.ts), in its own transaction, so the sweep holds no row it
// locks. The claim skips rows another transaction holds, as the outbox's does: two containers on
// one database may sweep at once, and each event is marked once; a removal that finds its event
// already gone does nothing.
export async function sweepRetention(now: Date): Promise<void> {
  const due = await getDb().transaction(async (tx) => {
    const [{ retentionDays }] = await tx.select({ retentionDays: instanceSettings.retentionDays }).from(instanceSettings);
    if (retentionDays === null) return [];
    // A superset for Postgres to find, which retentionPlan narrows: the end an event keeps (its
    // start, without one) is never later than its end, which for an all-day event is the end of its
    // day. Marked events are claimed only once their mark is old enough to delete them.
    const warnFrom = new Date(now.getTime() - (retentionDays - WARNING_DAYS) * DAY);
    const candidates = await tx
      .select({
        id: event.id,
        title: event.title,
        locale: event.locale,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
        timeZone: event.timeZone,
        retentionWarnedAt: event.retentionWarnedAt,
      })
      .from(event)
      .where(
        and(
          sql`coalesce(${event.endsAt}, ${event.startsAt}) <= ${warnFrom.toISOString()}::timestamptz`,
          or(isNull(event.retentionWarnedAt), lte(event.retentionWarnedAt, new Date(now.getTime() - WARNING_DAYS * DAY))),
        ),
      )
      .for("update", { skipLocked: true });
    const plan = retentionPlan(candidates, now, retentionDays);
    if (plan.warn.length > 0) {
      await tx.update(event).set({ retentionWarnedAt: now }).where(inArray(event.id, plan.warn));
      if (isMailConfigured()) {
        const warned = candidates.filter(({ id }) => plan.warn.includes(id)).map((found) => ({ ...found, retentionWarnedAt: now }));
        await queueMail((await Promise.all(warned.map((found) => warnings(found, retentionDays)))).flat(), tx);
      }
    }
    return plan.remove;
  });
  if (due.length > 0) await removeEvents(inArray(event.id, due));
}

type Warned = Pick<Event, "id" | "title" | "locale" | "startsAt" | "endsAt" | "allDay" | "timeZone"> & { retentionWarnedAt: Date };

// One email to each host of a marked event, owner and co-hosts, in the language the event was last
// saved in: its title, the day it will be deleted (in its own zone), the instance's period, that
// Duplicate keeps its details, and its manage page.
async function warnings(found: Warned, retentionDays: number): Promise<QueuedMail[]> {
  const t = await translatorFor(found.locale);
  const values = {
    title: found.title,
    date: formatDay(deletionDate(found, retentionDays)!, found.timeZone, found.locale),
    days: retentionDays,
    url: `${baseUrl()}/events/${found.id}`,
  };
  const subject = t("Mail.retentionWarning.subject", values);
  const text = t("Mail.retentionWarning.body", values);
  return (await eventHosts(found.id)).map((host) => ({ eventId: found.id, to: host.email, subject, text }));
}
