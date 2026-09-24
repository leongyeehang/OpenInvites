import type { FontKey } from "./theme";

// The four title fonts (PROTOTYPE.md: one serif, one grotesque, one display, one rounded), all
// self-hosted from public/fonts under the SIL Open Font License, Latin subset. Adding a face
// means: its key in theme.ts FONTS, its woff2 (named after its content: public-files.test.ts)
// and OFL.txt in public/fonts, its @font-face, its fallback and its class in globals.css ("Title
// fonts"), its class and file in title-fonts.ts, its entry here, and its name in every file in
// messages/ (DesignDrawer.fontNames).
export type TitleFont = {
  key: FontKey;
  // Weight and tracking that suit the face at display sizes.
  className: string;
  // Title size classes (globals.css, --text-poster-*): the everyday one, the one for long titles,
  // and the one beside the host's poster, which follows the poster's width.
  sizes: { short: string; long: string; compact: string };
};

const SERIF_SIZES = { short: "text-poster-serif", long: "text-poster-serif-long", compact: "text-poster-serif-compact" };
const SANS_SIZES = { short: "text-poster-sans", long: "text-poster-sans-long", compact: "text-poster-sans-compact" };

export const TITLE_FONTS: Record<FontKey, TitleFont> = {
  serif: { key: "serif", className: "font-normal tracking-[-0.01em]", sizes: SERIF_SIZES },
  grotesque: { key: "grotesque", className: "font-extrabold tracking-[-0.035em]", sizes: SANS_SIZES },
  display: { key: "display", className: "font-extrabold tracking-[-0.02em]", sizes: SANS_SIZES },
  rounded: { key: "rounded", className: "font-semibold tracking-[-0.01em]", sizes: SANS_SIZES },
};
