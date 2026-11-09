import { eq, sql } from "drizzle-orm";
import { cache } from "react";
import { getSession } from "@/auth/session";
import { getDb, type Db } from "@/db/client";
import { event, eventHost, user } from "@/db/schema";

export type EventHost = { id: string; name: string; email: string };

// Everyone who hosts an event, whom every email to its hosts reaches: its owner first, then its
// co-hosts in the order they were added, which is also the order the event page names them in.
// A caller can read them inside its own transaction (the retention sweep, with the event locked).
export async function eventHosts(eventId: string, db: Db = getDb()): Promise<EventHost[]> {
  const hosts = db
    .select({ hostId: event.hostId, addedAt: sql<Date | null>`null::timestamptz`.as("added_at") })
    .from(event)
    .where(eq(event.id, eventId))
    .unionAll(db.select({ hostId: eventHost.hostId, addedAt: eventHost.addedAt }).from(eventHost).where(eq(eventHost.eventId, eventId)))
    .as("hosts");
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(hosts)
    .innerJoin(user, eq(user.id, hosts.hostId))
    .orderBy(sql`${hosts.addedAt} asc nulls first`);
}

// Every host of the event, cached per request: the event page names them, and isHostOf asks.
export const hostsOf = cache((eventId: string) => eventHosts(eventId));

// Whether the one signed in on this request hosts the event, owner or co-host: who sees a draft,
// passes an invite-only event's lock (invites/gate.ts), and is let past it by every action that
// opens the event by its link. A guest has no session cookie, and the lookup returns without
// touching the database. Cached per request, as the page, its metadata and the gate all ask.
export const isHostOf = cache(async (eventId: string): Promise<boolean> => {
  const session = await getSession();
  return session !== null && (await hostsOf(eventId)).some((host) => host.id === session.user.id);
});
