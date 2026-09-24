import { findBackground } from "./backgrounds";
import { isSwatch } from "./swatches";
import { findTemplate, type TemplateId } from "./templates";
import {
  applyTemplate,
  BUTTON_STYLES,
  FONTS,
  RSVP_STYLES,
  TEXT_TONES,
  TITLE_PLACEMENTS,
  UPLOAD_MODES,
  type ButtonStyle,
  type FontKey,
  type RsvpStyle,
  type TextTone,
  type Theme,
  type TitlePlacement,
  type UploadMode,
} from "./theme";

// What the Design drawer asks for: a template, or one knob set to one value. The layout row has
// nothing to change while Poster is the only layout offered. The upload mode shows the host's
// own picture as the background or as the poster. A new upload is not the drawer's to set: the
// server applies `uploadId` once it has stored the picture (uploads/repository.ts).
export type KnobChange =
  | { knob: "backgroundId"; value: string }
  | { knob: "uploadId"; value: string }
  | { knob: "uploadMode"; value: UploadMode }
  | { knob: "titlePlacement"; value: TitlePlacement }
  | { knob: "font"; value: FontKey }
  | { knob: "accentOverride"; value: string | null }
  | { knob: "textTone"; value: TextTone }
  | { knob: "buttonStyle"; value: ButtonStyle }
  | { knob: "rsvpStyle"; value: RsvpStyle };

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
  // The host's picture in use, as the background or as the poster, puts the curated background
  // aside; the picture stays in the host's gallery whichever is shown, so they can go back and
  // forth. A new picture is shown at once, in the use the host chose for the one it replaces
  // (the background, until they choose the poster).
  if (change.knob === "uploadId" || change.knob === "uploadMode") {
    const uploadId = change.knob === "uploadId" ? change.value : theme.uploadId;
    const uploadMode = change.knob === "uploadMode" ? change.value : theme.uploadMode;
    if (uploadId === null) return theme;
    const inUse = theme.backgroundId === null && theme.uploadId === uploadId;
    if (inUse && theme.uploadMode === uploadMode) return theme;
    // A picture newly in use brings its own accent, as a new background does (below); the same
    // picture used the other way keeps the host's.
    return { ...theme, backgroundId: null, uploadId, uploadMode, accentOverride: inUse ? theme.accentOverride : null };
  }
  if (theme[change.knob] === change.value) return theme;

  const changed: Theme = { ...theme, [change.knob]: change.value };
  // A new background brings its own accent: an override picked against the old picture may not
  // suit the new one (PROTOTYPE.md, the drawer). The upload's does the same, above.
  if (change.knob === "backgroundId") changed.accentOverride = null;
  return changed;
}

function sameTheme(a: Theme, b: Theme): boolean {
  return (Object.keys(a) as (keyof Theme)[]).every((knob) =>
    knob === "template" ? a.template?.id === b.template?.id && a.template?.dirty === b.template?.dirty : a[knob] === b[knob],
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
// colour a page can wear is one legibility.ts has checked, and the host's picture can be used
// only on an event that has one (`upload`, its id, or null when it has none).
export function parseThemeChange(raw: unknown, upload: string | null = null): ThemeChange | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const { template, knob, value } = raw as { template?: unknown; knob?: unknown; value?: unknown };
  if (template !== undefined) return typeof template === "string" && findTemplate(template) ? { template } : undefined;

  switch (knob) {
    case "backgroundId":
      return typeof value === "string" && findBackground(value) ? { knob, value } : undefined;
    case "uploadMode":
      return upload !== null && oneOf(UPLOAD_MODES, value) ? { knob, value } : undefined;
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
    default:
      return undefined;
  }
}
