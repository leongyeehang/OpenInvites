import type { EventState } from "@/events/repository";
import type { Approval } from "@/rsvps/admission";

// The photo album (M4 ticket 11): from the event's start, its guests whose replies the host has
// approved, and its hosts, add photos, which they all see; hosts delete any, guests their own; the
// operator limits how many one event holds.

// The most one person adds at once.
export const MAX_PHOTOS_AT_ONCE = 10;

export type AlbumState = "none" | "notYet" | "open";

// The album opens at the event's start, which for an all-day event is its day's first moment in
// the event's zone, as it is kept (events/time.ts, toInstant), and stays open until retention
// deletes the event. A draft, a cancelled event, or one with no date yet has no album.
export function albumState(event: { state: EventState; startsAt: Date | null }, now: Date): AlbumState {
  if (event.state !== "published" || !event.startsAt) return "none";
  return now >= event.startsAt ? "open" : "notYet";
}

// Who is in front of the album: a host of the event, a guest whose RSVP is on this device with the
// host's word on it, or someone else.
export type AlbumViewer = { kind: "host"; hostId: string } | { kind: "guest"; rsvpId: string; approval: Approval } | { kind: "visitor" };

// Who sees the album and adds to it: the hosts, and a guest whose reply the host has approved
// (which a reply needing no approval always is). With the guest list hidden, they still do.
export function mayUseAlbum(viewer: AlbumViewer): boolean {
  return viewer.kind === "host" || (viewer.kind === "guest" && viewer.approval === "approved");
}

// A host deletes any photo; a guest the ones their RSVP added.
export function mayDeletePhoto(viewer: AlbumViewer, photo: { rsvpId: string | null }): boolean {
  if (viewer.kind === "host") return true;
  return viewer.kind === "guest" && photo.rsvpId === viewer.rsvpId;
}

// How many of `adding` photos an album holding `held` takes under the operator's limit: all of
// them, or none when they would take it past the limit, which is said as the refusal.
export function photosRoom(held: number, adding: number, limit: number): { ok: true } | { ok: false; error: "tooMany" | "albumFull"; left: number } {
  if (adding > MAX_PHOTOS_AT_ONCE) return { ok: false, error: "tooMany", left: Math.max(0, limit - held) };
  if (held + adding > limit) return { ok: false, error: "albumFull", left: Math.max(0, limit - held) };
  return { ok: true };
}
