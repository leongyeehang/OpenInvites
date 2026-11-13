import {
  CalendarDays,
  Hourglass,
  Images,
  Link2,
  ListOrdered,
  MailOpen,
  Megaphone,
  MessageCircle,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Layout } from "@/themes/theme";
import type { PlacedSection, SectionKind, SectionStyle, Shown } from "./arrangement";

// Every kind of section an event page has, and what the Arrange sheet may change about each (M8
// spec, "Sections"; ticket 24). This half is what a section is called, what it offers and its
// icon, and the Arrange sheet, a client component, reads it. What a section loads and how each
// layout draws it is a server matter, registered as a `SectionDrawing` in
// src/themes/sections/drawings.ts (ticket 25), so that importing "@/sections" never brings a
// server loader into the browser.

// The `EventPage` messages a section's default heading is read from.
export type SectionHeading =
  | "schedule.title"
  | "guests"
  | "thread.guests"
  | "announcements"
  | "comments.title"
  | "album.title"
  | "broadsheet.details"
  | "sections.countdown"
  | "sections.note"
  | "sections.links";

export type SectionEntry = {
  // Where the section's On switch lives: it has none (Details is always on), it is a column of
  // the event because it changes what the server accepts (the spec's "one switch, one truth"), or
  // it is the arrangement's own.
  switch: "none" | "column" | "stored";
  collapse: boolean;
  rename: boolean;
  // The display styles the host may choose from, the first being what every layout draws today.
  styles: readonly SectionStyle[];
  icon: LucideIcon;
  // The heading each layout gives the section when the host has not renamed it; null where the
  // layout draws none, or where the drawing words it itself (the Letter's "For {name}").
  heading: Record<Layout, SectionHeading | null>;
  // Whether the Poster draws it across both columns on a wide screen.
  wide: boolean;
  // The site's feature the section belongs to, when there is one (src/features).
  feature?: "album";
};

const everywhere = (heading: SectionHeading): Record<Layout, SectionHeading> => ({ poster: heading, broadsheet: heading, thread: heading });

export const REGISTRY: { readonly [K in SectionKind]: SectionEntry } = {
  letter: {
    switch: "column",
    collapse: false,
    rename: false,
    styles: [],
    icon: MailOpen,
    heading: { poster: null, broadsheet: null, thread: null },
    wide: false,
  },
  details: {
    switch: "none",
    collapse: false,
    rename: false,
    styles: [],
    icon: CalendarDays,
    heading: { poster: null, broadsheet: "broadsheet.details", thread: null },
    wide: false,
  },
  schedule: { switch: "stored", collapse: true, rename: true, styles: [], icon: ListOrdered, heading: everywhere("schedule.title"), wide: true },
  guests: {
    switch: "column",
    collapse: true,
    rename: true,
    styles: ["names", "avatars"],
    icon: Users,
    heading: { poster: "guests", broadsheet: "guests", thread: "thread.guests" },
    wide: false,
  },
  announcements: { switch: "stored", collapse: true, rename: true, styles: [], icon: Megaphone, heading: everywhere("announcements"), wide: false },
  comments: {
    switch: "column",
    collapse: true,
    rename: true,
    styles: ["list", "bubbles"],
    icon: MessageCircle,
    heading: everywhere("comments.title"),
    wide: true,
  },
  album: {
    switch: "column",
    collapse: true,
    rename: true,
    styles: ["grid", "mosaic", "strip"],
    icon: Images,
    heading: everywhere("album.title"),
    wide: true,
    feature: "album",
  },
  countdown: { switch: "stored", collapse: false, rename: true, styles: [], icon: Hourglass, heading: everywhere("sections.countdown"), wide: false },
  note: { switch: "stored", collapse: true, rename: true, styles: [], icon: StickyNote, heading: everywhere("sections.note"), wide: false },
  links: { switch: "stored", collapse: true, rename: true, styles: [], icon: Link2, heading: everywhere("sections.links"), wide: false },
};

// A placed section made ready to draw: its heading in words (the host's, or the layout's default
// translated), the icon beside it, and its body. `whole` is given by a drawing that frames itself,
// taking the frame's classes, in place of the layout's frame around `body`.
export type ReadySection = {
  placed: PlacedSection;
  heading: string | null;
  headingId?: string;
  icon: LucideIcon;
  wide: boolean;
  body: ReactNode;
  whole?: (className: string) => ReactNode;
};

// How the server draws one kind of section (ticket 25 registers one per kind): what it loads for
// the page, absent when the viewer gets nothing of it; what of it is shown, for the count beside a
// collapsed heading and whether it is locked to this viewer; a heading in words where it is not a
// fixed message; and its body per layout, or the whole section where a layout frames it itself.
export type SectionDrawing<D, Page> = {
  load: (page: Page) => Promise<D | undefined>;
  shown: (data: D) => Shown;
  heading?: (data: D) => string;
  headingId?: string;
  body: (data: D, layout: Layout, placed: PlacedSection) => ReactNode;
  whole?: Partial<Record<Layout, (data: D, placed: PlacedSection, className: string) => ReactNode>>;
};
