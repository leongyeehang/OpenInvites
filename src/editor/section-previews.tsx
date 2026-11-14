import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { placedSections, REGISTRY, type Arrangement, type ReadySection, type Switches } from "@/sections";
import type { Layout } from "@/themes/theme";
import { OpenArrange } from "./arrange-sheet";
import { previewedSections } from "./previewed";

// The sections on the editor's invitation (M8 spec, "The editor shows the sections"; ticket 25):
// in the order guests see them in the event's layout, though the editor itself is always the
// Poster, so the copy above the Arrange sheet moves as the host arranges. The details are the
// list the host edits (`details`, editor/details.tsx); every other section the page has on is a
// placeholder that says what guests will see there, and opens Arrange. Nothing of a guest's is
// loaded: the editor shows no comments, photos or guests.

// What each placeholder says, by kind.
const PREVIEWS = ["letter", "schedule", "guests", "announcements", "comments", "album"] as const;
type Previewed = (typeof PREVIEWS)[number];

export async function previewSections(
  arrangement: Arrangement,
  layout: Layout,
  switches: Switches,
  details: ReactNode,
  offered: { album: boolean },
): Promise<ReadySection[]> {
  const [arrange, page] = await Promise.all([getTranslations("Editor.arrange"), getTranslations("EventPage")]);
  const shown = previewedSections(switches, offered);
  return placedSections(arrangement, layout, shown).flatMap((placed): ReadySection[] => {
    const entry = REGISTRY[placed.kind];
    const base = { placed, icon: entry.icon, wide: entry.wide };
    if (placed.kind === "details") {
      return [{ ...base, heading: null, body: details, whole: (className) => <div data-section={placed.key} className={className}>{details}</div> }];
    }
    if (!(PREVIEWS as readonly string[]).includes(placed.kind)) return [];
    const kind = placed.kind as Previewed;
    const fixed = entry.heading.poster;
    return [
      {
        ...base,
        heading: placed.heading ?? (fixed ? page(fixed) : arrange(`kinds.${kind}`)),
        body: <OpenArrange>{arrange(`preview.${kind}`)}</OpenArrange>,
      },
    ];
  });
}
