import { and, asc, count, eq, gte, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { albumUpload, event, photo, rsvp, user, videoJob } from "@/db/schema";
import { eventAlbumBytes, reservedUploads, siteBytes } from "@/storage/usage";
import { albumRoom, type Room } from "./album";
import { removeItemFiles } from "./files";
import type { PhotoKind } from "./video";
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

// How many items an album holds, failed videos aside (M7 ticket 05), or how many of them have one status. The count shown to someone
// the album is locked to counts approved photos only; the operator's limit counts them all, since
// a photo waiting for approval takes its place.
export async function countPhotos(eventId: string, status?: PhotoStatus): Promise<number> {
  const [{ held }] = await getDb()
    .select({ held: count() })
    .from(photo)
    .where(and(eq(photo.eventId, eventId), status ? eq(photo.status, status) : ne(photo.status, "failed")));
  return held;
}

// Adds photos whose files are already stored, unless the album would then hold more than the
// operator allows, in places or in bytes (album/album.ts, albumRoom; M7 ticket 02); then nothing
// is added, and the caller removes the files. The event's row is locked while its photos, pending
// or not, are counted and summed, so two people adding at once cannot both take the last places;
// the sums read through the transaction, as rsvps/limit.ts does, never through a second connection.
// The site's sum is not serialised by that lock, so two albums uploading at once can overshoot
// Storage for the site by one post each, which the operator docs say. The free space is read by
// the caller before the transaction: it is not database state. The status the photos start with is
// decided from the locked row (`statusFor`, album/visibility.ts, photoStatusFor), as a reply's
// approval is: a host turning approval off meanwhile approves what waits under the same lock, so
// nothing added after waits.
export async function addPhotos(
  eventId: string,
  owner: PhotoOwner,
  added: { id: string; width: number; height: number; bytes: number }[],
  caps: { maxItems: number; maxEventBytes: number; maxSiteBytes: number },
  freeBytes: number | undefined,
  statusFor: (locked: { albumApprovalRequired: boolean }) => PhotoStatus,
): Promise<{ status: PhotoStatus } | { refused: Extract<Room, { ok: false }> }> {
  return getDb().transaction(async (tx) => {
    const [locked] = await tx
      .select({ albumApprovalRequired: event.albumApprovalRequired })
      .from(event)
      .where(eq(event.id, eventId))
      .for("no key update");
    const [{ held }] = await tx.select({ held: count() }).from(photo).where(and(eq(photo.eventId, eventId), ne(photo.status, "failed")));
    const bytes = await eventAlbumBytes(eventId, tx);
    const site = await siteBytes(tx);
    const room = albumRoom(
      { items: held, bytes, siteBytes: site.albums + site.pictures, freeBytes },
      { items: added.length, bytes: added.reduce((total, each) => total + each.bytes, 0) },
      caps,
    );
    if (!room.ok) return { refused: room };
    const status = statusFor(locked);
    await tx.insert(photo).values(added.map((each) => ({ ...each, eventId, rsvpId: owner.rsvpId ?? null, hostId: owner.hostId ?? null, status })));
    return { status };
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
  await removeItemFiles(removed.map((each) => each.id));
}

// The photos a host added to events they do not own, when their account goes (auth.ts): the rows
// would go with the account, and the files would be left behind.
export async function deleteHostPhotos(hostId: string): Promise<void> {
  const removed = await getDb().delete(photo).where(eq(photo.hostId, hostId)).returning({ id: photo.id });
  await removeItemFiles(removed.map((each) => each.id));
}

// The upload protocol (M7 ticket 06; album/upload-protocol.ts): an ask reserves the album's places
// and bytes for a batch, each file is finished into an item, and what is never finished is dropped.

export type AlbumUpload = typeof albumUpload.$inferSelect;

export type AskedFile = { id: string; name: string; size: number; type: string; kind: PhotoKind; durationMs: number | undefined; partSize: number };

// Reserves the album's room for a batch, all or none, under the event's lock as addPhotos counts:
// the items and bytes held, uploads in progress among them, against the caps (album/album.ts,
// albumRoom). From here on the batch counts, so a second batch asked for meanwhile sees it.
export async function reserveUploads(
  eventId: string,
  owner: PhotoOwner,
  batch: string,
  files: AskedFile[],
  caps: { maxItems: number; maxEventBytes: number; maxSiteBytes: number },
  freeBytes: number | undefined,
): Promise<{ ok: true } | { refused: Extract<Room, { ok: false }> }> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("no key update");
    const [{ held }] = await tx.select({ held: count() }).from(photo).where(and(eq(photo.eventId, eventId), ne(photo.status, "failed")));
    const reserved = await reservedUploads(eventId, tx);
    const bytes = await eventAlbumBytes(eventId, tx);
    const site = await siteBytes(tx);
    const room = albumRoom(
      { items: held + reserved.items, bytes, siteBytes: site.albums + site.pictures, freeBytes },
      { items: files.length, bytes: files.reduce((total, file) => total + file.size, 0) },
      caps,
    );
    if (!room.ok) return { refused: room };
    await tx.insert(albumUpload).values(
      files.map((file) => ({
        id: file.id,
        batch,
        eventId,
        rsvpId: owner.rsvpId ?? null,
        hostId: owner.hostId ?? null,
        kind: file.kind,
        name: file.name,
        size: file.size,
        type: file.type,
        durationMs: file.durationMs ?? null,
        partSize: file.partSize,
      })),
    );
    return { ok: true };
  });
}

