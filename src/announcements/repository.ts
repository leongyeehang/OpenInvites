import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { announcement, event } from "@/db/schema";
import { roomForAnother, type AnnouncementInput } from "./announcement";

export type Announcement = typeof announcement.$inferSelect;

// An event's announcements, newest first, as its page and its host's list show them.
export async function listAnnouncements(eventId: string): Promise<Announcement[]> {
  return getDb()
    .select()
    .from(announcement)
    .where(eq(announcement.eventId, eventId))
    .orderBy(desc(announcement.createdAt), desc(announcement.id));
}

// Posts one announcement, unless the event already has as many as it can carry; then nothing is
// written and the answer is null. The event's row is locked while its announcements are counted,
// so two posts at once cannot both take the last place.
export async function createAnnouncement(eventId: string, input: AnnouncementInput): Promise<Announcement | null> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("no key update");
    const [{ posted }] = await tx.select({ posted: count() }).from(announcement).where(eq(announcement.eventId, eventId));
    if (!roomForAnother(posted)) return null;
    const [created] = await tx
      .insert(announcement)
      .values({ eventId, ...input })
      .returning();
    return created;
  });
}

// Scoped to the event, so another host's page cannot reach an announcement.
export async function deleteAnnouncement(eventId: string, id: string): Promise<void> {
  await getDb().delete(announcement).where(and(eq(announcement.id, id), eq(announcement.eventId, eventId)));
}
