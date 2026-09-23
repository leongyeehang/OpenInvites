import { and, asc, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { event, retiredSlug, user } from "@/db/schema";
import { DEFAULT_THEME, parseTheme, type Theme } from "@/themes/theme";
import type { EventInput } from "./form";
import { SLUG_TAKEN, withFreshSlug } from "./slug";

export type Event = typeof event.$inferSelect;
export type EventState = Event["state"];

// Every read goes through here: the stored theme is completed by parseTheme, so rows from before
// themes existed, or from a newer version, come back as a whole Theme.
function withTheme<T extends { theme: unknown }>(row: T): T {
  return { ...row, theme: parseTheme(row.theme) };
}

const UNIQUE_VIOLATION = "23505";

// Drizzle wraps the driver's error; the Postgres fields are on its cause. Named exactly, because
// the retired slugs table has a unique constraint with "slug" in its name too.
const EVENT_SLUG_UNIQUE = "event_slug_unique";

function isSlugCollision(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  if (typeof cause !== "object" || cause === null) return false;
  const { code, constraint_name } = cause as { code?: string; constraint_name?: string };
  return code === UNIQUE_VIOLATION && constraint_name === EVENT_SLUG_UNIQUE;
}

// A new event starts with the Birthday template's theme (ticket 06).
export async function createEvent(hostId: string, input: EventInput): Promise<Event> {
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

// Scoped to the host: a host can only ever load or change their own events. Cached per
// request, as generateMetadata and the page both ask.
export const findHostEvent = cache(async (hostId: string, id: string): Promise<Event | undefined> => {
  const found = await getDb().query.event.findFirst({ where: and(eq(event.id, id), eq(event.hostId, hostId)) });
  return found && withTheme(found);
});

export async function updateEvent(hostId: string, id: string, input: EventInput): Promise<Event | undefined> {
  const [updated] = await getDb()
    .update(event)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(event.id, id), eq(event.hostId, hostId)))
    .returning();
  return updated && withTheme(updated);
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
      .where(and(eq(event.id, id), eq(event.hostId, hostId)))
      .for("update");
    if (!row) return undefined;
    const current = parseTheme(row.theme);
    const changed = change(current);
    if (changed === current) return current;
    await tx.update(event).set({ theme: changed, updatedAt: new Date() }).where(eq(event.id, id));
    return changed;
  });
}

export async function publishEvent(hostId: string, id: string): Promise<Event | undefined> {
  const [published] = await getDb()
    .update(event)
    .set({ state: "published", updatedAt: new Date() })
    .where(and(eq(event.id, id), eq(event.hostId, hostId)))
    .returning();
  return published && withTheme(published);
}

// A link that leaked stops working, and a fresh one takes its place. The old slug is kept so
// that whoever still has it learns what happened.
export async function resetEventLink(hostId: string, id: string): Promise<Event | undefined> {
  return withFreshSlug(async (slug) => {
    try {
      return await getDb().transaction(async (tx) => {
        const current = await tx.query.event.findFirst({ where: and(eq(event.id, id), eq(event.hostId, hostId)) });
        if (!current) return undefined;

        // Retiring a slug twice is not a collision worth retrying: both unique constraints
        // carry "slug" in their names, so without this a second reset of the same link would
        // look like a slug clash and retry until it gave up.
        await tx.insert(retiredSlug).values({ slug: current.slug, eventId: current.id }).onConflictDoNothing();
        // Keyed on the slug this reset actually read, so two resets at once cannot both retire
        // the same link and leave the second's new one unretired: the loser changes nothing.
        const [reset] = await tx
          .update(event)
          .set({ slug, updatedAt: new Date() })
          .where(and(eq(event.id, current.id), eq(event.hostId, hostId), eq(event.slug, current.slug)))
          .returning();
        return reset && withTheme(reset);
      });
    } catch (error) {
      if (isSlugCollision(error)) return SLUG_TAKEN;
      throw error;
    }
  });
}

// Whether this link used to work, which is a different thing from never having existed.
export async function isRetiredSlug(slug: string): Promise<boolean> {
  const found = await getDb().query.retiredSlug.findFirst({ where: eq(retiredSlug.slug, slug) });
  return found !== undefined;
}

// Calling it off: the page stays up with its notice and takes no more answers (spec, story 28).
export async function cancelEvent(hostId: string, id: string): Promise<Event | undefined> {
  const [cancelled] = await getDb()
    .update(event)
    .set({ state: "cancelled", updatedAt: new Date() })
    .where(and(eq(event.id, id), eq(event.hostId, hostId)))
    .returning();
  return cancelled && withTheme(cancelled);
}

// Leaves no trace: the event's RSVPs, their answers and its questions all cascade with it.
export async function deleteEvent(hostId: string, id: string): Promise<void> {
  await getDb().delete(event).where(and(eq(event.id, id), eq(event.hostId, hostId)));
}

export async function listHostEvents(hostId: string): Promise<Event[]> {
  const events = await getDb().query.event.findMany({ where: eq(event.hostId, hostId), orderBy: [asc(event.startsAt), desc(event.createdAt)] });
  return events.map(withTheme);
}

export type EventWithHost = Event & { hostName: string };

// The event page: an event by its link, with the host's display name for "Hosted by".
export const findEventBySlug = cache(async (slug: string): Promise<EventWithHost | undefined> => {
  const [row] = await getDb()
    .select({ event, hostName: user.name })
    .from(event)
    .innerJoin(user, eq(user.id, event.hostId))
    .where(eq(event.slug, slug))
    .limit(1);
  return row ? { ...withTheme(row.event), hostName: row.hostName } : undefined;
});
