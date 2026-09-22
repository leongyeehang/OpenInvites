import { and, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { event, rsvp } from "@/db/schema";
import { countRsvps, type RsvpCounts, type StatusTally } from "./counts";
import type { RsvpInput } from "./form";
import { planRsvp } from "./plan";
import { generateEditToken, hashEditToken } from "./token";

export type Rsvp = typeof rsvp.$inferSelect;

// The RSVP an edit token opens on one event. Cached per request: the page and its metadata
// both ask.
export const findRsvpByToken = cache(async (eventId: string, token: string): Promise<Rsvp | undefined> => {
  return getDb().query.rsvp.findFirst({
    where: and(eq(rsvp.eventId, eventId), eq(rsvp.editTokenHash, hashEditToken(token))),
  });
});

// An edit token names its event as well as its RSVP, so an edit link works on a device that has
// never opened the invitation.
export async function findEventForToken(token: string): Promise<{ eventId: string; slug: string } | undefined> {
  const [row] = await getDb()
    .select({ eventId: rsvp.eventId, slug: event.slug })
    .from(rsvp)
    .innerJoin(event, eq(event.id, rsvp.eventId))
    .where(eq(rsvp.editTokenHash, hashEditToken(token)))
    .limit(1);
  return row;
}

// An RSVP together with the edit token that opened it, which is what the guest holds.
export type MyRsvp = { rsvp: Rsvp; token: string };

// Saves one answer. A guest who already has an RSVP here changes it and keeps their edit token;
// anyone else gets a new RSVP with a fresh one.
export async function saveRsvp(eventId: string, input: RsvpInput, mine: MyRsvp | undefined): Promise<MyRsvp> {
  const plan = planRsvp(eventId, input, mine && { id: mine.rsvp.id, token: mine.token }, new Date());
  if (plan.replaces) {
    const [replaced] = await getDb().update(rsvp).set(plan.changes).where(eq(rsvp.id, plan.replaces.id)).returning();
    return { rsvp: replaced, token: plan.replaces.token };
  }
  const token = generateEditToken();
  const [created] = await getDb()
    .insert(rsvp)
    .values({ ...plan.rsvp, editTokenHash: hashEditToken(token) })
    .returning();
  return { rsvp: created, token };
}

export async function deleteRsvp(id: string): Promise<void> {
  await getDb().delete(rsvp).where(eq(rsvp.id, id));
}

// The RSVPs of several events at once, for the host's dashboard. Postgres groups them; the
// headcount rule lives in countRsvps.
export async function countRsvpsByEvent(eventIds: string[]): Promise<Map<string, RsvpCounts>> {
  const counts = new Map<string, RsvpCounts>();
  if (eventIds.length === 0) return counts;
  const rows = await getDb()
    .select({
      eventId: rsvp.eventId,
      status: rsvp.status,
      rsvps: sql<number>`count(*)::int`,
      plusOnes: sql<number>`coalesce(sum(${rsvp.plusOnes}), 0)::int`,
    })
    .from(rsvp)
    .where(inArray(rsvp.eventId, eventIds))
    .groupBy(rsvp.eventId, rsvp.status);

  const tallies = new Map<string, StatusTally[]>();
  for (const { eventId, ...tally } of rows) {
    const forEvent = tallies.get(eventId) ?? [];
    forEvent.push(tally);
    tallies.set(eventId, forEvent);
  }
  for (const eventId of eventIds) counts.set(eventId, countRsvps(tallies.get(eventId) ?? []));
  return counts;
}