export async function findUpload(eventId: string, id: string): Promise<AlbumUpload | undefined> {
  return getDb().query.albumUpload.findFirst({ where: and(eq(albumUpload.id, id), eq(albumUpload.eventId, eventId)) });
}

// Records that a part arrived; a part sent twice is counted once. Answers every part received.
export async function markPartReceived(id: string, part: number): Promise<number[]> {
  const [row] = await getDb()
    .update(albumUpload)
    .set({ received: sql`(select array_agg(distinct x order by x) from unnest(${albumUpload.received} || array[${part}::int]) as x)` })
    .where(eq(albumUpload.id, id))
    .returning({ received: albumUpload.received });
  return row?.received ?? [];
}

export async function deleteUpload(id: string): Promise<void> {
  await getDb().delete(albumUpload).where(eq(albumUpload.id, id));
}

// A photo's upload becomes an item: the upload row goes and the item takes its place, in one
// transaction under the event's lock, which also orders the finishes of a batch so that the last
// one knows it is the last and the hosts are emailed once (as one post was, M6 ticket 04). Its
// status is decided as addPhotos decided it. Nothing when the upload is gone: an emptied album.
export async function finishPhotoUpload(
  upload: AlbumUpload,
  item: { id: string; width: number; height: number },
  statusFor: (locked: { albumApprovalRequired: boolean }) => PhotoStatus,
): Promise<{ status: PhotoStatus; lastOfBatch: boolean } | undefined> {
  return getDb().transaction(async (tx) => {
    const [locked] = await tx.select({ albumApprovalRequired: event.albumApprovalRequired }).from(event).where(eq(event.id, upload.eventId)).for("no key update");
    const gone = await tx.delete(albumUpload).where(eq(albumUpload.id, upload.id)).returning({ id: albumUpload.id });
    if (gone.length === 0) return undefined;
    const status = statusFor(locked);
    await tx.insert(photo).values({ id: item.id, eventId: upload.eventId, rsvpId: upload.rsvpId, hostId: upload.hostId, kind: "photo", width: item.width, height: item.height, bytes: upload.size, status });
    const [{ remaining }] = await tx.select({ remaining: count() }).from(albumUpload).where(eq(albumUpload.batch, upload.batch));
    return { status, lastOfBatch: remaining === 0 };
  });
}

// A video's upload becomes an item in processing with a job in the queue, once the clip as sent
// is stored. False when the upload is gone, and the caller removes what it stored.
export async function finishVideoUpload(upload: AlbumUpload, itemId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, upload.eventId)).for("no key update");
    const gone = await tx.delete(albumUpload).where(eq(albumUpload.id, upload.id)).returning({ id: albumUpload.id });
    if (gone.length === 0) return false;
    await tx.insert(photo).values({ id: itemId, eventId: upload.eventId, rsvpId: upload.rsvpId, hostId: upload.hostId, kind: "video", bytes: upload.size, durationMs: upload.durationMs, status: "processing" });
    await tx.insert(videoJob).values({ photoId: itemId });
    return true;
  });
}

// The pending photos this uploader added since the batch began, for the hosts' one email.
export async function pendingPhotosSince(upload: AlbumUpload): Promise<number> {
  const [{ pending }] = await getDb()
    .select({ pending: count() })
    .from(photo)
    .where(
      and(
        eq(photo.eventId, upload.eventId),
        upload.hostId ? eq(photo.hostId, upload.hostId) : eq(photo.rsvpId, upload.rsvpId!),
        eq(photo.kind, "photo"),
        eq(photo.status, "pending"),
        gte(photo.createdAt, upload.createdAt),
      ),
    );
  return pending;
}

const DAY = 24 * 60 * 60 * 1000;

// Uploads asked for a day ago and never finished (the hourly sweep): their rows go, which
// releases their places and bytes; the caller removes their parts.
export async function removeAbandonedUploads(now: Date): Promise<string[]> {
  const removed = await getDb()
    .delete(albumUpload)
    .where(lt(albumUpload.createdAt, new Date(now.getTime() - DAY)))
    .returning({ id: albumUpload.id });
  return removed.map(({ id }) => id);
}
