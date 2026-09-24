import type { FontKey } from "./theme";

// The self-hosted title fonts (see fonts.ts for the data), served as they are from public/fonts.
// Each face's @font-face is in globals.css ("Title fonts"), with font-display: swap, so the title
// is drawn at once in a fallback sized to match and changes face when it arrives. Its class puts
// its family into --theme-title-font for the title. A page needs one of the four: the event page
// preloads the one its theme uses (themed-page.tsx), so that it arrives beside the stylesheet
// rather than after it, and the browser never fetches the others.
export const TITLE_FONT_CLASSES: Record<FontKey, string> = {
  serif: "title-font-serif",
  grotesque: "title-font-grotesque",
  display: "title-font-display",
  rounded: "title-font-rounded",
};

// Where each face's file is, as its @font-face names it.
export const TITLE_FONT_FILES: Record<FontKey, string> = {
  serif: "/fonts/instrument-serif-400.woff2",
  grotesque: "/fonts/bricolage-grotesque-800.woff2",
  display: "/fonts/syne-800.woff2",
  rounded: "/fonts/fredoka-600.woff2",
};
