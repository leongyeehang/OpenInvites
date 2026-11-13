import { clipRichText, EMPTY_RICH_TEXT, parseRichText, type RichText } from "@/rich-text/rich-text";
import type { GuestListVisibility } from "@/rsvps/visibility";
import type { Layout } from "@/themes/theme";
import { REGISTRY } from "./registry";

// An event's arrangement (M8 spec, "Sections"; ticket 24): the order of its page's sections and,
// per section, whether it is on where that is the arrangement's to say, collapsed, renamed or
// drawn in a style, and the content of the host's Notes and Links. These are the rules alone:
// ticket 25 stores the arrangement in `event.sections` and draws it, and the Arrange sheet makes
// its changes through the same functions the server checks them with.

type Common = { collapsed: boolean; heading: string | null }; // heading null: the translated default

export type SectionLink = { label: string; url: string };

export type Section = Common &
  (
    | { kind: "letter" }
    | { kind: "details" }
    | { kind: "schedule"; on: boolean }
    | { kind: "guests"; style: "names" | "avatars" }
    | { kind: "announcements"; on: boolean }
    | { kind: "comments"; style: "list" | "bubbles" }
    | { kind: "album"; style: "grid" | "mosaic" | "strip" }
    | { kind: "countdown"; on: boolean }
    | { kind: "note"; id: string; on: boolean; body: RichText }
    | { kind: "links"; id: string; on: boolean; links: SectionLink[] }
  );

export type SectionKind = Section["kind"];
export type BuiltInKind = Exclude<SectionKind, "note" | "links">;
export type SectionStyle = "grid" | "mosaic" | "strip" | "list" | "bubbles" | "names" | "avatars";

// Absent (null) means never arranged, which places each layout's sections exactly as before 0.8.
export type Arrangement = { sections: Section[] } | null;

export const SECTION_LIMITS = { custom: 10, heading: 40, note: 2000, links: 6, label: 40, url: 2000 } as const;

// The event's switches that are columns, because they change what the server accepts (the spec's
// "one switch, one truth"): Arrange turns them with their sections.
export type Switches = {
  lettersEnabled: boolean;
  commentsEnabled: boolean;
  guestListVisibility: GuestListVisibility;
  albumEnabled: boolean;
};

// A change names a section by its key. `move` names the neighbour the sheet shows (`past`) rather
// than a step of one, so a section the sheet hides (the album where the site has none) never
// swallows a press, and a move still lands where the host meant when another host has moved
// that neighbour meanwhile.
export type ArrangementChange =
  | { type: "move"; key: string; past: string }
  | { type: "toggle"; key: string; on: boolean }
  | { type: "collapse"; key: string; collapsed: boolean }
  | { type: "style"; key: string; style: SectionStyle }
  | { type: "rename"; key: string; heading: string | null }
  | { type: "audience"; visibility: "always" | "afterReply" }
  | { type: "addNote" | "addLinks"; id: string; after: string | null; heading: string | null }
  | { type: "editNote"; key: string; body: RichText }
  | { type: "editLinks"; key: string; links: SectionLink[] }
  | { type: "remove"; key: string };

export type ArrangementError =
  | "unreadable"
  | "unknownSection"
  | "notOffered"
  | "tooManySections"
  | "headingTooLong"
  | "noteTooLong"
  | "tooManyLinks"
  | "labelTooLong"
  | "urlTooLong"
  | "urlInvalid";

// What of a built-in section this viewer gets, from its drawing (ticket 25): the number beside a
// collapsed heading, if it has one, and whether it is locked to them (a locked section is never
// collapsed, since its body is already only a promise).
export type Shown = { count: number | null; locked?: boolean };

// A section as the page places it. `index` is its place in the full order, counting what is not
// placed, so a section's entrance delay does not change when one before it is not shown.
export type PlacedSection = {
  key: string;
  kind: SectionKind;
  heading: string | null;
  collapsed: boolean;
  style: SectionStyle | null;
  count: number | null;
  index: number;
  section: Section;
};

// A row of the Arrange sheet.
export type SheetRow = { key: string; kind: SectionKind; heading: string | null; on: boolean; collapsed: boolean; style: SectionStyle | null };

const STYLES: readonly SectionStyle[] = ["grid", "mosaic", "strip", "list", "bubbles", "names", "avatars"];

