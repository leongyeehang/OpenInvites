import { DEFAULT_BACKGROUND, findBackground, type Background } from "./backgrounds";
import { TITLE_FONTS, type TitleFont } from "./fonts";
import { css, GLOW, TONES, toneTokens, type ToneTokens } from "./legibility";
import { OFFERED_LAYOUTS, type ButtonStyle, type Layout, type RsvpStyle, type Theme, type TitlePlacement } from "./theme";

// The host's own picture, as the theme needs it: where the page gets it (and its cut for a phone
// held upright, and the small copy the Design drawer shows), what the server sampled from it
// (uploads/sample.ts: its average luminance, accent, and brightest and darkest points as the
// glass sees them), and what the host says it shows. `poster` is the same picture as the
// invitation itself: its poster rendition, the widths the browser may choose from, and its size,
// and its blurred copy behind it with that copy's extremes.
export type ThemeUpload = {
  id: string;
  src: string;
  portraitSrc: string;
  thumbnailSrc: string;
  accent: string;
  luminance: number;
  lightest: string;
  darkest: string;
  altText: string;
  poster: { src: string; srcSet: string | undefined; copySrc: string; width: number; height: number; lightest: string; darkest: string };
};

// The host's upload as the invitation itself (poster mode): the picture at its own proportions,
// what it shows, and where the title goes, on it or below it.
export type ResolvedPoster = {
  src: string;
  srcSet: string | undefined;
  width: number;
  height: number;
  altText: string;
  titlePlacement: TitlePlacement;
};

// A theme with every "auto" decided, ready to paint (spec, "Themes and templates"). Computed on
// the server for the first paint, and again in the host's browser while they change it.
export type ResolvedTheme = {
  layout: Layout; // the stored layout, or Poster while the stored one is not offered yet
  // What the page is painted on: a curated poster's background, or, behind the host's poster, its
  // blurred copy (measured as that copy).
  background: Background;
  upload: ThemeUpload | null; // the host's upload, when it is the poster
  poster: ResolvedPoster | null; // the upload as the poster
  accent: string;
  textTone: "light" | "dark";
  font: TitleFont;
  buttonStyle: ButtonStyle;
  rsvpStyle: RsvpStyle; // the Poster layout's; other layouts keep it and show nothing of it
  // Every colour the page paints text with and on, chosen together so that all of it reads.
  tokens: ToneTokens;
};

// The colours the preview card paints with, which it cannot take from the page's stylesheet.
export const TONE_BASE = { light: css(TONES.light.base), dark: css(TONES.dark.base) };
export const TONE_TEXT = { light: css(TONES.light.text), dark: css(TONES.dark.text) };

// Above this average luminance a background counts as light, so the text goes dark.
const LIGHT_BACKGROUND = 0.6;

export function resolveTheme(theme: Theme, upload: ThemeUpload | null = null): ResolvedTheme {
  // The event's picture shows when the poster is the upload and the event has one; otherwise the
  // poster is a curated one (M4 spec, "The poster replaces the background"). Until the
  // poster-first page (M4 ticket 03), a curated poster still paints as the page's background and
  // the picture as the poster card, with its blurred copy behind it. An upload poster on an event
  // that has lost its picture falls back as an unknown background does.
  const uploadInUse = theme.poster.kind === "upload" ? upload : null;
  const curated = theme.poster.kind === "upload" ? undefined : findBackground(theme.poster.id);
  const background = uploadInUse ? posterCopy(uploadInUse) : (curated ?? DEFAULT_BACKGROUND);
  const accent = theme.accentOverride ?? background.accent;
  const textTone = theme.textTone === "auto" ? (background.luminance > LIGHT_BACKGROUND ? "dark" : "light") : theme.textTone;
  return {
    layout: OFFERED_LAYOUTS.includes(theme.layout) ? theme.layout : "poster",
    background,
    upload: uploadInUse,
    poster: uploadInUse
      ? {
          src: uploadInUse.poster.src,
          srcSet: uploadInUse.poster.srcSet,
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
    // The blurred copy behind a poster wears the poster's stronger scrim, under which its extremes
    // were measured.
    tokens: toneTokens(textTone, background, accent, background.kind === "photo" && background.blurred ? "poster" : "background"),
  };
}

// Behind the host's poster, the page is painted with the poster's blurred copy, with the accent and
// luminance the server sampled from the picture and the extremes measured for that copy.
function posterCopy({ accent, luminance, poster }: ThemeUpload): Background {
  return { id: "upload", kind: "photo", src: poster.copySrc, accent, luminance, lightest: poster.lightest, darkest: poster.darkest, blurred: true };
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
    "--theme-focus-ring": css(tokens.focusRing),
  };
}

// The RSVP sheet is a surface of its own (legibility.ts, SHEET_SURFACES): it sets its tint, and
// the secondary text, accent ink and focus ring that read on it, on itself, so the flow inside it
// takes them with the classes it wears on the inline card.
export function sheetVariables({ tokens: { sheet } }: ResolvedTheme): Record<string, string> {
  return {
    "--theme-sheet": css(sheet.tint),
    "--theme-text-muted": css(sheet.textMuted),
    "--theme-text-faint": css(sheet.textFaint),
    "--theme-accent-ink": css(sheet.accentInk),
    "--theme-focus-ring": css(sheet.focusRing),
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
