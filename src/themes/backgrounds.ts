// The curated background gallery (spec, "Themes and templates"). Data, not code: add an entry
// here to offer a new background. Each carries a pre-chosen accent that reads on it and its
// average luminance (0 dark to 1 light) for the automatic text tone. Luminance is measured as
// the mean of (0.2126 R + 0.7152 G + 0.0722 B) / 255 over the rendered background; the four
// scenes are self-hosted SVG files in public/backgrounds.
//
// `lightest` and `darkest` are what legibility.ts reads to keep every text tone readable: the
// brightest point light text can meet on the page, and the darkest point dark text can meet. Each
// is measured on the event page's own backdrop (themed-page.tsx: the blobs, the scrim over
// scenes, the fade at the foot) with the page's content hidden, under a 24px backdrop blur (the
// glass's own), at 360x740, 390x844, 768x1024, 1280x800 and 1920x1080, with the blobs at rest
// and at the far end of their drift: the lightest pixel in the light tone with a white accent
// (the brightest blob there can be), the darkest in the dark tone. Re-measure when the backdrop
// changes.

export type Background = {
  id: string;
  name: string;
  accent: string; // #rrggbb
  luminance: number; // 0..1
  lightest: string; // #rrggbb
  darkest: string; // #rrggbb
} & ({ kind: "gradient"; css: string } | { kind: "photo"; src: string });

export const BACKGROUNDS: readonly Background[] = [
  {
    id: "golden",
    name: "Golden hour",
    kind: "gradient",
    css: "radial-gradient(120% 85% at 50% -5%, #ffc36b 0%, #ff7a59 32%, #a8407a 58%, #3a1b5c 82%, #1b0f2b 100%)",
    accent: "#ffc36b",
    luminance: 0.3,
    lightest: "#ffab5f",
    darkest: "#3c1c55",
  },
  {
    id: "dusk",
    name: "Dusk",
    kind: "gradient",
    css: "linear-gradient(160deg, #0f1c4d 0%, #4a2b8c 45%, #d9488a 100%)",
    accent: "#ff8fc0",
    luminance: 0.25,
    lightest: "#795ba1",
    darkest: "#101b49",
  },
  {
    id: "forest",
    name: "Forest",
    kind: "gradient",
    css: "linear-gradient(170deg, #06251f 0%, #0f5a4a 55%, #3aa885 100%)",
    accent: "#8fe6c2",
    luminance: 0.29,
    lightest: "#45796d",
    darkest: "#06241e",
  },
  {
    id: "midnight",
    name: "Midnight",
    kind: "gradient",
    css: "radial-gradient(90% 70% at 50% 100%, #3b3f9a 0%, #1a1c4a 45%, #07081a 100%)",
    accent: "#a5b4fc",
    luminance: 0.08,
    lightest: "#484962",
    darkest: "#070818",
  },
  { id: "sunset-sea", name: "Sunset sea", kind: "photo", src: "/backgrounds/sunset-sea.svg", accent: "#ffcf6b", luminance: 0.45, lightest: "#b7a26d", darkest: "#5e4f6f" },
  { id: "bokeh", name: "Bokeh", kind: "photo", src: "/backgrounds/bokeh.svg", accent: "#ffb26b", luminance: 0.11, lightest: "#9b7c42", darkest: "#474151" },
  { id: "aurora", name: "Aurora", kind: "photo", src: "/backgrounds/aurora.svg", accent: "#7ef0c8", luminance: 0.14, lightest: "#19635a", darkest: "#3d404d" },
  { id: "rose", name: "Rose garden", kind: "photo", src: "/backgrounds/rose-garden.svg", accent: "#ff9ec7", luminance: 0.23, lightest: "#773758", darkest: "#564252" },
  {
    id: "slate",
    name: "Slate",
    kind: "gradient",
    css: "linear-gradient(180deg, #23262e 0%, #0e1015 100%)",
    accent: "#d9d9e3",
    luminance: 0.1,
    lightest: "#4d4f54",
    darkest: "#16181e",
  },
];

// The background a theme falls back to when its own is missing or unknown.
export const DEFAULT_BACKGROUND: Background = BACKGROUNDS[0];

export function findBackground(id: string | null): Background | undefined {
  return id === null ? undefined : BACKGROUNDS.find((background) => background.id === id);
}
