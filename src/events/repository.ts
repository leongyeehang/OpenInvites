import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { event, retiredSlug, upload, user } from "@/db/schema";
import { hostedBy } from "@/hosts/repository";
import { roleOf, type Role } from "@/hosts/role";
import { isUuid } from "@/lib/uuid";
import type { Locale } from "@/locale/resolve-locale";
import { DEFAULT_THEME, parseTheme, type Theme } from "@/themes/theme";
import { approvePending, promoteWaitlist } from "@/rsvps/repository";
import { removeRenditions } from "@/uploads/files";
import type { EventInput } from "./form";
import { SLUG_TAKEN, withFreshSlug } from "./slug";
import { eventEnd } from "./time";

export type Event = typeof event.$inferSelect;
export type EventState = Event["state"];
// An event as one of its hosts finds it: with what they are to it, owner or co-host.
export type HostEvent = Event & { role: Role };

// Every read goes through here: the stored theme is completed by parseTheme, so rows from before
// themes existed, or from a newer version, come back as a whole Theme.
function withTheme<T extends { theme: unknown }>(row: T): T {
  return { ...row, theme: parseTheme(row.theme) };
}

const UNIQUE_VIOLATION = "23505";

// Drizzle wraps the driver's error; the Postgres fields are on its cause. Named exactly, because
// the retired slugs table has a unique constraint with "slug" in its name too.
const EVENT_SLUG_UNIQUES = ["event_slug_unique", "event_custom_slug_unique"];

function isSlugCollision(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  if (typeof cause !== "object" || cause === null) return false;
  const { code, constraint_name } = cause as { code?: string; constraint_name?: string };
  return code === UNIQUE_VIOLATION && constraint_name !== undefined && EVENT_SLUG_UNIQUES.includes(constraint_name);
}

// What saving the event form writes: the form, and the language it was saved in.
export type EventChanges = EventInput & { locale: Locale };

// A new event starts with the Birthday template's theme (ticket 06), unless it is given one: a
// duplicate starts with the theme of the event it copies.
export async function createEvent(hostId: string, input: EventChanges & { theme?: Theme }): Promise<Event> {
  return withFreshSlug(async (slug) => {
    try {
      const [created] = await getDb().insert(event).values({ hostId, slug, theme: DEFAULT_THEME, ...input }).returning();
      return withTheme(created);
    } catch (error) {
      if (isSlugCollision(error)) return SLUG_TAKEN;
      throw error;
    }
  });
}

// The one gate (spec, "Co-hosts"): scoped to the host, it finds an event they own or co-host, with
// their role, and nothing for anyone else. Every host page and event action comes through here,
// and each action then asks can(role, action) (hosts/role.ts); the writes below are scoped the same
// way. Cached per request, as generateMetadata and the page both ask. An id from the address bar
// that is not a UUID finds nothing, as Postgres would refuse it, so the host's pages show
// not-found for it.
export const findHostEvent = cache(async (hostId: string, id: string): Promise<HostEvent | undefined> => {
  if (!isUuid(id)) return undefined;
  const found = await getDb().query.event.findFirst({ where: and(eq(event.id, id), hostedBy(hostId)) });
  return found && { ...withTheme(found), role: roleOf(found, hostId) };
});

// One more time the event page was opened. The one place rendering a page writes, kept to a single
// statement with no read-back so the page costs one more round trip and nothing else; a failure is
// logged and never reaches the guest, who came for the invitation, not for the count.
export async function recordView(id: string): Promise<void> {
  try {
    await getDb().update(event).set({ views: sql`${event.views} + 1` }).where(eq(event.id, id));
  } catch (error) {
    console.error("Counting a view of the event page failed", error);
  }
}

// Saving the event form. The row is locked as a reply's write locks it (rsvps/repository.ts), so
// that a capacity raised or removed promotes from the waitlist in the same transaction, against
// the headcount as it stands, and approval turned off approves every reply still waiting for it,
// those already waiting for a place first (spec, "Approval"); turning it on changes no reply.
// Dates that move the event's end take off its retention mark (spec, "Retention"): the next sweep
// marks it again, and warns its hosts afresh, if it is still old enough. `mailed` says whether a
// promoted or approved guest was queued an email.
export async function updateEvent(hostId: string, id: string, input: EventChanges): Promise<{ updated: Event; mailed: boolean } | undefined> {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select({
        capacity: event.capacity,
        approvalRequired: event.approvalRequired,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
        timeZone: event.timeZone,
      })
      .from(event)
      .where(and(eq(event.id, id), hostedBy(hostId)))
      .for("no key update");
    if (!before) return undefined;
    const redated = eventEnd(input).getTime() !== eventEnd(before).getTime();
    const [updated] = await tx
      .update(event)
      .set({ ...input, updatedAt: now, ...(redated ? { retentionWarnedAt: null } : {}) })
      .where(eq(event.id, id))
      .returning();
    const promotionMailed = updated.capacity === before.capacity ? false : (await promoteWaitlist(updated, tx, now)).mailed;
    const approvalMailed = before.approvalRequired && !updated.approvalRequired ? await approvePending(updated, tx, now) : false;
    return { updated: withTheme(updated), mailed: promotionMailed || approvalMailed };
  });
}

