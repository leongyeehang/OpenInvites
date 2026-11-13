import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { CommentViewer } from "@/comments/visibility";
import type { Reactor } from "@/comments/reactions";
import type { EventWithHost } from "@/events/repository";
import type { Letter } from "@/invites/invite";
import { placedSections, REGISTRY, type Arrangement, type BuiltInKind, type ReadySection, type SectionDrawing, type SectionKind, type Shown } from "@/sections";
import type { Layout } from "@/themes/theme";
import { albumDrawing } from "./album-section";
import { announcementsDrawing, type ShownAnnouncement } from "./announcements-section";
import { commentsDrawing } from "./comments-section";
import { detailsDrawing } from "./details-section";
import { guestsDrawing, type GuestListShown } from "./guests-section";
import { letterDrawing } from "./letter-section";
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

// Each kind's drawing, typed by its own data; the page reads them as one list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DRAWINGS: { [K in SectionKind]?: SectionDrawing<any, SectionPage> } = {
  letter: letterDrawing,
  details: detailsDrawing,
  schedule: scheduleDrawing,
  guests: guestsDrawing,
  announcements: announcementsDrawing,
  comments: commentsDrawing,
  album: albumDrawing,
};

// Everything the page's sections load, at once, each kind by its own drawing: a kind this viewer
// gets nothing of is absent. Loaded once per page, whichever layout draws it.
export async function loadSections(page: SectionPage): Promise<Partial<Record<SectionKind, unknown>>> {
  const loaded = await Promise.all(Object.entries(DRAWINGS).map(async ([kind, drawing]) => [kind, await drawing.load(page)] as const));
  return Object.fromEntries(loaded.filter(([, data]) => data !== undefined));
}

// The sections the layout draws, in the host's order (or the layout's own, never arranged), each
// with its heading in words, its icon and its body: what was loaded, placed by placedSections.
export async function readySections(page: SectionPage, loaded: Partial<Record<SectionKind, unknown>>, arrangement: Arrangement): Promise<ReadySection[]> {
  const t = await getTranslations("EventPage");
  const shown: Partial<Record<BuiltInKind, Shown>> = {};
  for (const [kind, drawing] of Object.entries(DRAWINGS) as [BuiltInKind, SectionDrawing<unknown, SectionPage>][]) {
    if (loaded[kind] !== undefined) shown[kind] = drawing.shown(loaded[kind]);
  }
  return placedSections(arrangement, page.layout, shown).flatMap((placed): ReadySection[] => {
    const drawing = DRAWINGS[placed.kind];
    const data = loaded[placed.kind];
    if (!drawing || data === undefined) return [];
    const entry = REGISTRY[placed.kind];
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
  });
}
