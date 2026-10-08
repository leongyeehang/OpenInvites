import { birthday } from "./templates/birthday";
import type { Template } from "./templates/template";

// The theme: the look of one event page, stored on the event (spec, "Themes and templates").
// The shape was settled by the prototype on branch prototype/event-page. The host changes knobs
// in the Design drawer.

export const LAYOUTS = ["poster", "broadsheet", "thread"] as const;
export const UPLOAD_MODES = ["background", "poster"] as const;
export const TITLE_PLACEMENTS = ["on", "below"] as const;
export const FONTS = ["serif", "grotesque", "display", "rounded"] as const;
export const TEXT_TONES = ["auto", "light", "dark"] as const;
export const BUTTON_STYLES = ["glass", "solid", "outline"] as const;
export const RSVP_STYLES = ["inline", "sheet"] as const;
export const EFFECTS = ["none", "confetti", "sparkles", "doodles"] as const;

export type Layout = (typeof LAYOUTS)[number];
export type UploadMode = (typeof UPLOAD_MODES)[number];
export type TitlePlacement = (typeof TITLE_PLACEMENTS)[number];
export type FontKey = (typeof FONTS)[number];
export type TextTone = (typeof TEXT_TONES)[number];
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
export type RsvpStyle = (typeof RSVP_STYLES)[number];
export type Effect = (typeof EFFECTS)[number];

export type Theme = {
  layout: Layout; // stored from day one; rendered once it is offered (OFFERED_LAYOUTS)
  backgroundId: string | null; // a curated background, or null when an upload is in use
  uploadId: string | null; // the host's own image (ticket 12)
  uploadMode: UploadMode;
  titlePlacement: TitlePlacement; // poster mode only
  font: FontKey;
  accentOverride: string | null; // "#rrggbb", or null to derive from the background
  textTone: TextTone;
  buttonStyle: ButtonStyle;
  rsvpStyle: RsvpStyle; // Poster layout only
  effect: Effect; // stored so templates can carry it; rendered from M2
  template: { id: string; dirty: boolean } | null; // where the host started, and whether they changed a knob
};

// The layouts a host can use today. Thread ships with ticket 13; a template made for it applies
// with the Poster layout until then, and a theme that names it renders as Poster.
export const OFFERED_LAYOUTS: readonly Layout[] = ["poster", "broadsheet"];

// Applying a template copies every knob it sets onto the theme and records the template as not
// yet changed (spec, "Themes and templates"). The host's own upload is theirs, not the
// template's: it stays in their gallery, and the template's background shows instead.
export function applyTemplate(theme: Theme | null, template: Template): Theme {
  const { layout, ...knobs } = template.theme;
  return {
    uploadId: theme?.uploadId ?? null,
    uploadMode: theme?.uploadMode ?? "background",
    ...knobs,
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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// Reads a stored theme, knob by knob. Anything missing or unrecognised takes the default, so a
// theme written by a newer version, or an empty one, still renders.
export function parseTheme(stored: unknown): Theme {
  const raw = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  const template = raw.template as { id?: unknown; dirty?: unknown } | null | undefined;
  return {
    layout: oneOf(LAYOUTS, raw.layout, DEFAULT_THEME.layout),
    // null is meaningful here (an upload is in use), so only a wrong type falls back.
    backgroundId: raw.backgroundId === null ? null : (stringOrNull(raw.backgroundId) ?? DEFAULT_THEME.backgroundId),
    uploadId: stringOrNull(raw.uploadId),
    uploadMode: oneOf(UPLOAD_MODES, raw.uploadMode, DEFAULT_THEME.uploadMode),
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
