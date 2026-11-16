import { kindOffered, type BuiltInKind, type OfferedFeatures, type Shown, type Switches } from "@/sections";

// What the editor's invitation previews (editor/section-previews.tsx; M8 ticket 25): every section
// the guest's page would have on, as the switches say. A section whose switch is a column is on as
// its column says, and one that belongs to a site's feature (the album) only while the site offers
// it too (kindOffered, src/features), so the editor never previews an album no guest will have; the
// rest as the arrangement says, which placedSections reads. The countdown only once the event has
// a date to count to (ticket 28), as a guest's page has none without one, and the album likewise,
// since it opens at the event's start (ticket 29's review focus).
export function previewedSections(switches: Switches, offered: OfferedFeatures, dated: boolean): Partial<Record<BuiltInKind, Shown>> {
  const on: Record<BuiltInKind, boolean> = {
    letter: switches.lettersEnabled,
    details: true,
    schedule: true,
    guests: switches.guestListVisibility !== "hidden",
    announcements: true,
    comments: switches.commentsEnabled,
    album: switches.albumEnabled && dated,
    countdown: dated,
  };
  return Object.fromEntries(Object.entries(on).flatMap(([kind, isOn]) => (isOn && kindOffered(kind as BuiltInKind, offered) ? [[kind, { count: null }]] : [])));
}
