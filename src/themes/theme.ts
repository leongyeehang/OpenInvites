import { findBackground } from "./backgrounds";
import { findGalleryPoster, type GalleryPoster } from "./posters";

// The theme: the look of one event page, stored on the event (spec, "Themes and templates").
// The shape was settled by the prototype on branch prototype/event-page. The host changes knobs
// in the editor's design sheets.

export const LAYOUTS = ["poster", "broadsheet", "thread"] as const;
export const TITLE_PLACEMENTS = ["on", "below"] as const;
export const FONTS = ["serif", "grotesque", "display", "rounded"] as const;
export const TEXT_TONES = ["auto", "light", "dark"] as const;
export const BUTTON_STYLES = ["glass", "solid", "outline"] as const;
export const RSVP_STYLES = ["inline", "sheet"] as const;
export const EFFECTS = ["none", "confetti", "sparkles", "doodles"] as const;

export type Layout = (typeof LAYOUTS)[number];
export type TitlePlacement = (typeof TITLE_PLACEMENTS)[number];
export type FontKey = (typeof FONTS)[number];
export type TextTone = (typeof TEXT_TONES)[number];
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
export type RsvpStyle = (typeof RSVP_STYLES)[number];
export type Effect = (typeof EFFECTS)[number];

// The picture at the top of every invitation (M4 spec, "The poster replaces the background"): one
// of the gallery's scenes, one of its colours, or the event's own upload, a photo or an emoji
// pattern the host made. An event has at most one upload (its row is unique per event, and a new
// one replaces the old), so the theme names none: "upload" means the event's own.
export type Poster = { kind: "gallery"; id: string } | { kind: "colour"; id: string } | { kind: "upload" };

export type Theme = {
  layout: Layout; // stored from day one; rendered once it is offered (OFFERED_LAYOUTS)
  poster: Poster;
  titlePlacement: TitlePlacement; // where the title goes on an upload, on it or below it
  font: FontKey;
  accentOverride: string | null; // "#rrggbb", or null to derive from the background
  textTone: TextTone;
  buttonStyle: ButtonStyle;
  rsvpStyle: RsvpStyle; // Poster layout only
  effect: Effect; // rendered from M2
  // The gallery poster whose look the host last applied, and whether they have changed a knob of
  // it since; null before they ever pick one.
  template: { posterId: string; dirty: boolean } | null;
};

// The layouts a host can use: all three since M2. A layout added later can be stored before it
// is offered; until then a theme that names it renders as Poster.
export const OFFERED_LAYOUTS: readonly Layout[] = ["poster", "broadsheet", "thread"];

// The curated poster an id names: one of the gallery's posters (posters.ts), or one of its
// colours (backgrounds.ts). Undefined for an id the gallery does not have.
export function curatedPoster(id: string): Poster | undefined {
  if (findGalleryPoster(id)) return { kind: "gallery", id };
  if (findBackground(id)) return { kind: "colour", id };
  return undefined;
}

// Picking a gallery poster applies its look, as applying a template did in 0.4, and records it as
// not yet changed (M4 spec, "Templates fold into the gallery"). The poster brings its own accent,
// so the accent goes back to Auto; the layout, the text tone and the RSVP style stay the host's.
// So does the host's upload: it stays on the event, to go back to.
export function applyPosterLook(theme: Theme, poster: GalleryPoster): Theme {
  return {
    ...theme,
    ...poster.look,
    poster: { kind: "gallery", id: poster.id },
    accentOverride: null,
    template: { posterId: poster.id, dirty: false },
  };
}

// Every new event starts as round one's A (PROTOTYPE.md), the Birthday template of 0.4: Golden
// hour, a large serif title, frosted glass and sparkles.
export const DEFAULT_THEME: Theme = {
  layout: "poster",
  poster: { kind: "colour", id: "golden" },
  titlePlacement: "below",
  font: "serif",
  accentOverride: null,
  textTone: "auto",
  buttonStyle: "glass",
  rsvpStyle: "sheet",
  effect: "sparkles",
  template: null,
};

