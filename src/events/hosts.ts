import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event, user } from "@/db/schema";

export type EventHost = { id: string; name: string; email: string };

// Everyone who hosts an event, whom every email to its hosts reaches. Today that is the host who
// created it alone; co-hosts (M2 ticket 05) join this query.
export async function eventHosts(eventId: string): Promise<EventHost[]> {
  return getDb()
    .select({ id: user.id, name: user.name, email: user.email })
    .from(event)
    .innerJoin(user, eq(user.id, event.hostId))
    .where(eq(event.id, eventId));
}
