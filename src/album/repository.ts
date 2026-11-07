import { and, asc, count, eq, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { event, photo, rsvp, user } from "@/db/schema";
import { removePhotoFiles } from "./files";
import type { PhotoScope, PhotoStatus } from "./visibility";

export type Photo = typeof photo.$inferSelect;

// A photo with the name of whoever added it: the RSVP's name, or the host's display name.
export type NamedPhoto = Photo & { name: string };

// Who added a photo: exactly one of an RSVP and a host.
export type PhotoOwner = { rsvpId: string; hostId?: undefined } | { hostId: string; rsvpId?: undefined };

// An event's album as one viewer may see it (album/visibility.ts, photoScope), oldest first: every
// photo, the approved ones and the viewer's own, or the viewer's own alone.
export async function listPhotos(eventId: string, scope: PhotoScope): Promise<NamedPhoto[]> {
  const rows = await getDb()
    .select({ photo, name: sql<string>`coalesce(${rsvp.name}, ${user.name})` })
    .from(photo)
    .leftJoin(rsvp, eq(rsvp.id, photo.rsvpId))
    .leftJoin(user, eq(user.id, photo.hostId))
    .where(and(eq(photo.eventId, eventId), inScope(scope)))
    .orderBy(asc(photo.createdAt), asc(photo.id));
  return rows.map((row) => ({ ...row.photo, name: row.name }));
}

function inScope(scope: PhotoScope): SQL | undefined {
  if (scope === "all") return undefined;
  const own = eq(photo.rsvpId, scope.own);
  return "approved" in scope ? or(eq(photo.status, "approved"), own) : own;
}

// How many photos an album holds, or how many of them have one status. The count shown to someone
// the album is locked to counts approved photos only; the operator's limit counts them all, since
// a photo waiting for approval takes its place.
export async function countPhotos(eventId: string, status?: PhotoStatus): Promise<number> {
  const [{ held }] = await getDb()
    .select({ held: count() })
    .from(photo)
    .where(and(eq(photo.eventId, eventId), status ? eq(photo.status, status) : undefined));
  return held;
}

// Adds photos whose files are already stored, with the status they start with, unless the album
// would then hold more than the operator allows; then nothing is added, and the caller removes the
// files. The event's row is locked while its photos, pending or not, are counted, so two people
// adding at once cannot both take the last places.
export async function addPhotos(
  eventId: string,
  owner: PhotoOwner,
  added: { id: string; width: number; height: number }[],
  limit: number,
  status: PhotoStatus,
): Promise<"added" | { full: number }> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("no key update");
    const [{ held }] = await tx.select({ held: count() }).from(photo).where(eq(photo.eventId, eventId));
    if (held + added.length > limit) return { full: Math.max(0, limit - held) };
    await tx.insert(photo).values(added.map((each) => ({ ...each, eventId, rsvpId: owner.rsvpId ?? null, hostId: owner.hostId ?? null, status })));
    return "added";
  });
}

// A host's Approve (M6 ticket 03), scoped to the event: whether a photo waiting for approval was
// approved.
export async function approvePhoto(eventId: string, id: string): Promise<boolean> {
  const approved = await getDb()
    .update(photo)
    .set({ status: "approved" })
    .where(and(eq(photo.id, id), eq(photo.eventId, eventId), eq(photo.status, "pending")))
    .returning({ id: photo.id });
  return approved.length > 0;
}

// Approves every photo still waiting, inside the caller's transaction and under its lock on the
// event: what turning approval off does (events/repository.ts, updateEvent). Nobody is emailed.
export async function approvePendingPhotos(eventId: string, tx: Db): Promise<void> {
  await tx
    .update(photo)
    .set({ status: "approved" })
    .where(and(eq(photo.eventId, eventId), eq(photo.status, "pending")));
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
