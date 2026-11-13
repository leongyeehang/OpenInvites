import type { ComponentProps } from "react";
import { GuestList } from "@/app/e/[slug]/guest-list";
import type { SectionDrawing } from "@/sections";
import type { SectionPage } from "./drawings";

// Who's coming as this viewer may see it (rsvps/visibility.ts), worked out by the page: absent when
// the host hides the list, locked to a guest who has not replied or whose reply waits for the
// host, and otherwise the guests themselves.
export type GuestListShown = ComponentProps<typeof GuestList>;

// The guest list as a section (M8 ticket 25). The frame heads it; the count beside a collapsed
// heading is how many guests are listed.
export const guestsDrawing: SectionDrawing<GuestListShown, SectionPage> = {
  load: async ({ guestList }) => guestList,
  shown: (list) => ({ count: list.view === "open" ? list.guests.length : null, locked: list.view === "locked" }),
  body: (list) => <GuestList {...list} />,
};
