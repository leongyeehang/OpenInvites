import type { EventState } from "@/events/repository";
import { MIN_FREE_BYTES } from "@/lib/sizes";
import type { Approval } from "@/rsvps/admission";
import type { SavedStatus } from "@/rsvps/form";
import { withoutUnseen } from "./exif";

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

// Whether the event has an album at all: the operator has the Album switched on for the site (M8
// ticket 01), which the caller reads, and the host has it on for the event (M8 ticket 25, Arrange).
// Off either way, guests see no album and every album action refuses; nothing in it is deleted.
export function albumSwitchedOn(event: { albumEnabled: boolean }, albumOn: boolean): boolean {
  return albumOn && event.albumEnabled;
}

// The album opens at the event's start, which for an all-day event is its day's first moment in
// the event's zone, as it is kept (events/time.ts, toInstant), and stays open until retention
// deletes the event. A draft, a cancelled event, or one with no date yet has no album; nor has an
// event whose album is switched off, by the operator or by its host (albumSwitchedOn).
export function albumState(event: { state: EventState; startsAt: Date | null; albumEnabled: boolean }, now: Date, albumOn: boolean): AlbumState {
  if (!albumSwitchedOn(event, albumOn) || event.state !== "published" || !event.startsAt) return "none";
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

// A caption (M8 ticket 09): whoever added the item, and any host, writes and changes it.
export function mayCaption(viewer: AlbumViewer, item: { rsvpId: string | null }): boolean {
  if (viewer.kind === "host") return true;
  return viewer.kind === "guest" && item.rsvpId === viewer.rsvpId;
}

// Whose page follows an item's processing (media part review): the hosts, and the guest who added
// it, as a video still processing is shown to them alone (M7 ticket 07). A live photo's motion
// being made is sent to them only, so no other guest's page refreshes for it, each refresh being a
// visit the event page limit counts (src/proxy.ts).
export function seesProcessing(viewer: AlbumViewer, item: { rsvpId: string | null }): boolean {
  if (viewer.kind === "host") return true;
  return viewer.kind === "guest" && item.rsvpId === viewer.rsvpId;
}

// Where the item the viewer opened now is among those that open, found by its id (media part
// review), so a refresh that adds or removes an item before it never turns the viewer to another;
// nothing, and the viewer closes, once it is no longer there.
export function shownIndex(ids: readonly string[], open: string | undefined): number | undefined {
  if (open === undefined) return undefined;
  const at = ids.indexOf(open);
  return at === -1 ? undefined : at;
}

// The longest caption, in characters as Postgres's char_length counts them: code points, so an
// emoji is one.
export const MAX_CAPTION = 140;

// A caption as posted, made plain text on one line: line breaks (U+2028 and U+2029 too), tabs and
// other control characters become spaces, the characters that could reorder or hide text go
// (exif.ts, withoutUnseen, the rule camera names follow), runs of spaces become one and the ends
// are trimmed. Nothing left removes the caption. It is never parsed: React writes it as text.
export function parseCaption(posted: string): { ok: true; caption: string | null } | { ok: false; error: "captionTooLong" } {
  const caption = withoutUnseen(posted.replace(/[\u2028\u2029]/g, " "), " ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (caption === "") return { ok: true, caption: null };
  if ([...caption].length > MAX_CAPTION) return { ok: false, error: "captionTooLong" };
  return { ok: true, caption };
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
