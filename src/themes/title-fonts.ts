import localFont from "next/font/local";
import type { FontKey } from "./theme";

// The self-hosted title fonts (see fonts.ts for the data). Each declares the same CSS variable,
// so applying one font's `variable` class to the page root sets --theme-title-font for the title.
// Nothing is preloaded: a page needs one of the four, and the browser fetches only that one.
// The font loader reads these calls at build time, so every option is spelled out literally, and
// it names each family after its constant, so the names say which face they are.
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--theme-title-font",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
});
const bricolageGrotesque = localFont({
  src: "./fonts/bricolage-grotesque-800.woff2",
  weight: "800",
  variable: "--theme-title-font",
  display: "swap",
  preload: false,
});
const syne = localFont({
  src: "./fonts/syne-800.woff2",
  weight: "800",
  variable: "--theme-title-font",
  display: "swap",
  preload: false,
});
const fredoka = localFont({
  src: "./fonts/fredoka-600.woff2",
  weight: "600",
  variable: "--theme-title-font",
  display: "swap",
  preload: false,
});

// The class that puts each font's family into --theme-title-font.
export const TITLE_FONT_CLASSES: Record<FontKey, string> = {
  serif: instrumentSerif.variable,
  grotesque: bricolageGrotesque.variable,
  display: syne.variable,
  rounded: fredoka.variable,
};
