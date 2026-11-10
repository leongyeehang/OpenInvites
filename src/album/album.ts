import type { EventState } from "@/events/repository";
import { MIN_FREE_BYTES } from "@/lib/sizes";
import type { Approval } from "@/rsvps/admission";
import type { SavedStatus } from "@/rsvps/form";

// The photo album (M4 ticket 11): from the event's start, its guests whose replies the host has
// approved, and its hosts, add photos; who sees them is the host's choice (M6 ticket 03,
// album/visibility.ts); hosts delete any, guests their own; the operator limits how many one event
// holds.

// The most one person adds at once.
export const MAX_PHOTOS_AT_ONCE = 10;

// What an album holds (M7 ticket 09): its photos and videos, failed ones aside, and what they take
// as uploaded; said in the Settings sheet, the reminders and the confirmation before emptying.
export type AlbumTotals = { photos: number; videos: number; bytes: number };
export const NO_ITEMS: AlbumTotals = { photos: 0, videos: 0, bytes: 0 };

// How long after the event the hosts may ask to be reminded about the album, in days; or never.
export const ALBUM_REMINDER_CHOICES = [30, 90, 180, 365] as const;

export type AlbumState = "none" | "notYet" | "open";

// The album opens at the event's start, which for an all-day event is its day's first moment in
// the event's zone, as it is kept (events/time.ts, toInstant), and stays open until retention
// deletes the event. A draft, a cancelled event, or one with no date yet has no album.
export function albumState(event: { state: EventState; startsAt: Date | null }, now: Date): AlbumState {
  if (event.state !== "published" || !event.startsAt) return "none";
  return now >= event.startsAt ? "open" : "notYet";
}

// Who is in front of the album: a host of the event, a guest whose RSVP is on this device with the
// host's word on it, what it says and its name (for the hosts' email about photos waiting, M6
// ticket 04), or someone else.
export type AlbumViewer = { kind: "host"; hostId: string } | { kind: "guest"; rsvpId: string; approval: Approval; status: SavedStatus; name: string } | { kind: "visitor" };

// Who adds to the album: the hosts, and a guest whose reply the host has approved (which a reply
// needing no approval always is), whatever it says and whoever the host lets see the album. With
// the guest list hidden, they still do.
export function mayAddPhotos(viewer: AlbumViewer): boolean {
  return viewer.kind === "host" || (viewer.kind === "guest" && viewer.approval === "approved");
}

// Only a host approves a photo that waits for it (M6 ticket 03).
export function mayApprovePhoto(viewer: AlbumViewer): boolean {
  return viewer.kind === "host";
}

// A host deletes any photo; a guest the ones their RSVP added.
export function mayDeletePhoto(viewer: AlbumViewer, photo: { rsvpId: string | null }): boolean {
  if (viewer.kind === "host") return true;
  return viewer.kind === "guest" && photo.rsvpId === viewer.rsvpId;
}

// Why an upload is refused, with what the message names: how many places are left in the album,
// and the limit that was hit (places, or bytes).
export type Room = { ok: true } | { ok: false; error: "tooMany" | "albumFull" | "albumStorageFull" | "siteFull" | "diskFull"; left: number; limit: number };

// The site's room for one more upload of `adding` bytes (M7 ticket 02), checked for every upload,
// a host's picture included: within Storage for the site, and, on local disk, with a gigabyte
// still free afterwards (MIN_FREE_BYTES), since a full disk stops the whole site. A disk the app
// cannot see (S3) never refuses. Exactly full is allowed.
export function storageRoom(
  held: { siteBytes: number; freeBytes: number | undefined },
  adding: number,
  maxSiteBytes: number,
): { ok: true } | { ok: false; error: "siteFull" | "diskFull"; limit: number } {
  if (held.siteBytes + adding > maxSiteBytes) return { ok: false, error: "siteFull", limit: maxSiteBytes };
  if (held.freeBytes !== undefined && held.freeBytes - adding < MIN_FREE_BYTES) return { ok: false, error: "diskFull", limit: MIN_FREE_BYTES };
  return { ok: true };
}

// How many of `adding` items an album holding `held` takes: all of them, or none when they would
// take it past a limit, which is said as the refusal, in this order: too many at once, the
// album's places (M4 ticket 11), its storage (Storage per event), then the site's (storageRoom).
export function albumRoom(
  held: { items: number; bytes: number; siteBytes: number; freeBytes: number | undefined },
  adding: { items: number; bytes: number },
  caps: { maxItems: number; maxEventBytes: number; maxSiteBytes: number },
): Room {
  const left = Math.max(0, caps.maxItems - held.items);
  if (adding.items > MAX_PHOTOS_AT_ONCE) return { ok: false, error: "tooMany", left, limit: caps.maxItems };
  if (held.items + adding.items > caps.maxItems) return { ok: false, error: "albumFull", left, limit: caps.maxItems };
  if (held.bytes + adding.bytes > caps.maxEventBytes) return { ok: false, error: "albumStorageFull", left, limit: caps.maxEventBytes };
  const site = storageRoom(held, adding.bytes, caps.maxSiteBytes);
  return site.ok ? site : { ...site, left };
}
