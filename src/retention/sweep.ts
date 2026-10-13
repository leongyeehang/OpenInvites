import { and, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { event, instanceSettings } from "@/db/schema";
import { eventHosts } from "@/events/hosts";
import { removeEvents, type Event } from "@/events/repository";
import { formatDay } from "@/events/time";
import { baseUrl } from "@/instance/env";
import { chunks } from "@/lib/chunks";
import { translatorFor } from "@/locale/messages";
import { isMailConfigured } from "@/mail/config";
import { queueMail, type QueuedMail } from "@/mail/outbox";
import { retentionFloorDays } from "./floor";
import { deletionDate, retentionPlan, WARNING_DAYS } from "./plan";

const DAY = 24 * 60 * 60 * 1000;

// Events marked or deleted, and emails queued, per statement: well under the parameters Postgres
// binds in one, however many events an upgrade finds old.
const BATCH = 1000;

// The clock's sweep (spec, "Retention"), at most once an hour in each app container, with or
// without mail (mail/worker.ts). One short transaction reads the period, claims the events that may
// be old enough, marks those whose hosts are now to be warned, queues the warnings when the
// instance has mail, and commits. The marked events show the day they will be deleted to their
// hosts whether or not an email told them. The events whose time has come are then deleted through
// the one removal (events/repository.ts), a batch at a time, each in its own transaction, so the
// sweep holds no row it locks. The claim skips rows another transaction holds, as the reminders'
// does: two containers on one database may sweep at once, and each event is marked once; a removal
// that finds its event already gone does nothing.
export async function sweepRetention(now: Date): Promise<void> {
  const floorDays = retentionFloorDays();
  const { due, retentionDays } = await getDb().transaction(async (tx) => {
    // Held shared until the commit, so an operator saving a period or Keep forever meanwhile waits
    // for it, then finds the marks made here and takes off those the new period does not bear out
    // (instance/repository.ts).
    const [{ retentionDays }] = await tx.select({ retentionDays: instanceSettings.retentionDays }).from(instanceSettings).for("share");
    if (retentionDays === null) return { due: [], retentionDays };
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
          or(isNull(event.retentionWarnedAt), lte(event.retentionWarnedAt, new Date(now.getTime() - floorDays * DAY))),
        ),
      )
      .for("no key update", { skipLocked: true });
    const plan = retentionPlan(candidates, now, retentionDays, floorDays);
    for (const ids of chunks(plan.warn, BATCH)) await tx.update(event).set({ retentionWarnedAt: now }).where(inArray(event.id, ids));
    if (isMailConfigured()) {
      const warned = new Set(plan.warn);
      const marked = candidates.filter(({ id }) => warned.has(id)).map((found) => ({ ...found, retentionWarnedAt: now }));
      for (const batch of chunks(marked, BATCH)) {
        const mails = (await Promise.all(batch.map((found) => warnings(found, retentionDays, floorDays, tx)))).flat();
        for (const rows of chunks(mails, BATCH)) await queueMail(rows, tx);
      }
    }
    return { due: plan.remove, retentionDays };
  });
  // The removal locks each event again and reads it under that lock: an event whose mark has gone
  // since this sweep committed (Keep forever, a longer period, new dates), or a period now longer
  // than the one the plan read, or none, keeps it until the next sweep decides again.
  for (const ids of chunks(due, BATCH)) {
    await removeEvents(
      and(
        inArray(event.id, ids),
        lte(event.retentionWarnedAt, new Date(now.getTime() - floorDays * DAY)),
        sql`(select ${instanceSettings.retentionDays} from ${instanceSettings}) <= ${retentionDays}`,
      ),
    );
  }
}

type Warned = Pick<Event, "id" | "title" | "locale" | "startsAt" | "endsAt" | "allDay" | "timeZone"> & { retentionWarnedAt: Date };

// One email to each host of a marked event, owner and co-hosts, in the language the event was last
// saved in: its title, the day it will be deleted (in its own zone), the instance's period, that
// Duplicate keeps its details, and its manage page. The hosts are read in the sweep's transaction.
async function warnings(found: Warned, retentionDays: number, floorDays: number, db: Db): Promise<QueuedMail[]> {
  const t = await translatorFor(found.locale);
  const values = {
    title: found.title,
    date: formatDay(deletionDate(found, retentionDays, floorDays)!, found.timeZone, found.locale),
    days: retentionDays,
    url: `${baseUrl()}/events/${found.id}`,
  };
  const subject = t("Mail.retentionWarning.subject", values);
  const text = t("Mail.retentionWarning.body", values);
  return (await eventHosts(found.id, db)).map((host) => ({ eventId: found.id, to: host.email, subject, text }));
}
