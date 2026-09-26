// The sizes a host's picture is kept in (spec, "Uploads and images"). The file they sent is
// never kept: only these, re-encoded from it.
export const RENDITIONS = {
  // The full-page background, large enough for a wide screen, in a format every browser shows.
  background: { file: "background.webp", type: "image/webp" },
  // The same background cut to what a phone held upright shows of it (portraitCut): the page's
  // backdrop on a portrait screen (themes/themed-page.tsx).
  backgroundPortrait: { file: "background-portrait.webp", type: "image/webp" },
  // The picture as the invitation itself (poster mode), at its own proportions, sized for the
  // poster card (POSTER_BOX).
  poster: { file: "poster.webp", type: "image/webp" },
  // The poster at the width a phone of middling density and a desktop screen need (SMALL_POSTER_BOX),
  // which the page offers beside it (posterSrcSet).
  posterSmall: { file: "poster-720.webp", type: "image/webp" },
  // The poster reduced to a wash of its colours (POSTER_COPY_BOX), for the blurred copy that fills
  // the page behind it: under that blur a larger picture would add nothing.
  posterCopy: { file: "poster-copy.webp", type: "image/webp" },
  // The link's preview card, at the card's own size (sharing/preview-card.tsx), as a JPEG,
  // which Satori and sharp, which draw the card, both read.
  card: { file: "card.jpg", type: "image/jpeg" },
} as const;

export type RenditionName = keyof typeof RENDITIONS;

export const RENDITION_NAMES = Object.keys(RENDITIONS) as RenditionName[];

type Size = { width: number; height: number };

// The poster card is at most 34rem wide (the page's 36rem less its margins): 1088 pixels on a
// desktop's 2x screen, and a phone's is narrower at 3x. A picture more than twice as tall as it
// is wide stops at the height, a little softer.
export const POSTER_BOX: Size = { width: 1200, height: 2400 };
// The same box at 720: the card on a desktop at 1x (544 pixels at most) and on a phone at about
// 2x (a 390-pixel phone's card is 358 wide, 716 at 2x; Lighthouse's phone, 380 at 1.75x, is 665).
export const SMALL_POSTER_BOX: Size = { width: 720, height: 1440 };
// The copy is blurred by 64 CSS pixels (themed-page.tsx), which leaves nothing finer than about
// 30: over the largest screen and its margins, 2176 pixels across, 192 pixels of picture are
// already finer than that.
export const POSTER_COPY_BOX: Size = { width: 192, height: 192 };

// The size a picture is drawn at to fit inside a box, never enlarged.
export function fitInside(size: Size, box: Size): Size {
  const scale = Math.min(1, box.width / size.width, box.height / size.height);
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}

// A portrait screen is at most 2:3 wide to tall: every phone held upright, with or without the
// browser's bars (about 9:21 to 3:5). The page chooses the cut below for screens up to it
// (themes/themed-page.tsx, max-aspect-ratio: 2/3).
const PORTRAIT = 2 / 3;

// What a portrait screen shows of a picture that covers it from the centre, as the page's
// backdrop does: scaled to the screen's height, a band down the middle as wide as the screen,
// which is never wider than 2:3 of the picture's height. So the cut is that band at 2:3, and a
// picture already as narrow as that is shown whole.
export function portraitCut({ width, height }: Size): Size & { left: number; top: number } {
  const cut = Math.round(height * PORTRAIT);
  if (cut >= width) return { left: 0, top: 0, width, height };
  return { left: Math.floor((width - cut) / 2), top: 0, width: cut, height };
}

// The poster's sources for the <img>, by width, for the browser to choose from: the small one
// where it is smaller than the poster, else only the poster. `poster` is the poster rendition's
// size; the small one fits the same picture into a box of the same proportions, so it is the
// poster fitted into it.
export function posterSrcSet(uploadId: string, poster: Size): string | undefined {
  const small = fitInside(poster, SMALL_POSTER_BOX);
  if (small.width >= poster.width) return undefined;
  return `${renditionUrl(uploadId, "posterSmall")} ${small.width}w, ${renditionUrl(uploadId, "poster")} ${poster.width}w`;
}

// Where a rendition is kept: one flat name per file, so the local directory holds nothing else.
export function renditionKey(uploadId: string, name: RenditionName): string {
  return `${uploadId}-${RENDITIONS[name].file}`;
}

// Where the page asks for it. Every upload has a new id, so what is behind a URL never changes.
export function renditionUrl(uploadId: string, name: RenditionName): string {
  return `/uploads/${uploadId}/${RENDITIONS[name].file}`;
}

export function renditionNamed(file: string): RenditionName | undefined {
  return RENDITION_NAMES.find((name) => RENDITIONS[name].file === file);
}
