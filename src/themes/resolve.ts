import { DEFAULT_BACKGROUND, findBackground, type Background } from "./backgrounds";
import { TITLE_FONTS, type TitleFont } from "./fonts";
import { css, GLOW, TONES, toneTokens, type ToneTokens } from "./legibility";
import type { ButtonStyle, RsvpStyle, Theme, TitlePlacement } from "./theme";

// The host's own picture, as the theme needs it: where the page gets it, what the server sampled
// from it (uploads/sample.ts: its average luminance, accent, and brightest and darkest points as
// the glass sees them), and what the host says it shows. `poster` is the same picture as the
// invitation itself: its poster rendition and size, and the extremes of its blurred copy behind it.
export type ThemeUpload = {
  id: string;
  src: string;
  accent: string;
  luminance: number;
  lightest: string;
  darkest: string;
  altText: string;
  poster: { src: string; width: number; height: number; lightest: string; darkest: string };
};

// The host's upload as the invitation itself (poster mode): the picture at its own proportions,
// what it shows, and where the title goes, on it or below it.
export type ResolvedPoster = { src: string; width: number; height: number; altText: string; titlePlacement: TitlePlacement };

// A theme with every "auto" decided, ready to paint (spec, "Themes and templates"). Computed on
// the server for the first paint, and again in the host's browser while they change it.
export type ResolvedTheme = {
  layout: "poster"; // M1 ships the Poster layout; other stored layouts render as Poster
  // What the page is painted on: a curated background, the host's upload as a photo, or, in
  // poster mode, the blurred copy of the poster (measured as that copy).
  background: Background;
  upload: ThemeUpload | null; // the host's upload, when it is in use, as the background or the poster
  poster: ResolvedPoster | null; // the upload as the poster, in poster mode
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

export function resolveTheme(theme: Theme, upload: ThemeUpload | null = null): ResolvedTheme {
  // An upload is in use when the theme names no curated background (spec shape) but names this
  // upload. A host may keep an upload in their gallery while showing a curated background; then
  // the background decides.
  const uploadInUse = theme.backgroundId === null && upload !== null && theme.uploadId === upload.id ? upload : null;
  const asPoster = uploadInUse !== null && theme.uploadMode === "poster";
  const background = uploadInUse ? uploadedBackground(uploadInUse, asPoster) : (findBackground(theme.backgroundId) ?? DEFAULT_BACKGROUND);
  const accent = theme.accentOverride ?? background.accent;
  const textTone = theme.textTone === "auto" ? (background.luminance > LIGHT_BACKGROUND ? "dark" : "light") : theme.textTone;
  return {
    layout: "poster",
    background,
    upload: uploadInUse,
    poster: asPoster
      ? {
          src: uploadInUse.poster.src,
          width: uploadInUse.poster.width,
          height: uploadInUse.poster.height,
          altText: uploadInUse.altText,
          titlePlacement: theme.titlePlacement,
        }
      : null,
    accent,
    textTone,
    font: TITLE_FONTS[theme.font],
    buttonStyle: theme.buttonStyle,
    rsvpStyle: theme.rsvpStyle,
    tokens: toneTokens(textTone, background, accent, asPoster ? "poster" : "background"),
  };
}

// The upload as the page paints it: a photograph, as the curated scenes are, with the accent,
// luminance and extremes the server sampled standing in for the ones measured for them. Behind
// a poster it is the poster's blurred copy, with the extremes measured for that.
function uploadedBackground({ src, accent, luminance, lightest, darkest, poster }: ThemeUpload, asPoster: boolean): Background {
  return asPoster
    ? { id: "upload", kind: "photo", src: poster.src, accent, luminance, lightest: poster.lightest, darkest: poster.darkest }
    : { id: "upload", kind: "photo", src, accent, luminance, lightest, darkest };
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

// The title on the poster sits on a scrim of its own (legibility.ts, POSTER_SURFACES), and sets
// it and the secondary text that reads on it on itself, as the sheet does.
export function posterTitleVariables({ tokens: { titleOnPoster } }: ResolvedTheme): Record<string, string> {
  return {
    "--theme-title-scrim": css(titleOnPoster.scrim),
    "--theme-text-muted": css(titleOnPoster.textMuted),
    "--theme-text-faint": css(titleOnPoster.textFaint),
  };
}