// Today's order in the Poster and the Thread; the Broadsheet puts the announcements before Who's
// coming. The countdown is last everywhere so that ticket 25's entrance delays, which count the
// index, stay as they were on the Poster.
const POSTER_ORDER: readonly BuiltInKind[] = ["letter", "details", "schedule", "guests", "announcements", "comments", "album", "countdown"];
const BROADSHEET_ORDER: readonly BuiltInKind[] = ["letter", "details", "schedule", "announcements", "guests", "comments", "album", "countdown"];

const ID = /^[0-9a-z]{8}$/;

export function sectionKey(section: Section): string {
  return section.kind === "note" || section.kind === "links" ? `${section.kind}:${section.id}` : section.kind;
}

// A new Note's or Links' id: eight base-36 characters, drawn evenly.
export function sectionId(): string {
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
  let id = "";
  while (id.length < 8) {
    const [byte] = crypto.getRandomValues(new Uint8Array(1));
    if (byte < 252) id += digits[byte % 36]; // 252 is 7 × 36: a larger byte would favour the first digits
  }
  return id;
}

const isBuiltIn = (kind: SectionKind): kind is BuiltInKind => kind !== "note" && kind !== "links";
const isWritten = (section: Section) => section.kind === "note" || section.kind === "links";

// A built-in section as no host has changed it: on where its switch is the arrangement's (the
// countdown excepted, which is off until the host wants it), in its first style, which the
// registry names, and collapsed only for the Thread's comments, which today's Thread folds away.
function builtIn(kind: BuiltInKind, layout: Layout): Section {
  const common: Common = { collapsed: kind === "comments" && layout === "thread", heading: null };
  switch (kind) {
    case "schedule":
    case "announcements":
      return { kind, on: true, ...common };
    case "countdown":
      return { kind, on: false, ...common };
    case "guests":
    case "comments":
    case "album":
      return { kind, style: REGISTRY[kind].styles[0], ...common } as Section;
    default:
      return { kind, ...common };
  }
}

export function defaultOrder(layout: Layout): Section[] {
  return (layout === "broadsheet" ? BROADSHEET_ORDER : POSTER_ORDER).map((kind) => builtIn(kind, layout));
}

// Counted by character (code point), as a person counts them: forty Chinese characters or forty
// emoji are forty, not eighty.
const characters = (text: string) => [...text].length;
const clipped = (text: string, max: number) => [...text].slice(0, max).join("");
const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

// An address a guest may be sent to from a Links section: http or https only (spec, "Links"),
// checked on save and again on drawing. One typed without a scheme is taken as https.
function readLinkUrl(value: unknown): { ok: true; url: string } | { ok: false; error: "urlTooLong" | "urlInvalid" } {
  if (typeof value !== "string" || value.trim() === "") return { ok: false, error: "urlInvalid" };
  const typed = value.trim();
  // A scheme is letters before a colon; "example.com:8080" is a host and a port.
  const candidate = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(typed) ? typed : `https://${typed}`;
  if (candidate.length > SECTION_LIMITS.url) return { ok: false, error: "urlTooLong" };
  try {
    const url = new URL(candidate);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return { ok: false, error: "urlInvalid" };
    // A name or password before the host ("https://bank.example@evil.example/") reads as one site
    // to a person and goes to another.
    if (url.username !== "" || url.password !== "") return { ok: false, error: "urlInvalid" };
    return url.href.length > SECTION_LIMITS.url ? { ok: false, error: "urlTooLong" } : { ok: true, url: url.href };
  } catch {
    return { ok: false, error: "urlInvalid" };
  }
}

export function safeLinkUrl(value: unknown): string | undefined {
  const read = readLinkUrl(value);
  return read.ok ? read.url : undefined;
}

// The site a link goes to, as shown under its label: the host name without a leading "www.".
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const storedHeading = (value: unknown): string | null => {
  const heading = typeof value === "string" ? clipped(tidy(value), SECTION_LIMITS.heading) : "";
  return heading === "" ? null : heading;
};

// The first six links it would follow; nothing after them is read.
function storedLinks(value: unknown): SectionLink[] {
  const links: SectionLink[] = [];
  for (const each of Array.isArray(value) ? value : []) {
    if (links.length === SECTION_LIMITS.links) break;
    const raw = asRecord(each);
    const url = safeLinkUrl(raw?.url);
    if (!raw || !url) continue;
    links.push({ label: clipped(tidy(typeof raw.label === "string" ? raw.label : ""), SECTION_LIMITS.label), url });
  }
  return links;
}