// The six templates of 0.4, and the gallery poster each became: a theme that started from one
// started from that poster's look. Their ids are stored on events made before M4, so they stay
// readable for good.
export const LEGACY_TEMPLATES: Readonly<Record<string, string>> = {
  birthday: "candles",
  vows: "rose",
  supper: "candlelight",
  kids: "balloons",
  festival: "aurora",
  quiet: "bokeh",
};

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

// The backgrounds 0.3 and 0.4 made from the host's picture (Soft blur and Colour wash). A theme
// that names one shows the picture itself now.
const DERIVED_BACKGROUND_IDS = ["upload-blur", "upload-wash"];

// The poster a stored theme names. A theme written since M4 names it; one written by 0.4 or
// earlier named a background and, separately, whether the host's picture was in use, and is read
// into the poster it amounts to: a curated scene or gradient becomes that gallery or colour
// poster, and the picture in use, as the background, as the poster or under a background made
// from it, becomes the upload. Nothing is migrated in the database: the next save writes the new
// shape.
function parsePoster(raw: Record<string, unknown>): Poster {
  const poster = raw.poster as { kind?: unknown; id?: unknown } | null | undefined;
  if (typeof poster === "object" && poster !== null) {
    if (poster.kind === "upload") return { kind: "upload" };
    if ((poster.kind === "gallery" || poster.kind === "colour") && typeof poster.id === "string") {
      const curated = curatedPoster(poster.id);
      if (curated?.kind === poster.kind) return curated;
    }
    return DEFAULT_THEME.poster;
  }
  const backgroundId = raw.backgroundId;
  // 0.4: a null background meant the host's picture was in use.
  if (backgroundId === null) return { kind: "upload" };
  if (typeof backgroundId !== "string") return DEFAULT_THEME.poster;
  if (DERIVED_BACKGROUND_IDS.includes(backgroundId)) return typeof raw.uploadId === "string" ? { kind: "upload" } : DEFAULT_THEME.poster;
  return curatedPoster(backgroundId) ?? DEFAULT_THEME.poster;
}

// Which gallery poster's look a stored theme started from. Since M4 that is a poster's id; a
// theme written by 0.4 named a template, and started from the poster it became, changed since
// unless that poster is the one shown (in 0.4 a template showed a background, and only Vows' and
// Festival's were scenes that are gallery posters now).
function parseTemplate(raw: unknown, poster: Poster): Theme["template"] {
  if (typeof raw !== "object" || raw === null) return null;
  const { posterId, id, dirty } = raw as { posterId?: unknown; id?: unknown; dirty?: unknown };
  if (typeof dirty !== "boolean") return null;
  if (typeof posterId === "string") return findGalleryPoster(posterId) ? { posterId, dirty } : null;
  const legacy = typeof id === "string" && Object.hasOwn(LEGACY_TEMPLATES, id) ? LEGACY_TEMPLATES[id] : undefined;
  if (!legacy) return null;
  const shown = poster.kind === "gallery" && poster.id === legacy;
  return { posterId: legacy, dirty: dirty || !shown };
}

// Reads a stored theme, knob by knob. Anything missing or unrecognised takes the default, so a
// theme written by a newer version, or an empty one, still renders.
export function parseTheme(stored: unknown): Theme {
  const raw = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  const poster = parsePoster(raw);
  return {
    layout: oneOf(LAYOUTS, raw.layout, DEFAULT_THEME.layout),
    poster,
    titlePlacement: oneOf(TITLE_PLACEMENTS, raw.titlePlacement, DEFAULT_THEME.titlePlacement),
    font: oneOf(FONTS, raw.font, DEFAULT_THEME.font),
    accentOverride: typeof raw.accentOverride === "string" && HEX_COLOUR.test(raw.accentOverride) ? raw.accentOverride : null,
    textTone: oneOf(TEXT_TONES, raw.textTone, DEFAULT_THEME.textTone),
    buttonStyle: oneOf(BUTTON_STYLES, raw.buttonStyle, DEFAULT_THEME.buttonStyle),
    rsvpStyle: oneOf(RSVP_STYLES, raw.rsvpStyle, DEFAULT_THEME.rsvpStyle),
    effect: oneOf(EFFECTS, raw.effect, DEFAULT_THEME.effect),
    template: parseTemplate(raw.template, poster),
  };
}
