import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { event, rsvp } from "@/db/schema";
import { countRsvps, type RsvpCounts, type StatusTally } from "./counts";
import type { RsvpAnswer, RsvpInput, RsvpStatus } from "./form";
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

// The guest list as the host reads it (spec, story 52): everything a host needs to plan. Never
// the edit token, which belongs to the guest alone: the rows reach a client component, so
// anything selected here is serialised into the host's page.
export type HostGuest = {
  id: string;
  name: string;
  status: RsvpStatus;
  plusOnes: number;
  plusOneNames: string[];
  email: string | null;
  repliedAt: Date;
  updatedAt: Date;
};

export async function listGuestList(eventId: string): Promise<HostGuest[]> {
  return getDb()
    .select({
      id: rsvp.id,
      name: rsvp.name,
      status: rsvp.status,
      plusOnes: rsvp.plusOnes,
      plusOneNames: rsvp.plusOneNames,
      email: rsvp.email,
      repliedAt: rsvp.repliedAt,
      updatedAt: rsvp.updatedAt,
    })
    .from(rsvp)
    .where(eq(rsvp.eventId, eventId))
    .orderBy(asc(rsvp.repliedAt));
}

// And as a guest reads it (spec, "RSVP flow"): names, statuses, and how many each is bringing.
// The email and the edit token are never loaded, so they cannot leak into the page even blurred.
export type PublicGuest = { id: string; name: string; status: RsvpStatus; plusOnes: number };

export async function listPublicGuestList(eventId: string): Promise<PublicGuest[]> {
  return getDb()
    .select({ id: rsvp.id, name: rsvp.name, status: rsvp.status, plusOnes: rsvp.plusOnes })
    .from(rsvp)
    .where(eq(rsvp.eventId, eventId))
    .orderBy(asc(rsvp.repliedAt));
}

// A host changing a guest's RSVP on their behalf (spec, story 53). It writes only what a host
// may set, so the guest's email and their edit token survive untouched and the link in their
// pocket keeps working.
export async function editRsvpAsHost(eventId: string, id: string, edit: RsvpAnswer): Promise<void> {
  await getDb()
    .update(rsvp)
    .set({ ...edit, updatedAt: new Date() })
    .where(and(eq(rsvp.id, id), eq(rsvp.eventId, eventId)));
}

// Scoped to the event, so neither a stale cookie nor another host's page can reach an RSVP.
export async function deleteRsvp(eventId: string, id: string): Promise<void> {
  await getDb().delete(rsvp).where(and(eq(rsvp.id, id), eq(rsvp.eventId, eventId)));
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
