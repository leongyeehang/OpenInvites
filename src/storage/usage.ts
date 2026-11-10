import { asc, count, desc, eq, sql } from "drizzle-orm";
import { resolve } from "node:path";
import { getDb, type Db } from "@/db/client";
import { event, photo, upload } from "@/db/schema";
import { eventHosts, type EventHost } from "@/events/hosts";
import { storageConfig } from "./config";
import { diskUseOf, freeBytesOf } from "./disk-space";

// What the site's uploads take (M7 ticket 02), as the limits count them: every album item and
// every host's picture records its size as uploaded, and these are sums over that column. A sum
// over a bigint comes back from postgres-js as a string, hence mapWith(Number). Each takes a `db`
// so a check inside a locked transaction reads through it (as rsvps/limit.ts does) rather than
// waiting on a second connection.

const bytesOf = (column: typeof photo.bytes | typeof upload.bytes) => sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);

export async function eventAlbumBytes(eventId: string, db: Db = getDb()): Promise<number> {
  const [{ bytes }] = await db.select({ bytes: bytesOf(photo.bytes) }).from(photo).where(eq(photo.eventId, eventId));
  return bytes;
}

// One query after the other: `db` may be a transaction on one connection.
export async function siteBytes(db: Db = getDb()): Promise<{ albums: number; pictures: number }> {
  const [{ albums }] = await db.select({ albums: bytesOf(photo.bytes) }).from(photo);
  const [{ pictures }] = await db.select({ pictures: bytesOf(upload.bytes) }).from(upload);
  return { albums, pictures };
}

// The albums that take the most, for the Storage card (ticket 03): the event, what its album
// holds, and its hosts, owner first, whom the operator may write to and who are emailed when the
// operator clears it (ticket 10).
export type BiggestAlbum = { id: string; title: string; slug: string; customSlug: string | null; bytes: number; items: number; hosts: EventHost[] };

export async function biggestAlbums(limit = 5): Promise<BiggestAlbum[]> {
  const rows = await getDb()
    .select({ id: event.id, title: event.title, slug: event.slug, customSlug: event.customSlug, bytes: bytesOf(photo.bytes), items: count() })
    .from(photo)
    .innerJoin(event, eq(event.id, photo.eventId))
    .groupBy(event.id, event.title, event.slug, event.customSlug)
    .orderBy(desc(sql`coalesce(sum(${photo.bytes}), 0)`), asc(event.id))
    .limit(limit);
  return Promise.all(rows.map(async (row) => ({ ...row, hosts: await eventHosts(row.id) })));
}

// The free space of the volume the uploads are on, for the free-disk rule (album/album.ts,
// storageRoom); undefined on S3, where the app cannot see a disk.
export async function freeDiskBytes(): Promise<number | undefined> {
  const config = storageConfig();
  return config.backend === "local" ? freeBytesOf(resolve(config.dir)) : undefined;
}

// What the uploads directory really holds, for the Storage card (ticket 03); undefined on S3.
export async function diskUse(): Promise<number | undefined> {
  const config = storageConfig();
  return config.backend === "local" ? diskUseOf(resolve(config.dir)) : undefined;
}
