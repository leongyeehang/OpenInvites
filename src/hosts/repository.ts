import { and, count, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { coHostLink, event, eventHost } from "@/db/schema";
import { coHostLinkExpiry, coHostLinkState, hashCoHostLinkToken, roomForCoHost, type CoHostLinkState } from "./co-host-link";

// The events a host has a part in: those they own and those they co-host. Every query that answers
// "this host's event" asks it (events/repository.ts, uploads/repository.ts), so owner and co-host
// are let in the same way everywhere and everyone else nowhere; what each may do there is can's.
export function hostedBy(hostId: string): SQL {
  const coHosted = getDb().select({ id: eventHost.eventId }).from(eventHost).where(eq(eventHost.hostId, hostId));
  return or(eq(event.hostId, hostId), inArray(event.id, coHosted))!;
}

export async function countCoHosts(eventId: string): Promise<number> {
  const [{ coHosts }] = await getDb().select({ coHosts: count() }).from(eventHost).where(eq(eventHost.eventId, eventId));
  return coHosts;
}

// The owner removing a co-host, or a co-host leaving. Their co-host link stays used.
export async function removeCoHost(eventId: string, hostId: string): Promise<void> {
  await getDb().delete(eventHost).where(and(eq(eventHost.eventId, eventId), eq(eventHost.hostId, hostId)));
}

export type CoHostLink = typeof coHostLink.$inferSelect;

export async function createCoHostLink(eventId: string, tokenHash: string, now: Date): Promise<void> {
  await getDb().insert(coHostLink).values({ eventId, tokenHash, createdAt: now, expiresAt: coHostLinkExpiry(now) });
}

// Every link made for the event, newest first; the hosts page shows those still pending.
export async function listCoHostLinks(eventId: string): Promise<CoHostLink[]> {
  return getDb().select().from(coHostLink).where(eq(coHostLink.eventId, eventId)).orderBy(desc(coHostLink.createdAt), desc(coHostLink.id));
}

export type CoHostLinkWithEvent = CoHostLink & { event: { id: string; title: string; hostId: string } };

// The link a token names, with the event it is for, or undefined for a link that was never made.
export async function findCoHostLink(token: string): Promise<CoHostLinkWithEvent | undefined> {
  const [found] = await getDb()
    .select({ link: coHostLink, event: { id: event.id, title: event.title, hostId: event.hostId } })
    .from(coHostLink)
    .innerJoin(event, eq(event.id, coHostLink.eventId))
    .where(eq(coHostLink.tokenHash, hashCoHostLinkToken(token)));
  return found && { ...found.link, event: found.event };
}

// Only a link nobody has used can be revoked; one used a moment earlier stays used.
export async function revokeCoHostLink(eventId: string, id: string, now: Date): Promise<void> {
  await getDb()
    .update(coHostLink)
    .set({ revokedAt: now })
    .where(and(eq(coHostLink.id, id), eq(coHostLink.eventId, eventId), isNull(coHostLink.usedAt), isNull(coHostLink.revokedAt)));
}

export type Acceptance = "accepted" | "owner" | "coHost" | "full" | Exclude<CoHostLinkState, "pending">;

// A signed-in host accepting a co-host link, in one transaction. The event is locked while its
// co-hosts are counted, so two links accepted at once cannot both take the tenth place; the link is
// locked, so of two hosts racing on it the second finds it used. The event is locked first, in the
// order deleting an event takes them (events/repository.ts, removeEvents, then the cascade to its
// links), so an accept and a delete at once wait for each other rather than deadlock. The owner, and
// a host who already co-hosts the event, leave the link as it was. Undefined for a link that was
// never made, or whose event was deleted meanwhile.
export async function acceptCoHostLink(token: string, hostId: string, now: Date): Promise<{ eventId: string; outcome: Acceptance } | undefined> {
  return getDb().transaction(async (tx) => {
    const tokenHash = hashCoHostLinkToken(token);
    const [named] = await tx.select({ eventId: coHostLink.eventId }).from(coHostLink).where(eq(coHostLink.tokenHash, tokenHash));
    if (!named) return undefined;
    const [owner] = await tx.select({ hostId: event.hostId }).from(event).where(eq(event.id, named.eventId)).for("no key update");
    if (!owner) return undefined;
    const [link] = await tx.select().from(coHostLink).where(eq(coHostLink.tokenHash, tokenHash)).for("update");
    if (!link) return undefined;
    const answer = (outcome: Acceptance) => ({ eventId: link.eventId, outcome });

    if (owner.hostId === hostId) return answer("owner");
    const [member] = await tx
      .select({ hostId: eventHost.hostId })
      .from(eventHost)
      .where(and(eq(eventHost.eventId, link.eventId), eq(eventHost.hostId, hostId)));
    if (member) return answer("coHost");
    const state = coHostLinkState(link, now);
    if (state !== "pending") return answer(state);
    const [{ coHosts }] = await tx.select({ coHosts: count() }).from(eventHost).where(eq(eventHost.eventId, link.eventId));
    if (!roomForCoHost(coHosts)) return answer("full");

    await tx.insert(eventHost).values({ eventId: link.eventId, hostId, addedAt: now });
    await tx.update(coHostLink).set({ usedAt: now, usedById: hostId }).where(eq(coHostLink.id, link.id));
    return answer("accepted");
  });
}