// One stored entry read back, or undefined to drop it. What the registry does not offer a kind is
// put back as the kind has it by default, and what is longer than its limit is clipped.
function storedSection(value: unknown): Section | undefined {
  const raw = asRecord(value);
  const kind = raw?.kind;
  if (!raw || typeof kind !== "string" || !Object.hasOwn(REGISTRY, kind)) return undefined;
  const entry = REGISTRY[kind as SectionKind];
  const common: Common = { collapsed: entry.collapse && raw.collapsed === true, heading: entry.rename ? storedHeading(raw.heading) : null };
  const on = (fallback: boolean) => (typeof raw.on === "boolean" ? raw.on : fallback);

  if (kind === "note" || kind === "links") {
    if (typeof raw.id !== "string" || !ID.test(raw.id)) return undefined;
    if (kind === "links") return { kind, id: raw.id, on: on(true), ...common, links: storedLinks(raw.links) };
    const body = parseRichText(raw.body, Number.POSITIVE_INFINITY);
    return { kind, id: raw.id, on: on(true), ...common, body: body.ok ? clipRichText(body.doc, SECTION_LIMITS.note) : EMPTY_RICH_TEXT };
  }

  const section = { ...builtIn(kind as BuiltInKind, "poster"), ...common };
  if ("on" in section) section.on = on(section.on);
  if ("style" in section && entry.styles.includes(raw.style as SectionStyle)) section.style = raw.style as typeof section.style;
  return section;
}

// Reads `event.sections` as stored. Anything unreadable is dropped rather than refused, so a
// damaged value costs the host part of their arrangement and never the page. A built-in section
// missing from it (one a later version adds) goes in after the section before it in the Poster's
// order, since this takes no layout.
export function parseArrangement(stored: unknown): Arrangement {
  const entries = asRecord(stored)?.sections;
  if (!Array.isArray(entries)) return null;

  const sections: Section[] = [];
  const seen = new Set<string>();
  let written = 0;
  for (const entry of entries) {
    // Once ten written sections are kept, another is dropped by its kind alone, its content unread.
    const kind = asRecord(entry)?.kind;
    if ((kind === "note" || kind === "links") && written >= SECTION_LIMITS.custom) continue;
    const section = storedSection(entry);
    if (!section || seen.has(sectionKey(section))) continue;
    if (isWritten(section)) written += 1;
    seen.add(sectionKey(section));
    sections.push(section);
  }

  POSTER_ORDER.forEach((kind, place) => {
    if (seen.has(kind)) return;
    const before = place === 0 ? -1 : sections.findIndex((section) => section.kind === POSTER_ORDER[place - 1]);
    sections.splice(before + 1, 0, builtIn(kind, "poster"));
    seen.add(kind);
  });
  return { sections };
}

type Parsed = { ok: true; change: ArrangementChange } | { ok: false; error: ArrangementError };

const unreadable: Parsed = { ok: false, error: "unreadable" };

// A heading as the host typed it: spaces tidied, none when nothing is left, refused over 40, and
// unreadable when it is not words at all.
function postedHeading(value: unknown): { ok: true; heading: string | null } | { ok: false; error: "unreadable" | "headingTooLong" } {
  if (value === null || value === undefined) return { ok: true, heading: null };
  if (typeof value !== "string") return { ok: false, error: "unreadable" };
  const heading = tidy(value);
  if (characters(heading) > SECTION_LIMITS.heading) return { ok: false, error: "headingTooLong" };
  return { ok: true, heading: heading === "" ? null : heading };
}

function postedLinks(value: unknown): { ok: true; links: SectionLink[] } | { ok: false; error: ArrangementError } {
  if (!Array.isArray(value)) return { ok: false, error: "unreadable" };
  if (value.length > SECTION_LIMITS.links) return { ok: false, error: "tooManyLinks" };
  const links: SectionLink[] = [];
  for (const each of value) {
    const raw = asRecord(each);
    if (!raw || (raw.label !== undefined && typeof raw.label !== "string")) return { ok: false, error: "unreadable" };
    const label = tidy(typeof raw.label === "string" ? raw.label : "");
    if (characters(label) > SECTION_LIMITS.label) return { ok: false, error: "labelTooLong" };
    const url = readLinkUrl(raw.url);
    if (!url.ok) return url;
    links.push({ label, url: url.url });
  }
  return { ok: true, links };
}

