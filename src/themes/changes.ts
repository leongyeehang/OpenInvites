import { isSwatch } from "./swatches";
import { findTemplate, type TemplateId } from "./templates";
import {
  applyTemplate,
  BUTTON_STYLES,
  curatedPoster,
  EFFECTS,
  FONTS,
  OFFERED_LAYOUTS,
  RSVP_STYLES,
  TEXT_TONES,
  TITLE_PLACEMENTS,
  type ButtonStyle,
  type Effect,
  type FontKey,
  type Layout,
  type Poster,
  type RsvpStyle,
  type TextTone,
  type Theme,
  type TitlePlacement,
} from "./theme";

// What the Design drawer asks for: a template, or one knob set to one value. The layout is one of
// those offered; changing it keeps every other knob, the Poster's RSVP style included. The poster
// is a curated one or the event's own upload; a new upload is not the drawer's to show, the
// server shows it once it has stored the picture (showNewUpload, uploads/repository.ts).
export type KnobChange =
  | { knob: "layout"; value: Layout }
  | { knob: "poster"; value: Poster }
  | { knob: "titlePlacement"; value: TitlePlacement }
  | { knob: "font"; value: FontKey }
  | { knob: "accentOverride"; value: string | null }
  | { knob: "textTone"; value: TextTone }
  | { knob: "buttonStyle"; value: ButtonStyle }
  | { knob: "rsvpStyle"; value: RsvpStyle }
  | { knob: "effect"; value: Effect };

export type ThemeChange = { template: string } | KnobChange;

// The theme after a change. Changing any knob marks the template dirty, so the theme reads
// "custom, started from" it; applying a template, the same one included, starts clean again.
// Picking what is already chosen changes nothing, not even the dirty flag.
export function applyChange(theme: Theme, change: ThemeChange): Theme {
  if ("template" in change) {
    const template = findTemplate(change.template);
    const applied = template && applyTemplate(theme, template);
    return applied && !sameTheme(applied, theme) ? applied : theme;
  }
  const changed = changeKnob(theme, change);
  if (changed === theme) return theme;
  return { ...changed, template: theme.template && { ...theme.template, dirty: true } };
}

function changeKnob(theme: Theme, change: KnobChange): Theme {
  if (change.knob === "poster") {
    if (samePoster(theme.poster, change.value)) return theme;
    // A new poster brings its own accent: an override picked against the old picture may not suit
    // the new one (PROTOTYPE.md, the drawer).
    return { ...theme, poster: change.value, accentOverride: null };
  }
  if (theme[change.knob] === change.value) return theme;
  return { ...theme, [change.knob]: change.value };
}

function samePoster(a: Poster, b: Poster): boolean {
  return a.kind === b.kind && (a.kind === "upload" || a.id === (b as { id: string }).id);
}

// The theme once the host's new picture is stored: the picture is the poster, and brings its own
// accent, as any new poster does, even when the picture it replaces was the poster already. Like
// any knob, it marks the template dirty.
export function showNewUpload(theme: Theme): Theme {
  return { ...theme, poster: { kind: "upload" }, accentOverride: null, template: theme.template && { ...theme.template, dirty: true } };
}

function sameTheme(a: Theme, b: Theme): boolean {
  return (Object.keys(a) as (keyof Theme)[]).every((knob) =>
    knob === "template"
      ? a.template?.id === b.template?.id && a.template?.dirty === b.template?.dirty
      : knob === "poster"
        ? samePoster(a.poster, b.poster)
        : a[knob] === b[knob],
  );
}

// What the drawer says the theme is: a template (by id; the drawer names it), or custom and
// where it started.
export type ThemeReadout = { custom: false; template: TemplateId } | { custom: true; template?: TemplateId };

export function themeReadout(theme: Theme): ThemeReadout {
  const template = theme.template && findTemplate(theme.template.id);
  if (!template) return { custom: true };
  return { custom: theme.template!.dirty, template: template.id };
}

function oneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return options.includes(value as T);
}

// A change as the drawer sent it, checked like any other input from a browser. Only what the
// drawer offers is accepted: the accent must be auto or one of the six swatches, so every
// colour a page can wear is one legibility.ts has checked; a curated poster must be in the
// gallery, as the kind it is; and the host's picture can be the poster only on an event that has
// one (`upload`, its id, or null when it has none).
export function parseThemeChange(raw: unknown, upload: string | null = null): ThemeChange | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const { template, knob, value } = raw as { template?: unknown; knob?: unknown; value?: unknown };
  if (template !== undefined) return typeof template === "string" && findTemplate(template) ? { template } : undefined;

  switch (knob) {
    case "layout":
      return oneOf(OFFERED_LAYOUTS, value) ? { knob, value } : undefined;
    case "poster":
      return parsePosterChange(value, upload);
    case "titlePlacement":
      return oneOf(TITLE_PLACEMENTS, value) ? { knob, value } : undefined;
    case "font":
      return oneOf(FONTS, value) ? { knob, value } : undefined;
    case "accentOverride":
      return value === null || isSwatch(value) ? { knob, value } : undefined;
    case "textTone":
      return oneOf(TEXT_TONES, value) ? { knob, value } : undefined;
    case "buttonStyle":
      return oneOf(BUTTON_STYLES, value) ? { knob, value } : undefined;
    case "rsvpStyle":
      return oneOf(RSVP_STYLES, value) ? { knob, value } : undefined;
    case "effect":
      return oneOf(EFFECTS, value) ? { knob, value } : undefined;
    default:
      return undefined;
  }
}

function parsePosterChange(value: unknown, upload: string | null): ThemeChange | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { kind, id } = value as { kind?: unknown; id?: unknown };
  if (kind === "upload") return upload === null ? undefined : { knob: "poster", value: { kind } };
  if ((kind !== "gallery" && kind !== "colour") || typeof id !== "string") return undefined;
  const curated = curatedPoster(id);
  return curated?.kind === kind ? { knob: "poster", value: curated } : undefined;
}
