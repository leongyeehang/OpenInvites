import type { AlbumViewer } from "./album";

// Who sees an event's album, as the host chooses (M6 spec, "The album: who sees it, and approval"):
// every guest who may add to it, which is today's rule and the default; only the guests who are
// Going; or nobody but the hosts. The database enum is built from this list.
export const ALBUM_VISIBILITIES = ["replied", "going", "hosts"] as const;

export type AlbumVisibility = (typeof ALBUM_VISIBILITIES)[number];

// A photo waits for a host while the host approves photos before they show; every other is
// approved. The database enum is built from this list too.
export const PHOTO_STATUSES = ["pending", "approved"] as const;

export type PhotoStatus = (typeof PHOTO_STATUSES)[number];

// What the album shows this viewer: every photo it may see, only the photos they added themselves
// (a guest who may add but not see), or how many there are and nothing more.
export type AlbumView = "open" | "own" | "locked";

// The hosts see every album. A guest whose reply the host has not approved, or someone who has
// not replied, sees none. Otherwise the host's choice: under `going` a guest whose status is Going
// sees the album, and a waitlisted reply is not Going, as the headcount counts it; under `hosts`
// no guest does. A guest who may add but not see sees their own photos.
export function albumView(event: { albumVisibility: AlbumVisibility }, viewer: AlbumViewer): AlbumView {
  if (viewer.kind === "host") return "open";
  if (viewer.kind === "visitor" || viewer.approval !== "approved") return "locked";
  if (event.albumVisibility === "replied") return "open";
  if (event.albumVisibility === "going") return viewer.status === "going" ? "open" : "own";
  return "own";
}

// Which photos are listed for a viewer the album is not locked to: every one for a host, pending
// or not; for a guest who sees the album, the approved ones and their own, which they see waiting;
// for a guest shown only their own, those alone.
export type PhotoScope = "all" | { approved: true; own: string } | { own: string };

export function photoScope(view: Exclude<AlbumView, "locked">, viewer: Exclude<AlbumViewer, { kind: "visitor" }>): PhotoScope {
  if (viewer.kind === "host") return "all";
  return view === "open" ? { approved: true, own: viewer.rsvpId } : { own: viewer.rsvpId };
}

// The status a new photo is added with: pending, from a guest, while the host approves photos; a
// host's own photos are approved at once, as are everyone's while approval is off.
export function photoStatusFor(event: { albumApprovalRequired: boolean }, viewer: AlbumViewer): PhotoStatus {
  return event.albumApprovalRequired && viewer.kind === "guest" ? "pending" : "approved";
}
