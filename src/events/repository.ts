import { and, asc, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { event, user } from "@/db/schema";
import { DEFAULT_THEME, parseTheme } from "@/themes/theme";
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

// Drizzle wraps the driver's error; the Postgres fields are on its cause.
function isSlugCollision(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  if (typeof cause !== "object" || cause === null) return false;
  const { code, constraint_name } = cause as { code?: string; constraint_name?: string };
  return code === UNIQUE_VIOLATION && String(constraint_name).includes("slug");
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

export async function publishEvent(hostId: string, id: string): Promise<Event | undefined> {
  const [published] = await getDb()
    .update(event)
    .set({ state: "published", updatedAt: new Date() })
    .where(and(eq(event.id, id), eq(event.hostId, hostId)))
    .returning();
  return published && withTheme(published);
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
