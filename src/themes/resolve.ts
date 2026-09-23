import { DEFAULT_BACKGROUND, findBackground, type Background } from "./backgrounds";
import { TITLE_FONTS, type TitleFont } from "./fonts";
import { css, GLOW, TONES, toneTokens, UNMEASURED, type ToneTokens } from "./legibility";
import type { ButtonStyle, RsvpStyle, Theme } from "./theme";

// What the server samples from a host's upload (ticket 12). Until then no event has one.
export type SampledUpload = { accent: string | null; luminance: number };

// A theme with every "auto" decided, ready to paint (spec, "Themes and templates"). Computed on
// the server for the first paint, and again in the host's browser while they change it.
export type ResolvedTheme = {
  layout: "poster"; // M1 ships the Poster layout; other stored layouts render as Poster
  background: Background; // uploads as backgrounds arrive with ticket 12
  accent: string;
  textTone: "light" | "dark";
  font: TitleFont;
  buttonStyle: ButtonStyle;
  rsvpStyle: RsvpStyle; // the Poster layout's, which is every layout in M1
  // Every colour the page paints text with and on, chosen together so that all of it reads.
  tokens: ToneTokens;
};

// The colours the preview card paints with, which it cannot take from the page's stylesheet.
export const TONE_BASE = { light: css(TONES.light.base), dark: css(TONES.dark.base) };
export const TONE_TEXT = { light: css(TONES.light.text), dark: css(TONES.dark.text) };

// Above this average luminance a background counts as light, so the text goes dark.
const LIGHT_BACKGROUND = 0.6;

export function resolveTheme(theme: Theme, upload: SampledUpload | null = null): ResolvedTheme {
  const background = findBackground(theme.backgroundId) ?? DEFAULT_BACKGROUND;
  // An upload is in use when the theme names no curated background (spec shape). A host may keep
  // an upload in their gallery while showing a curated background; then the background decides.
  const uploadInUse = theme.backgroundId === null && theme.uploadId !== null ? upload : null;
  const accent = theme.accentOverride ?? uploadInUse?.accent ?? background.accent;
  const luminance = uploadInUse ? uploadInUse.luminance : background.luminance;
  const textTone = theme.textTone === "auto" ? (luminance > LIGHT_BACKGROUND ? "dark" : "light") : theme.textTone;
  return {
    layout: "poster",
    background,
    accent,
    textTone,
    font: TITLE_FONTS[theme.font],
    buttonStyle: theme.buttonStyle,
    rsvpStyle: theme.rsvpStyle,
    tokens: toneTokens(textTone, uploadInUse ? UNMEASURED : background, accent),
  };
}

// The resolved theme as CSS custom properties for the page's root element (see globals.css,
// "Event page theme"), so the first paint carries the finished look.
export function themeVariables({ accent, tokens }: ResolvedTheme): Record<string, string> {
  return {
    "--theme-accent": accent,
    "--theme-on-accent": css(tokens.onAccent),
    "--theme-accent-ink": css(tokens.accentInk),
    "--theme-base": css(tokens.base),
    "--theme-text": css(tokens.text),
    "--theme-text-muted": css(tokens.textMuted),
    "--theme-text-faint": css(tokens.textFaint),
    "--theme-glass": css(tokens.glass),
    "--theme-glass-strong": css(tokens.glassStrong),
    "--theme-glass-border": css(tokens.glassBorder),
    "--theme-veil": css(tokens.veil),
    "--theme-scrim": css(tokens.scrim),
    "--theme-glow": css(GLOW),
  };
}

// The RSVP sheet is a surface of its own (legibility.ts, SHEET_SURFACES): it sets its tint, and
// the secondary text and accent ink that read on it, on itself, so the flow inside it takes them
// with the classes it wears on the inline card.
export function sheetVariables({ tokens: { sheet } }: ResolvedTheme): Record<string, string> {
  return {
    "--theme-sheet": css(sheet.tint),
    "--theme-text-muted": css(sheet.textMuted),
    "--theme-text-faint": css(sheet.textFaint),
    "--theme-accent-ink": css(sheet.accentInk),
  };
}
