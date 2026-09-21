import type { FontKey } from "./theme";

// The four title fonts (PROTOTYPE.md: one serif, one grotesque, one display, one rounded), all
// self-hosted from ./fonts under the SIL Open Font License, Latin subset. Adding a face means:
// its key in theme.ts FONTS, its woff2 and OFL.txt in ./fonts, a localFont call in title-fonts.ts
// (the font loader needs each call spelled out), and its entry here.
export type TitleFont = {
  key: FontKey;
  name: string;
  // Weight and tracking that suit the face at display sizes.
  className: string;
  // Title size classes (globals.css, --text-poster-*): the everyday one and the one for long titles.
  sizes: { short: string; long: string };
};

const SERIF_SIZES = { short: "text-poster-serif", long: "text-poster-serif-long" };
const SANS_SIZES = { short: "text-poster-sans", long: "text-poster-sans-long" };

export const TITLE_FONTS: Record<FontKey, TitleFont> = {
  serif: { key: "serif", name: "Instrument Serif", className: "font-normal tracking-[-0.01em]", sizes: SERIF_SIZES },
  grotesque: { key: "grotesque", name: "Bricolage Grotesque", className: "font-extrabold tracking-[-0.035em]", sizes: SANS_SIZES },
  display: { key: "display", name: "Syne", className: "font-extrabold tracking-[-0.02em]", sizes: SANS_SIZES },
  rounded: { key: "rounded", name: "Fredoka", className: "font-semibold tracking-[-0.01em]", sizes: SANS_SIZES },
};
