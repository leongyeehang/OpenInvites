import { and, asc, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event, photo, rsvp, user } from "@/db/schema";
import { removePhotoFiles } from "./files";

export type Photo = typeof photo.$inferSelect;

// A photo with the name of whoever added it: the RSVP's name, or the host's display name.
export type NamedPhoto = Photo & { name: string };

// Who added a photo: exactly one of an RSVP and a host.
export type PhotoOwner = { rsvpId: string; hostId?: undefined } | { hostId: string; rsvpId?: undefined };

// An event's album, oldest first.
export async function listPhotos(eventId: string): Promise<NamedPhoto[]> {
  const rows = await getDb()
    .select({ photo, name: sql<string>`coalesce(${rsvp.name}, ${user.name})` })
    .from(photo)
    .leftJoin(rsvp, eq(rsvp.id, photo.rsvpId))
    .leftJoin(user, eq(user.id, photo.hostId))
    .where(eq(photo.eventId, eventId))
    .orderBy(asc(photo.createdAt), asc(photo.id));
  return rows.map((row) => ({ ...row.photo, name: row.name }));
}

export async function countPhotos(eventId: string): Promise<number> {
  const [{ held }] = await getDb().select({ held: count() }).from(photo).where(eq(photo.eventId, eventId));
  return held;
}

// Adds photos whose files are already stored, unless the album would then hold more than the
// operator allows; then nothing is added, and the caller removes the files. The event's row is
// locked while its photos are counted, so two people adding at once cannot both take the last places.
export async function addPhotos(eventId: string, owner: PhotoOwner, added: { id: string; width: number; height: number }[], limit: number): Promise<"added" | { full: number }> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("no key update");
    const [{ held }] = await tx.select({ held: count() }).from(photo).where(eq(photo.eventId, eventId));
    if (held + added.length > limit) return { full: Math.max(0, limit - held) };
    await tx.insert(photo).values(added.map((each) => ({ ...each, eventId, rsvpId: owner.rsvpId ?? null, hostId: owner.hostId ?? null })));
    return "added";
  });
}

export async function findPhoto(eventId: string, id: string): Promise<Photo | undefined> {
  return getDb().query.photo.findFirst({ where: and(eq(photo.id, id), eq(photo.eventId, eventId)) });
}

// Scoped to the event; the files go once the row has.
export async function deletePhoto(eventId: string, id: string): Promise<void> {
  const removed = await getDb()
    .delete(photo)
    .where(and(eq(photo.id, id), eq(photo.eventId, eventId)))
    .returning({ id: photo.id });
  await removePhotoFiles(removed.map((each) => each.id));
}

// The photos a host added to events they do not own, when their account goes (auth.ts): the rows
// would go with the account, and the files would be left behind.
export async function deleteHostPhotos(hostId: string): Promise<void> {
  const removed = await getDb().delete(photo).where(eq(photo.hostId, hostId)).returning({ id: photo.id });
  await removePhotoFiles(removed.map((each) => each.id));
}
