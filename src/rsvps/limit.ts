import { eq, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { instanceSettings, rsvp } from "@/db/schema";
import { atLimit } from "@/instance/limits";

// Whether the event already has as many replies as the operator allows, those on the waitlist,
// waiting for the host's approval or declined among them. Checked inside the transaction that
// writes a reply (repository.ts, saveRsvp), under the event's lock, so two new replies cannot both
// take the last one. Both reads go through `db` rather than the cached instanceLimits(), so a
// transaction holding the lock never waits for a second connection that the replies queued behind
// it may all be holding. A guest with a reply is never turned away by it: they are changing
// theirs, not adding one.
export async function repliesAtLimit(eventId: string, db: Db = getDb()): Promise<boolean> {
  const [settings] = await db.select({ maxRsvpsPerEvent: instanceSettings.maxRsvpsPerEvent }).from(instanceSettings);
  const [row] = await db.select({ replies: sql<number>`count(*)::int` }).from(rsvp).where(eq(rsvp.eventId, eventId));
  return atLimit(row.replies, settings.maxRsvpsPerEvent);
}
