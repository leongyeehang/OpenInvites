import { findBackground } from "./backgrounds";
import { birthday } from "./templates/birthday";
import type { Template } from "./templates/template";

// The theme: the look of one event page, stored on the event (spec, "Themes and templates").
// The shape was settled by the prototype on branch prototype/event-page. The host changes knobs
// in the Design drawer.

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
  effect: Effect; // stored so templates can carry it; rendered from M2
  template: { id: string; dirty: boolean } | null; // where the host started, and whether they changed a knob
};

// The layouts a host can use: all three since M2. A layout added later can be stored before it
// is offered; until then a template made for it applies with the Poster layout, and a theme that
// names it renders as Poster.
export const OFFERED_LAYOUTS: readonly Layout[] = ["poster", "broadsheet", "thread"];

// The poster a curated background is: a scene of the gallery is a gallery poster, a gradient a
// colour poster. Undefined for an id the gallery does not have.
export function curatedPoster(id: string): Poster | undefined {
  const background = findBackground(id);
  if (!background) return undefined;
  return background.kind === "photo" ? { kind: "gallery", id } : { kind: "colour", id };
}

// Applying a template copies every knob it sets onto the theme and records the template as not
// yet changed (spec, "Themes and templates"). Its background becomes the poster. The host's own
// upload is theirs, not the template's: it stays on the event, to go back to.
export function applyTemplate(_theme: Theme | null, template: Template): Theme {
  const { layout, backgroundId, ...knobs } = template.theme;
  return {
    ...knobs,
    poster: curatedPoster(backgroundId) ?? { kind: "colour", id: "golden" },
    layout: OFFERED_LAYOUTS.includes(layout) ? layout : "poster",
    template: { id: template.id, dirty: false },
  };
}

// Every new event starts from the Birthday template (PROTOTYPE.md: round one's A, Golden hour).
export const DEFAULT_THEME: Theme = applyTemplate(null, birthday);

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

// Reads a stored theme, knob by knob. Anything missing or unrecognised takes the default, so a
// theme written by a newer version, or an empty one, still renders.
export function parseTheme(stored: unknown): Theme {
  const raw = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  const template = raw.template as { id?: unknown; dirty?: unknown } | null | undefined;
  return {
    layout: oneOf(LAYOUTS, raw.layout, DEFAULT_THEME.layout),
    poster: parsePoster(raw),
    titlePlacement: oneOf(TITLE_PLACEMENTS, raw.titlePlacement, DEFAULT_THEME.titlePlacement),
    font: oneOf(FONTS, raw.font, DEFAULT_THEME.font),
    accentOverride: typeof raw.accentOverride === "string" && HEX_COLOUR.test(raw.accentOverride) ? raw.accentOverride : null,
    textTone: oneOf(TEXT_TONES, raw.textTone, DEFAULT_THEME.textTone),
    buttonStyle: oneOf(BUTTON_STYLES, raw.buttonStyle, DEFAULT_THEME.buttonStyle),
    rsvpStyle: oneOf(RSVP_STYLES, raw.rsvpStyle, DEFAULT_THEME.rsvpStyle),
    effect: oneOf(EFFECTS, raw.effect, DEFAULT_THEME.effect),
    template:
      template === null
        ? null
        : typeof template?.id === "string" && typeof template.dirty === "boolean"
          ? { id: template.id, dirty: template.dirty }
          : DEFAULT_THEME.template,
  };
}
