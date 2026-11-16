import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { CommentViewer } from "@/comments/visibility";
import type { Reactor } from "@/comments/reactions";
import type { EventWithHost } from "@/events/repository";
import type { Letter } from "@/invites/invite";
import {
  placedSections,
  REGISTRY,
  sectionOn,
  type Arrangement,
  type BuiltInKind,
  type PlacedSection,
  type ReadySection,
  type SectionDrawing,
  type SectionHeading,
  type SectionKind,
  type Shown,
} from "@/sections";
import type { Layout } from "@/themes/theme";
import { albumDrawing } from "./album-section";
import { announcementsDrawing, type ShownAnnouncement } from "./announcements-section";
import { commentsDrawing } from "./comments-section";
import { countdownDrawing } from "./countdown-section";
import { detailsDrawing } from "./details-section";
import { guestsDrawing, type GuestListShown } from "./guests-section";
import { letterDrawing } from "./letter-section";
import { linksDrawing } from "./links-section";
import { noteDrawing } from "./note-section";
import { scheduleDrawing } from "./schedule-drawing";

// The server's half of the section registry (M8 ticket 25; plan ruling 34): what each kind of
// section loads for the event page and how it is drawn, beside src/sections' REGISTRY, which says
// what it is called and offers and which the Arrange sheet, a client component, reads. A kind is
// registered here with its drawing, exported from its own file; a later module's section comes in
// the same way.

// What the event page has worked out before its sections: the event, the layout it is drawn in,
// the moment and language it is drawn in, and who is looking, with what of theirs the sections
// share: the host's letter to them, the guest list as they may see it, the announcements every
// viewer reads, whom they comment and react as and the box they post with, and what their own
// device adds to the details (their clock, their maps app, their calendar; while guests vote on
// the date, the candidates in place of the When).
export type SectionPage = {
  event: EventWithHost;
  layout: Layout;
  locale: string;
  now: Date;
  isHost: boolean;
  letter: Letter | undefined;
  guestList: GuestListShown | undefined;
  announcements: ShownAnnouncement[];
  commentViewer: CommentViewer;
  reactor: Reactor | undefined;
  commentForm: ReactNode;
  details: { underWhen?: ReactNode; underWhere?: ReactNode; calendar?: ReactNode; poll?: ReactNode };
};

// What each kind's drawing loads, read from the drawing itself, so that a drawing handed another
// kind's data is a compile error rather than a cast.
type DataOf<T> = T extends SectionDrawing<infer D, SectionPage> ? D : never;

const BY_KIND = {
  letter: letterDrawing,
  details: detailsDrawing,
  schedule: scheduleDrawing,
  guests: guestsDrawing,
  announcements: announcementsDrawing,
  comments: commentsDrawing,
  album: albumDrawing,
  countdown: countdownDrawing,
  note: noteDrawing,
  links: linksDrawing,
  // Every kind of section there is, and no other: a kind added to the registry and drawn by
  // nothing does not compile.
} satisfies Record<SectionKind, unknown>;

// The kinds the server draws, each registered once, above.
export type DrawnKind = keyof typeof BY_KIND;
export type SectionData = { [K in DrawnKind]: DataOf<(typeof BY_KIND)[K]> };
// What the page loaded: a kind this viewer gets nothing of is absent.
export type LoadedSections = { [K in DrawnKind]?: SectionData[K] };

// Each kind's drawing, typed by its own data; the page reads them as one list.
export const DRAWINGS: { [K in DrawnKind]: SectionDrawing<SectionData[K], SectionPage> } = BY_KIND;

// Read from BY_KIND, so a kind registered there is loaded and placed without being listed again.
const DRAWN_KINDS = Object.keys(BY_KIND) as DrawnKind[];
const isDrawn = (kind: SectionKind): kind is DrawnKind => Object.hasOwn(DRAWINGS, kind);
// Whether a kind is built in, rather than the host's own (a Note, Links), of which a page has any
// number: what those draw is in the arrangement, which says whether each is on, and placedSections,
// not a drawing's `shown`, whether each is placed.
const isBuiltIn = (kind: DrawnKind): kind is DrawnKind & BuiltInKind => kind !== "note" && kind !== "links";

// Everything the page's sections load, at once, each kind by its own drawing: a kind this viewer
// gets nothing of is absent, and so is a section the host has switched off, which is never asked
// for (ticket 27). Loaded once per page, whichever layout draws it.
export async function loadSections(page: SectionPage, arrangement: Arrangement): Promise<LoadedSections> {
  const loaded: LoadedSections = {};
  const load = async <K extends DrawnKind>(kind: K) => {
    if (isBuiltIn(kind) && !sectionOn(arrangement, kind)) return;
    const data = await DRAWINGS[kind].load(page);
    if (data !== undefined) loaded[kind] = data;
  };
  await Promise.all(DRAWN_KINDS.map(load));
  return loaded;
}

// What of one kind this viewer is shown, from its own drawing and data.
function shownOf<K extends DrawnKind>(loaded: LoadedSections, kind: K): Shown | undefined {
  const data = loaded[kind];
  return data === undefined ? undefined : DRAWINGS[kind].shown(data);
}

// One placed section made ready, by its own drawing and data, or nothing when there is none.
function ready<K extends DrawnKind>(page: SectionPage, loaded: LoadedSections, kind: K, placed: PlacedSection, t: (heading: SectionHeading) => string): ReadySection[] {
  const drawing = DRAWINGS[kind];
  const data = loaded[kind];
  if (data === undefined) return [];
  const entry = REGISTRY[kind];
  const fixed = entry.heading[page.layout];
  const whole = drawing.whole?.[page.layout];
  return [
    {
      placed,
      heading: placed.heading ?? drawing.heading?.(data) ?? (fixed ? t(fixed) : null),
      headingId: drawing.headingId,
      icon: entry.icon,
      wide: entry.wide,
      body: drawing.body(data, page.layout, placed),
      ...(whole && { whole: (className: string) => whole(data, placed, className) }),
    },
  ];
}

// The sections the layout draws, in the host's order (or the layout's own, never arranged), each
// with its heading in words, its icon and its body: what was loaded, placed by placedSections.
export async function readySections(page: SectionPage, loaded: LoadedSections, arrangement: Arrangement): Promise<ReadySection[]> {
  const t = await getTranslations("EventPage");
  const shown: Partial<Record<BuiltInKind, Shown>> = {};
  for (const kind of DRAWN_KINDS.filter(isBuiltIn)) {
    const given = shownOf(loaded, kind);
    if (given) shown[kind] = given;
  }
  return placedSections(arrangement, page.layout, shown).flatMap((placed) => (isDrawn(placed.kind) ? ready(page, loaded, placed.kind, placed, t) : []));
}
