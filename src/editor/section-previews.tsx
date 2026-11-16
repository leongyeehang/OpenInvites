import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { linksToDraw, placedSections, REGISTRY, type Arrangement, type ReadySection, type SectionKind, type Switches } from "@/sections";
import { LinksSection } from "@/themes/sections/links-section";
import { NoteSection } from "@/themes/sections/note-section";
import type { Layout } from "@/themes/theme";
import { EditSection, OpenArrange } from "./arrange-sheet";
import { previewedSections } from "./previewed";
import { StyleGlyph } from "./style-glyphs";

// The sections on the editor's invitation (M8 spec, "The editor shows the sections"; ticket 25):
// in the order guests see them in the event's layout, though the editor itself is always the
// Poster, so the copy above the Arrange sheet moves as the host arranges. The details are the
// list the host edits (`details`, editor/details.tsx); every other section the page has on is a
// placeholder under the host's heading that says what guests will see there, and opens Arrange at
// its own row (ticket 28). Nothing of a guest's is loaded: the editor shows no comments, photos or
// guests; one drawn in a style says which, by the style's drawing and name (ticket 30). A Note or
// Links is drawn in full, as guests will see it, and opens its own sheet; one the host has just
// added and not yet written is drawn too, saying what to tap (ticket 29), where a guest's page
// leaves it out.

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
  return placedSections(arrangement, layout, shown, { empty: true }).flatMap((placed): ReadySection[] => {
    const entry = REGISTRY[placed.kind];
    const base = { placed, icon: entry.icon, wide: entry.wide };
    if (placed.kind === "details") {
      return [{ ...base, heading: null, body: details, whole: (className) => <div data-section={placed.key} className={className}>{details}</div> }];
    }
    const { section } = placed;
    if (section.kind === "note" || section.kind === "links") {
      const headingId = `${placed.key}-heading`;
      const empty = (text: string) => <p className="text-sm text-theme-text-muted">{text}</p>;
      const drawn =
        section.kind === "note"
          ? section.body.blocks.length > 0
            ? <NoteSection body={section.body} layout="poster" linked={false} />
            : empty(arrange("preview.noteEmpty"))
          : linksToDraw(section.links).length > 0
            ? <LinksSection links={section.links} layout="poster" linked={false} />
            : empty(arrange("preview.linksEmpty"));
      return [
        {
          ...base,
          heading: placed.heading ?? page(entry.heading.poster ?? `sections.${section.kind}`),
          headingId,
          body: (
            <EditSection sectionKey={placed.key} headingId={headingId}>
              {drawn}
            </EditSection>
          ),
        },
      ];
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
            <span className="flex min-w-0 flex-col gap-2">
              {arrange(kind !== "guests" ? `preview.${kind}` : switches.guestListVisibility === "always" ? "preview.guestsAlways" : "preview.guestsAfterReply")}
              {/* The style it is drawn in, by its drawing and its name (ticket 30). */}
              {placed.style && (
                <span data-slot="style-preview" className="inline-flex items-center gap-1.5 text-xs font-medium text-theme-text-faint">
                  <StyleGlyph style={placed.style} className="h-4 w-6" />
                  {arrange(`styles.${placed.style}`)}
                </span>
              )}
            </span>
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
