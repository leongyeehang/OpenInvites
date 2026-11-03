import type en from "../../messages/en.json";
import { POSTER_FILES, type PosterFiles } from "./poster-files";
import type { ButtonStyle, Effect, FontKey, TitlePlacement } from "./theme";

// The gallery posters (M4 spec, "The poster replaces the background"): ready-made pictures, drawn
// as code in scripts/posters/art.ts, each sorted under an occasion and carrying the look that suits
// it. Picking one applies its look (theme.ts, applyPosterLook), as applying a template did in 0.4;
// the six templates of 0.4 became six of these (LEGACY_TEMPLATES in theme.ts).
// docs/contributing/posters.md says how to add one.
//
// What is measured from each, and where its files are, is in poster-files.ts, which
// `pnpm posters` writes: the poster is painted as a host's upload is, at the top of the page with
// its blurred copy behind, so it is measured as an upload is (uploads/process.ts).

// The occasions, in the order the gallery shows them. What each is called is a message
// (Posters.occasions, in every file in messages/).
export const OCCASIONS = ["birthday", "dinner", "wedding", "kids", "nightOut", "outdoors", "holiday", "anyOccasion"] as const;
export type Occasion = (typeof OCCASIONS)[number];

// What picking a poster sets besides the poster: the title's face and where it goes, the effect,
// and the RSVP buttons' style. Its accent is the poster's own (`accent`), so picking it puts the
// accent back on Auto. The layout and text tone stay the host's.
export type PosterLook = { font: FontKey; titlePlacement: TitlePlacement; effect: Effect; buttonStyle: ButtonStyle };

// Stored on every theme that shows the poster, so never rename one that has shipped. What the
// gallery calls it is a message (Posters.names), so the id must be one English names.
export type GalleryPosterId = keyof typeof en.Posters.names;

export type GalleryPoster = {
  id: GalleryPosterId;
  occasion: Occasion;
  accent: string; // #rrggbb: the buttons and highlights while the host leaves the accent on Auto
  look: PosterLook;
} & PosterFiles;

type Entry = Omit<GalleryPoster, keyof PosterFiles>;

const ENTRIES: Entry[] = [
  { id: "candles", occasion: "birthday", accent: "#ffc36b", look: { font: "serif", titlePlacement: "below", effect: "sparkles", buttonStyle: "glass" } },
  { id: "balloons", occasion: "birthday", accent: "#ffd166", look: { font: "rounded", titlePlacement: "below", effect: "confetti", buttonStyle: "solid" } },
  { id: "cake", occasion: "birthday", accent: "#ff7aa2", look: { font: "rounded", titlePlacement: "below", effect: "confetti", buttonStyle: "solid" } },
  { id: "candlelight", occasion: "dinner", accent: "#ffb26b", look: { font: "serif", titlePlacement: "on", effect: "sparkles", buttonStyle: "glass" } },
  { id: "picnic", occasion: "dinner", accent: "#e5534b", look: { font: "serif", titlePlacement: "below", effect: "none", buttonStyle: "solid" } },
  { id: "botanical", occasion: "wedding", accent: "#7d9a6f", look: { font: "serif", titlePlacement: "below", effect: "none", buttonStyle: "outline" } },
  { id: "rings", occasion: "wedding", accent: "#d9a441", look: { font: "serif", titlePlacement: "below", effect: "sparkles", buttonStyle: "glass" } },
  { id: "rose", occasion: "wedding", accent: "#ff9ec7", look: { font: "serif", titlePlacement: "below", effect: "sparkles", buttonStyle: "outline" } },
  { id: "playtime", occasion: "kids", accent: "#ff6b6b", look: { font: "rounded", titlePlacement: "below", effect: "confetti", buttonStyle: "solid" } },
  { id: "rainbow", occasion: "kids", accent: "#8fa8ff", look: { font: "rounded", titlePlacement: "below", effect: "doodles", buttonStyle: "solid" } },
  { id: "disco", occasion: "nightOut", accent: "#d6a7ff", look: { font: "display", titlePlacement: "on", effect: "sparkles", buttonStyle: "glass" } },
  { id: "sunset-drive", occasion: "nightOut", accent: "#ff8fc0", look: { font: "display", titlePlacement: "on", effect: "none", buttonStyle: "solid" } },
  { id: "cocktails", occasion: "nightOut", accent: "#ffb3c8", look: { font: "serif", titlePlacement: "below", effect: "sparkles", buttonStyle: "glass" } },
  { id: "sunshine", occasion: "outdoors", accent: "#ff9f1c", look: { font: "grotesque", titlePlacement: "below", effect: "doodles", buttonStyle: "solid" } },
  { id: "seaside", occasion: "outdoors", accent: "#7fd8e8", look: { font: "grotesque", titlePlacement: "on", effect: "none", buttonStyle: "glass" } },
  { id: "sunset-sea", occasion: "outdoors", accent: "#ffcf6b", look: { font: "serif", titlePlacement: "below", effect: "none", buttonStyle: "glass" } },
  { id: "string-lights", occasion: "holiday", accent: "#ffe08a", look: { font: "serif", titlePlacement: "below", effect: "sparkles", buttonStyle: "glass" } },
  { id: "aurora", occasion: "holiday", accent: "#7ef0c8", look: { font: "grotesque", titlePlacement: "below", effect: "doodles", buttonStyle: "glass" } },
  { id: "bokeh", occasion: "anyOccasion", accent: "#ffb26b", look: { font: "serif", titlePlacement: "on", effect: "sparkles", buttonStyle: "glass" } },
  { id: "streamers", occasion: "anyOccasion", accent: "#ffd166", look: { font: "rounded", titlePlacement: "below", effect: "confetti", buttonStyle: "solid" } },
];

// Every poster with its files and measurements. One `pnpm posters` has not built yet has none,
// which posters.test.ts reports.
export const GALLERY_POSTERS: readonly GalleryPoster[] = ENTRIES.map((entry) => ({ ...entry, ...POSTER_FILES[entry.id] }));

export function findGalleryPoster(id: string): GalleryPoster | undefined {
  return GALLERY_POSTERS.find((poster) => poster.id === id);
}

// The posters are drawn at 4:5, 1200 by 1500 (scripts/posters/svg.ts).
export const GALLERY_POSTER_SIZE = { width: 1200, height: 1500 };
