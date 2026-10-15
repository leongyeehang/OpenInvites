import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event, eventHost, user } from "@/db/schema";

export type EventHost = { id: string; name: string; email: string };

// Everyone who hosts an event, whom every email to its hosts reaches: its owner first, then its
// co-hosts in the order they were added, which is also the order the event page names them in.
export async function eventHosts(eventId: string): Promise<EventHost[]> {
  const db = getDb();
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