// The host changing the look. The theme is read and written under a row lock, so two changes
// sent close together apply one after the other instead of one overwriting the other. Every
// write moves updatedAt, which is what makes the link's preview card redraw (ticket 14); a
// change that changes nothing writes nothing.
export async function changeEventTheme(hostId: string, id: string, change: (theme: Theme) => Theme): Promise<Theme | undefined> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ theme: event.theme })
      .from(event)
      .where(and(eq(event.id, id), hostedBy(hostId)))
      .for("update");
    if (!row) return undefined;
    const current = parseTheme(row.theme);
    const changed = change(current);
    if (changed === current) return current;
    await tx.update(event).set({ theme: changed, updatedAt: new Date() }).where(eq(event.id, id));
    return changed;
  });
}

// Publishing records when, the first time a draft is published: a reminder whose time came before
// it is never sent (reminders/due.ts). The CASE reads the state the row had before this update.
export async function publishEvent(hostId: string, id: string): Promise<Event | undefined> {
  const now = new Date();
  const [published] = await getDb()
    .update(event)
    .set({
      state: "published",
      publishedAt: sql`case when ${event.state} = 'draft' then ${now.toISOString()}::timestamptz else ${event.publishedAt} end`,
      updatedAt: now,
    })
    .where(and(eq(event.id, id), hostedBy(hostId)))
    .returning();
  return published && withTheme(published);
}

// A link that leaked stops working, and a fresh one takes its place. The old slug is kept so
// that whoever still has it learns what happened.
export async function resetEventLink(hostId: string, id: string): Promise<Event | undefined> {
  return withFreshSlug(async (slug) => {
    try {
      return await getDb().transaction(async (tx) => {
        // Locked, as setCustomSlug locks it, so a custom link changed meanwhile is neither lost nor left
        // unretired.
        const [current] = await tx.select().from(event).where(and(eq(event.id, id), hostedBy(hostId))).for("update");
        if (!current) return undefined;

        // Retiring a slug twice is not a collision worth retrying: both unique constraints
        // carry "slug" in their names, so without this a second reset of the same link would
        // look like a slug clash and retry until it gave up.
        await tx.insert(retiredSlug).values({ slug: current.slug, eventId: current.id }).onConflictDoNothing();
        // The custom link goes with it: a reset starts again from the random link alone.
        if (current.customSlug) await tx.insert(retiredSlug).values({ slug: current.customSlug, eventId: current.id }).onConflictDoNothing();
        // Keyed on the slug this reset actually read, so two resets at once cannot both retire
        // the same link and leave the second's new one unretired: the loser changes nothing.
        const [reset] = await tx
          .update(event)
          .set({ slug, customSlug: null, updatedAt: new Date() })
          .where(and(eq(event.id, current.id), hostedBy(hostId), eq(event.slug, current.slug)))
          .returning();
        return reset && withTheme(reset);
      });
    } catch (error) {
      if (isSlugCollision(error)) return SLUG_TAKEN;
      throw error;
    }
  });
}

export const CUSTOM_SLUG_TAKEN = Symbol("custom slug taken");

// Gives the event a custom link, or takes it away with null. Locked on the event row so two
// changes at once go one after the other. The link is refused as taken when it is any event's
// random or custom link, or any retired link, this event's own retired links included. The custom
// link it replaces is retired. Undefined when the event is not this host's.
export async function setCustomSlug(hostId: string, id: string, custom: string | null): Promise<Event | typeof CUSTOM_SLUG_TAKEN | undefined> {
  try {
    return await getDb().transaction(async (tx) => {
      const [current] = await tx.select().from(event).where(and(eq(event.id, id), hostedBy(hostId))).for("update");
      if (!current) return undefined;
      if (current.customSlug === custom) return withTheme(current);
      if (custom !== null) {
        const [clash] = await tx.execute<{ found: boolean }>(
          sql`select exists (select 1 from ${event} where ${event.slug} = ${custom} or ${event.customSlug} = ${custom})
            or exists (select 1 from ${retiredSlug} where ${retiredSlug.slug} = ${custom}) as found`,
        );
        if (clash.found) return CUSTOM_SLUG_TAKEN;
      }
      if (current.customSlug) await tx.insert(retiredSlug).values({ slug: current.customSlug, eventId: id }).onConflictDoNothing();
      const [changed] = await tx.update(event).set({ customSlug: custom, updatedAt: new Date() }).where(eq(event.id, id)).returning();
      return withTheme(changed);
    });
  } catch (error) {
    if (isSlugCollision(error)) return CUSTOM_SLUG_TAKEN;
    throw error;
  }
}

