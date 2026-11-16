import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { placedSections, REGISTRY, type Arrangement, type ReadySection, type SectionKind, type Switches } from "@/sections";
import type { Layout } from "@/themes/theme";
import { OpenArrange } from "./arrange-sheet";
import { previewedSections } from "./previewed";

// The sections on the editor's invitation (M8 spec, "The editor shows the sections"; ticket 25):
// in the order guests see them in the event's layout, though the editor itself is always the
// Poster, so the copy above the Arrange sheet moves as the host arranges. The details are the
// list the host edits (`details`, editor/details.tsx); every other section the page has on is a
// placeholder under the host's heading that says what guests will see there, and opens Arrange at
// its own row (ticket 28). Nothing of a guest's is loaded: the editor shows no comments, photos or
// guests.

// What each placeholder says, by kind; Who's coming's names who sees it (M8 ticket 26).
const PREVIEWS = ["letter", "schedule", "guests", "announcements", "comments", "album", "countdown"] as const;
type Previewed = (typeof PREVIEWS)[number];

export async function previewSections(
  arrangement: Arrangement,
  layout: Layout,
  switches: Switches,
  details: ReactNode,
  offered: { album: boolean },
  // Whether the event has a date, which the countdown counts to.
  dated: boolean,
): Promise<ReadySection[]> {
  const [arrange, page] = await Promise.all([getTranslations("Editor.arrange"), getTranslations("EventPage")]);
  const shown = previewedSections(switches, offered, dated);
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
        body: (
          <OpenArrange sectionKey={placed.key}>
            {arrange(kind !== "guests" ? `preview.${kind}` : switches.guestListVisibility === "always" ? "preview.guestsAlways" : "preview.guestsAfterReply")}
          </OpenArrange>
        ),
      },
    ];
  });
}

// The heading each section that may be renamed has in the event's layout until the host renames
// it, which the Arrange sheet's Heading field shows as its placeholder (ticket 28). Worked out here
// so the sheet needs none of the event page's messages.
export async function defaultHeadings(layout: Layout): Promise<Partial<Record<SectionKind, string>>> {
  const page = await getTranslations("EventPage");
  return Object.fromEntries(
    (Object.keys(REGISTRY) as SectionKind[]).flatMap((kind) => {
      const heading = REGISTRY[kind].heading[layout];
      return REGISTRY[kind].rename && heading ? [[kind, page(heading)]] : [];
    }),
  );
}
