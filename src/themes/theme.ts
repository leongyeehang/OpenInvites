// The theme: the look of one event page, stored on the event (spec, "Themes and templates").
// The shape was settled by the prototype on branch prototype/event-page. M1 stores every knob
// and renders the Poster layout; the drawer that changes knobs is ticket 10.

export const LAYOUTS = ["poster", "broadsheet", "thread"] as const;
export const UPLOAD_MODES = ["background", "poster"] as const;
export const TITLE_PLACEMENTS = ["on", "below"] as const;
export const FONTS = ["serif", "grotesque", "display", "rounded"] as const;
export const TEXT_TONES = ["auto", "light", "dark"] as const;
export const BUTTON_STYLES = ["glass", "solid", "outline"] as const;
export const RSVP_STYLES = ["inline", "sheet"] as const;
export const EFFECTS = ["none", "confetti", "sparkles", "doodles"] as const;

export type Layout = (typeof LAYOUTS)[number];
export type FontKey = (typeof FONTS)[number];
export type TextTone = (typeof TEXT_TONES)[number];
export type ButtonStyle = (typeof BUTTON_STYLES)[number];

export type Theme = {
  layout: Layout; // stored from day one; M1 renders only "poster"
  backgroundId: string | null; // a curated background, or null when an upload is in use
  uploadId: string | null; // the host's own image (ticket 12)
  uploadMode: (typeof UPLOAD_MODES)[number];
  titlePlacement: (typeof TITLE_PLACEMENTS)[number]; // poster mode only
  font: FontKey;
  accentOverride: string | null; // "#rrggbb", or null to derive from the background
  textTone: TextTone;
  buttonStyle: ButtonStyle;
  rsvpStyle: (typeof RSVP_STYLES)[number]; // Poster layout only
  effect: (typeof EFFECTS)[number]; // stored so templates can carry it; rendered from M2
  template: { id: string; dirty: boolean } | null; // where the host started, and whether they changed a knob
};

// The Birthday template's knobs (PROTOTYPE.md: round one's A, Golden hour). Every new event
// starts here. Ticket 10 moves these values into the template's own data file.
export const DEFAULT_THEME: Theme = {
  layout: "poster",
  backgroundId: "golden",
  uploadId: null,
  uploadMode: "background",
  titlePlacement: "below",
  font: "serif",
  accentOverride: null,
  textTone: "auto",
  buttonStyle: "glass",
  rsvpStyle: "sheet",
  effect: "sparkles",
  template: { id: "birthday", dirty: false },
};

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
