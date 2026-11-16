import type { BuiltInKind, Shown, Switches } from "@/sections";

// What the editor's invitation previews (editor/section-previews.tsx; M8 ticket 25): every section
// the guest's page would have on, as the switches say. A section whose switch is a column is on as
// its column says, and the album only while the site offers it too (src/features), so the editor
// never previews an album no guest will have; the rest as the arrangement says, which
// placedSections reads. The countdown only once the event has a date to count to (ticket 28), as
// a guest's page has none without one.
export function previewedSections(switches: Switches, offered: { album: boolean }, dated: boolean): Partial<Record<BuiltInKind, Shown>> {
  const on: Partial<Record<BuiltInKind, boolean>> = {
    letter: switches.lettersEnabled,
    details: true,
    schedule: true,
    guests: switches.guestListVisibility !== "hidden",
    announcements: true,
    comments: switches.commentsEnabled,
    album: offered.album && switches.albumEnabled,
    countdown: dated,
  };
  return Object.fromEntries(Object.entries(on).flatMap(([kind, isOn]) => (isOn ? [[kind, { count: null }]] : [])));
}