// Reads a change the Arrange sheet posted. A new Note's or Links' id is always made here
// (`makeId`), never taken from the post.
export function parseArrangementChange(posted: unknown, makeId: () => string): Parsed {
  const raw = asRecord(posted);
  if (!raw) return unreadable;
  const key = typeof raw.key === "string" && raw.key !== "" ? raw.key : undefined;

  switch (raw.type) {
    case "move":
      return key && typeof raw.past === "string" ? { ok: true, change: { type: "move", key, past: raw.past } } : unreadable;
    case "toggle":
      return key && typeof raw.on === "boolean" ? { ok: true, change: { type: "toggle", key, on: raw.on } } : unreadable;
    case "collapse":
      return key && typeof raw.collapsed === "boolean" ? { ok: true, change: { type: "collapse", key, collapsed: raw.collapsed } } : unreadable;
    case "style":
      return key && STYLES.includes(raw.style as SectionStyle) ? { ok: true, change: { type: "style", key, style: raw.style as SectionStyle } } : unreadable;
    case "rename": {
      if (!key) return unreadable;
      const heading = postedHeading(raw.heading);
      return heading.ok ? { ok: true, change: { type: "rename", key, heading: heading.heading } } : heading;
    }
    case "audience":
      return raw.visibility === "always" || raw.visibility === "afterReply" ? { ok: true, change: { type: "audience", visibility: raw.visibility } } : unreadable;
    case "addNote":
    case "addLinks": {
      if (raw.after !== undefined && raw.after !== null && typeof raw.after !== "string") return unreadable;
      const heading = postedHeading(raw.heading);
      if (!heading.ok) return heading;
      return { ok: true, change: { type: raw.type, id: makeId(), after: typeof raw.after === "string" ? raw.after : null, heading: heading.heading } };
    }
    case "editNote": {
      if (!key) return unreadable;
      const body = parseRichText(raw.body, SECTION_LIMITS.note);
      return body.ok ? { ok: true, change: { type: "editNote", key, body: body.doc } } : { ok: false, error: "noteTooLong" };
    }
    case "editLinks": {
      if (!key) return unreadable;
      const links = postedLinks(raw.links);
      return links.ok ? { ok: true, change: { type: "editLinks", key, links: links.links } } : links;
    }
    case "remove":
      return key ? { ok: true, change: { type: "remove", key } } : unreadable;
    default:
      return unreadable;
  }
}

type Applied = { ok: true; arrangement: { sections: Section[] } } | { ok: false; error: ArrangementError };

// Applies a parsed change, starting from the layout's default when the event was never arranged,
// so the first change stores the whole order. The server applies it under the event's row lock;
// the Arrange sheet applies the same change to show it at once.
export function applyArrangementChange(arrangement: Arrangement, layout: Layout, change: ArrangementChange): Applied {
  const sections = [...(arrangement?.sections ?? defaultOrder(layout))];
  const done = (): Applied => ({ ok: true, arrangement: { sections } });
  const refused = (error: ArrangementError): Applied => ({ ok: false, error });

  if (change.type === "audience") return done();

  // addNote and addLinks, the changes that name no section yet.
  if ("id" in change) {
    if (sections.filter(isWritten).length >= SECTION_LIMITS.custom) return refused("tooManySections");
    const after = change.after === null ? sections.length - 1 : sections.findIndex((section) => sectionKey(section) === change.after);
    if (after < 0 && change.after !== null) return refused("unknownSection");
    const common = { id: change.id, on: true, collapsed: false, heading: change.heading };
    const added: Section = change.type === "addNote" ? { kind: "note", ...common, body: EMPTY_RICH_TEXT } : { kind: "links", ...common, links: [] };
    if (sections.some((section) => sectionKey(section) === sectionKey(added))) return refused("unreadable");
    sections.splice(after + 1, 0, added);
    return done();
  }

  const at = sections.findIndex((section) => sectionKey(section) === change.key);
  if (at < 0) return refused("unknownSection");
  const section = sections[at];
  const entry = REGISTRY[section.kind];

  switch (change.type) {
    case "move": {
      const past = sections.findIndex((each) => sectionKey(each) === change.past);
      if (past < 0) return refused("unknownSection");
      if (past === at) return done();
      sections.splice(at, 1);
      // Moving down lands just after the neighbour, moving up just before it.
      const neighbour = sections.findIndex((each) => sectionKey(each) === change.past);
      sections.splice(at < past ? neighbour + 1 : neighbour, 0, section);
      return done();
    }
    case "toggle":
      if (entry.switch === "none") return refused("notOffered");
      // A column's switch is the event's: switchesAfter turns it, and the order stays.
      if ("on" in section) sections[at] = { ...section, on: change.on };
      return done();
    case "collapse":
      if (!entry.collapse) return refused("notOffered");
      sections[at] = { ...section, collapsed: change.collapsed };
      return done();
    case "style":
      if (!("style" in section) || !entry.styles.includes(change.style)) return refused("notOffered");
      sections[at] = { ...section, style: change.style } as Section;
      return done();
    case "rename":
      if (!entry.rename) return refused("notOffered");
      sections[at] = { ...section, heading: change.heading };
      return done();
    case "editNote":
      if (section.kind !== "note") return refused("notOffered");
      sections[at] = { ...section, body: change.body };
      return done();
    case "editLinks":
      if (section.kind !== "links") return refused("notOffered");
      sections[at] = { ...section, links: change.links };
      return done();
    case "remove":
      if (!isWritten(section)) return refused("notOffered");
      sections.splice(at, 1);
      return done();
  }
}