// Whether an event link leads to a page: an event's, or the one that says its host reset it. The
// proxy asks this before every guest's first view of an event page (src/proxy.ts), so it only
// looks the slug up, in both places, in one query, and reads nothing else of the event.
export async function eventLinkExists(slug: string): Promise<boolean> {
  const [row] = await getDb().execute<{ found: boolean }>(
    sql`select exists (select 1 from ${event} where ${event.slug} = ${slug} or ${event.customSlug} = ${slug}) or exists (select 1 from ${retiredSlug} where ${retiredSlug.slug} = ${slug}) as found`,
  );
  return row.found;
}

// Whether this link used to work, which is a different thing from never having existed, and if so
// whether its event was deleted rather than given a new link.
export async function findRetiredSlug(slug: string): Promise<{ eventDeleted: boolean } | undefined> {
  const found = await getDb().query.retiredSlug.findFirst({ where: eq(retiredSlug.slug, slug) });
  return found && { eventDeleted: found.eventId === null };
}

// Calling it off: the page stays up with its notice and takes no more answers (spec, story 28).
// Only a published event is called off, and only the call that does it gets the event back, so
// its guests are told once (rsvps/notify-cancellation.ts), however often the host presses.
export async function cancelEvent(hostId: string, id: string): Promise<Event | undefined> {
  const [cancelled] = await getDb()
    .update(event)
    .set({ state: "cancelled", updatedAt: new Date() })
    .where(and(eq(event.id, id), hostedBy(hostId), eq(event.state, "published")))
    .returning();
  return cancelled && withTheme(cancelled);
}

// Leaves no trace but its links, kept retired: the event's RSVPs, their answers, its questions, its
// upload and its co-hosts all cascade with it, and the upload's stored files go too. Only its
// owner deletes it.
export async function deleteEvent(hostId: string, id: string): Promise<void> {
  await removeEvents(and(eq(event.id, id), eq(event.hostId, hostId)));
}

// Every event a host owns, when they delete their account (auth.ts), before the account itself goes,
// co-hosted or not. The events they co-host stay with their owners; the membership goes with the account.
export async function deleteHostEvents(hostId: string): Promise<void> {
  await removeEvents(eq(event.hostId, hostId));
}

// Every way an event is deleted comes through here, so its upload's files never outlive it. The
// events are locked first, so an upload arriving meanwhile either lands before and is found here,
// or finds its event gone. Their links are retired before they go, so that whoever still has one
// is told it is no longer valid, and no other event is ever given it, the custom link above all
// (ADR-0004); the retired slugs outlive the event. The files are removed once the rows are, so no
// page is ever shown whose picture is missing.
export async function removeEvents(which: SQL | undefined): Promise<void> {
  const uploads = await getDb().transaction(async (tx) => {
    const locked = await tx.select({ id: event.id, slug: event.slug, customSlug: event.customSlug }).from(event).where(which).for("update");
    if (locked.length === 0) return [];
    const doomed = locked.map(({ id }) => id);
    const slugs = locked.flatMap(({ id, slug, customSlug }) => [{ slug, eventId: id }, ...(customSlug ? [{ slug: customSlug, eventId: id }] : [])]);
    await tx.insert(retiredSlug).values(slugs).onConflictDoNothing();
    const removed = await tx.delete(upload).where(inArray(upload.eventId, doomed)).returning({ id: upload.id });
    await tx.delete(event).where(inArray(event.id, doomed));
    return removed.map(({ id }) => id);
  });
  await removeRenditions(uploads);
}

// The dashboard: the events a host owns and those they co-host, each with their role.
export async function listHostEvents(hostId: string): Promise<HostEvent[]> {
  const events = await getDb().query.event.findMany({ where: hostedBy(hostId), orderBy: [asc(event.startsAt), desc(event.createdAt)] });
  return events.map((found) => ({ ...withTheme(found), role: roleOf(found, hostId) }));
}

// The events this host owns, in any state; co-hosted events are not theirs. What the operator's
// events-per-host limit counts.
export async function countOwnedEvents(hostId: string): Promise<number> {
  const [row] = await getDb().select({ events: sql<number>`count(*)::int` }).from(event).where(eq(event.hostId, hostId));
  return row.events;
}

export type EventWithHost = Event & { hostName: string };

// The event page: an event by its link, with its owner's display name, which the preview card shows.
export const findEventBySlug = cache(async (slug: string): Promise<EventWithHost | undefined> => {
  const [row] = await getDb()
    .select({ event, hostName: user.name })
    .from(event)
    .innerJoin(user, eq(user.id, event.hostId))
    .where(or(eq(event.slug, slug), eq(event.customSlug, slug)))
    .limit(1);
  return row ? { ...withTheme(row.event), hostName: row.hostName } : undefined;
});
