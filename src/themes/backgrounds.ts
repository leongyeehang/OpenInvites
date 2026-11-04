import type en from "../../messages/en.json";

// The gallery's colours (M4 spec, "Colour posters"): the curated gradients a host may have as the
// poster, painted as the page's background. Data, not code: add an entry here, and its name to
// every file in messages/ (Design.colourNames), to offer a new one. The gallery's pictures
// are in posters.ts; the four scenes 0.4 had here are among them now. Each colour carries a
// pre-chosen accent that reads on it and its average luminance (0 dark to 1 light) for the
// automatic text tone. Luminance is measured as the mean of (0.2126 R + 0.7152 G + 0.0722 B) /
// 255 over the rendered background alone (no blobs, scrim, fade or grain) on a 390x844 phone,
// rounded to two places.
//
// `lightest` and `darkest` are what legibility.ts reads to keep every text tone readable: the
// brightest point light text can meet on the page, and the darkest point dark text can meet. Each
// is measured on the event page's own backdrop (themed-page.tsx: the blobs, the scrim over
// scenes, the fade at the foot) with the page's content hidden, under a 24px backdrop blur (the
// glass's own), at 360x740, 390x844, 768x1024, 1280x800 and 1920x1080, with the blobs at rest
// and at the far end of their drift: the lightest pixel in the light tone with a white accent
// (the brightest blob there can be), the darkest in the dark tone with each accent a host may
// pick. `pnpm measure:backgrounds` measures all three (docs/contributing/backgrounds.md).
// Re-measure when the backdrop changes.

// What the page is painted on: a gradient, or the small copy of a picture poster (a gallery
// poster, or the host's upload) blurred to a wash of its own colours behind it (themed-page.tsx).
export type Background = {
  id: string;
  accent: string; // #rrggbb
  luminance: number; // 0..1
  lightest: string; // #rrggbb
  darkest: string; // #rrggbb
} & ({ kind: "gradient"; css: string } | { kind: "photo"; src: string });

// A colour of the gallery. What the Poster sheet calls it is a message
// (Design.colourNames, in every file in messages/), so its id has to be one they name.
export type CuratedBackground = Background & { kind: "gradient"; id: keyof typeof en.Design.colourNames };

export const BACKGROUNDS: readonly CuratedBackground[] = [
  {
    id: "golden",
    kind: "gradient",
    css: "radial-gradient(120% 85% at 50% -5%, #ffc36b 0%, #ff7a59 32%, #a8407a 58%, #3a1b5c 82%, #1b0f2b 100%)",
    accent: "#ffc36b",
    luminance: 0.3,
    lightest: "#ffab5f",
    darkest: "#3c1c55",
  },
  {
    id: "dusk",
    kind: "gradient",
    css: "linear-gradient(160deg, #0f1c4d 0%, #4a2b8c 45%, #d9488a 100%)",
    accent: "#ff8fc0",
    luminance: 0.25,
    lightest: "#795ba1",
    darkest: "#101b49",
  },
  {
    id: "forest",
    kind: "gradient",
    css: "linear-gradient(170deg, #06251f 0%, #0f5a4a 55%, #3aa885 100%)",
    accent: "#8fe6c2",
    luminance: 0.29,
    lightest: "#45796d",
    darkest: "#06241e",
  },
  {
    id: "midnight",
    kind: "gradient",
    css: "radial-gradient(90% 70% at 50% 100%, #3b3f9a 0%, #1a1c4a 45%, #07081a 100%)",
    accent: "#a5b4fc",
    luminance: 0.08,
    lightest: "#484962",
    darkest: "#070818",
  },
  {
    id: "peach",
    kind: "gradient",
    css: "radial-gradient(80% 60% at 20% 15%, #ffe0c4 0%, rgb(255 224 196 / 0) 60%), radial-gradient(70% 60% at 85% 75%, #ff8fa3 0%, rgb(255 143 163 / 0) 62%), linear-gradient(160deg, #ffb38a, #e85d75)",
    accent: "#ffe3b8",
    luminance: 0.66,
    lightest: "#ffdabc",
    darkest: "#f07176",
  },
  {
    id: "lagoon",
    kind: "gradient",
    css: "radial-gradient(70% 50% at 30% 22%, #a6f5e4 0%, rgb(166 245 228 / 0) 60%), radial-gradient(80% 60% at 75% 80%, #2a6fdb 0%, rgb(42 111 219 / 0) 65%), linear-gradient(170deg, #38c3b5, #173f8a)",
    accent: "#b8fff0",
    luminance: 0.5,
    lightest: "#97eede",
    darkest: "#47609b",
  },
  {
    id: "lilac",
    kind: "gradient",
    css: "radial-gradient(70% 55% at 75% 18%, #f6dcff 0%, rgb(246 220 255 / 0) 60%), radial-gradient(80% 60% at 20% 82%, #8b6cf0 0%, rgb(139 108 240 / 0) 65%), linear-gradient(165deg, #c9a7ff, #5a3fb5)",
    accent: "#ffe1f4",
    luminance: 0.55,
    lightest: "#efd3fc",
    darkest: "#7658c6",
  },
  {
    id: "slate",
    kind: "gradient",
    css: "linear-gradient(180deg, #23262e 0%, #0e1015 100%)",
    accent: "#d9d9e3",
    luminance: 0.1,
    lightest: "#4d4f54",
    darkest: "#16181e",
  },
  {
    id: "ink",
    kind: "gradient",
    css: "linear-gradient(180deg, #17151c 0%, #2c2833 100%)",
    accent: "#ffffff",
    luminance: 0.12,
    lightest: "#535157",
    darkest: "#16141b",
  },
];

// The background a theme falls back to when its own is missing or unknown.
export const DEFAULT_BACKGROUND: CuratedBackground = BACKGROUNDS[0];

export function findBackground(id: string | null): CuratedBackground | undefined {
  return id === null ? undefined : BACKGROUNDS.find((background) => background.id === id);
}
