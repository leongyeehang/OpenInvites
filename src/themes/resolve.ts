import { DEFAULT_BACKGROUND, findBackground, type Background } from "./backgrounds";
import { TITLE_FONTS, type TitleFont } from "./fonts";
import type { ButtonStyle, Theme } from "./theme";

// What the server samples from a host's upload (ticket 12). Until then no event has one.
export type SampledUpload = { accent: string | null; luminance: number };

// A theme with every "auto" decided, ready to paint (spec, "Themes and templates"). Computed on
// the server so the first paint carries the finished look.
export type ResolvedTheme = {
  layout: "poster"; // M1 ships the Poster layout; other stored layouts render as Poster
  background: Background; // uploads as backgrounds arrive with ticket 12
  accent: string;
  onAccent: string; // text that reads on the accent
  textTone: "light" | "dark";
  font: TitleFont;
  buttonStyle: ButtonStyle;
};

// Above this average luminance a background counts as light, so the text goes dark.
const LIGHT_BACKGROUND = 0.6;

// Text on the accent: dark plum on light accents, white on dark ones (from the prototype).
const ON_LIGHT_ACCENT = "#2a1540";
const ON_DARK_ACCENT = "#ffffff";

export function resolveTheme(theme: Theme, upload: SampledUpload | null = null): ResolvedTheme {
  const background = findBackground(theme.backgroundId) ?? DEFAULT_BACKGROUND;
  // An upload is in use when the theme names no curated background (spec shape). A host may keep
  // an upload in their gallery while showing a curated background; then the background decides.
  const uploadInUse = theme.backgroundId === null && theme.uploadId !== null ? upload : null;
  const accent = theme.accentOverride ?? uploadInUse?.accent ?? background.accent;
  const luminance = uploadInUse ? uploadInUse.luminance : background.luminance;
  return {
    layout: "poster",
    background,
    accent,
    onAccent: readsOn(accent),
    textTone: theme.textTone === "auto" ? (luminance > LIGHT_BACKGROUND ? "dark" : "light") : theme.textTone,
    font: TITLE_FONTS[theme.font],
    buttonStyle: theme.buttonStyle,
  };
}

// The resolved colours as CSS custom properties for the page's root element. The tone's own
// tokens (text, glass, scrim) live in globals.css under [data-tone].
export function themeVariables(resolved: ResolvedTheme): Record<string, string> {
  return { "--theme-accent": resolved.accent, "--theme-on-accent": resolved.onAccent };
}

function readsOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5 ? ON_LIGHT_ACCENT : ON_DARK_ACCENT;
}