// The event's switches after a change: the four whose switch is a column turn with their
// sections, and `audience` sets who sees the guest list. Switching Who's coming on from off gives
// "after you reply", the default.
export function switchesAfter(switches: Switches, change: ArrangementChange): Switches {
  if (change.type === "audience") return { ...switches, guestListVisibility: change.visibility };
  if (change.type !== "toggle") return switches;
  switch (change.key) {
    case "letter":
      return { ...switches, lettersEnabled: change.on };
    case "comments":
      return { ...switches, commentsEnabled: change.on };
    case "album":
      return { ...switches, albumEnabled: change.on };
    case "guests": {
      const visibility = !change.on ? "hidden" : switches.guestListVisibility === "hidden" ? "afterReply" : switches.guestListVisibility;
      return { ...switches, guestListVisibility: visibility };
    }
    default:
      return switches;
  }
}

const styleOf = (section: Section): SectionStyle | null => ("style" in section ? section.style : null);

// The sections a page draws, in order. A built-in section is placed when its drawing gave this
// viewer something of it (`shown`) and, where its switch is the arrangement's, it is on; a Note or
// Links when it is on and has something in it.
export function placedSections(arrangement: Arrangement, layout: Layout, shown: Partial<Record<BuiltInKind, Shown>>): PlacedSection[] {
  const sections = arrangement?.sections ?? defaultOrder(layout);
  return sections.flatMap((section, index): PlacedSection[] => {
    if ("on" in section && !section.on) return [];
    const place = (count: number | null, collapsed: boolean): PlacedSection[] => [
      { key: sectionKey(section), kind: section.kind, heading: section.heading, collapsed, style: styleOf(section), count, index, section },
    ];
    if (section.kind === "note") return section.body.blocks.length > 0 ? place(null, section.collapsed) : [];
    if (section.kind === "links") return section.links.length > 0 ? place(section.links.length, section.collapsed) : [];
    const given = isBuiltIn(section.kind) ? shown[section.kind] : undefined;
    return given ? place(given.count, section.collapsed && !given.locked) : [];
  });
}

// The Arrange sheet's rows, in the page's order: one per section, less the album where the site
// does not offer it, each on as its switch says.
export function sheetRows(arrangement: Arrangement, layout: Layout, switches: Switches, offered: { album: boolean }): SheetRow[] {
  const columns: Record<string, boolean> = {
    letter: switches.lettersEnabled,
    guests: switches.guestListVisibility !== "hidden",
    comments: switches.commentsEnabled,
    album: switches.albumEnabled,
  };
  return (arrangement?.sections ?? defaultOrder(layout))
    .filter((section) => offered.album || section.kind !== "album")
    .map((section) => {
      const entry = REGISTRY[section.kind];
      const on = entry.switch === "none" ? true : entry.switch === "column" ? columns[section.kind] : "on" in section && section.on;
      return { key: sectionKey(section), kind: section.kind, heading: section.heading, on, collapsed: section.collapsed, style: styleOf(section) };
    });
}
