import sharp, { type Sharp } from "sharp";
import type { RenditionName } from "./renditions";
import { measureBackdrop, sampleColours, type Raster } from "./sample";
import { imageTypeOf, MAX_PIXELS, pixelProblem } from "./validate";

// A host's picture, made ready for the page (spec, "Uploads and images"): decoded, stood upright
// by its EXIF orientation, re-encoded into the sizes the page needs, and sampled for the theme.
// Nothing the file carried besides its pixels survives: re-encoding writes no EXIF, XMP, IPTC or
// colour profile, so a photo's location never reaches a guest.

// What the upload record keeps of the picture: what was sampled from it for the theme, as the
// background and as the blurred copy behind a poster, and the poster's size in pixels.
export type Sample = {
  luminance: number;
  accent: string;
  lightest: string;
  darkest: string;
  posterLightest: string;
  posterDarkest: string;
  posterWidth: number;
  posterHeight: number;
};
export type ProcessedPicture = { renditions: Record<RenditionName, Uint8Array>; sample: Sample };
export type ProcessResult = { ok: true; picture: ProcessedPicture } | { ok: false; problem: "unsupported" | "tooManyPixels" };

// The largest the background is kept at, on its longer side.
const BACKGROUND_SIZE = 2048;
const CARD_SIZE = { width: 1200, height: 630 };
// The poster card is at most 34rem wide (the page's 36rem less its margins): 1088 pixels on a
// desktop's 2x screen, and a phone's is narrower at 3x. A picture more than twice as tall as it
// is wide stops at the height, a little softer.
const POSTER_SIZE = { width: 1200, height: 2400 };

// The glass's blur (backdrop-blur-xl in glass.tsx) in CSS pixels, and the largest screen the
// curated backgrounds are measured on (backgrounds.ts). A background covers the screen, so this
// is where the picture is drawn largest and the blur covers least of it; on every smaller screen
// the same blur softens it more, so its extremes there are no worse.
const GLASS_BLUR = 24;
const LARGEST_SCREEN = { width: 1920, height: 1080 };
// Measured at a quarter of that size, where the blur is 6 pixels: the same light and dark, from
// a sixteenth of the pixels.
const MEASURE_AT = 1 / 4;
// The blurred copy behind a poster (themed-page.tsx): blurred by 64 CSS pixels over a box 8rem
// larger than the screen on every side, so its soft edges fall outside it. Text set straight on
// the page meets it under this blur alone, and the glass blurs it further.
const POSTER_COPY_BLUR = 64;
const POSTER_COPY_BLEED = 128;

// Colours are counted on a thumbnail: enough pixels to find a dominant colour, few to count.
const COLOURS_SIZE = 64;

const unsupported = { ok: false, problem: "unsupported" } as const;

export async function processUpload(bytes: Uint8Array): Promise<ProcessResult> {
  // Only the formats the server takes reach the decoder at all.
  if (!imageTypeOf(bytes)) return unsupported;
  let size: { width: number; height: number };
  try {
    // The header alone, which is where a picture says how big it is; nothing is decoded, so no
    // limit is needed to read it, and the rule below says what is too big.
    ({ autoOrient: size } = await sharp(bytes, { limitInputPixels: false }).metadata());
  } catch {
    return unsupported;
  }
  const problem = pixelProblem(size);
  if (problem) return { ok: false, problem };

  // Upright, opaque (a transparent picture is painted onto white, the page it was most likely
  // made on) and in sRGB with three channels, whatever it was stored as. The pixel limit is
  // checked again by the decoder itself.
  const decode = () => sharp(bytes, { limitInputPixels: MAX_PIXELS }).autoOrient().flatten({ background: "#ffffff" }).toColourspace("srgb");
  const raster = async (image: Sharp): Promise<Raster> => {
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, channels: info.channels };
  };
  // The picture scaled as it covers a box on the largest screen, then blurred as the page blurs
  // it, at the size it is measured at.
  const blurred = (box: { width: number; height: number }, blur: number) => {
    const scale = Math.max(box.width / size.width, box.height / size.height) * MEASURE_AT;
    return raster(
      decode()
        .resize(Math.max(1, Math.round(size.width * scale)), Math.max(1, Math.round(size.height * scale)), { fit: "fill" })
        .blur(blur * MEASURE_AT),
    );
  };
  const copyBox = { width: LARGEST_SCREEN.width + 2 * POSTER_COPY_BLEED, height: LARGEST_SCREEN.height + 2 * POSTER_COPY_BLEED };

  try {
    const [background, card, poster, colours, glass, copy] = await Promise.all([
      decode().resize(BACKGROUND_SIZE, BACKGROUND_SIZE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      decode().resize(CARD_SIZE.width, CARD_SIZE.height, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer(),
      // A poster's own lettering is read at close to its pixels, so it is kept a little finer.
      decode()
        .resize(POSTER_SIZE.width, POSTER_SIZE.height, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true }),
      raster(decode().resize(COLOURS_SIZE, COLOURS_SIZE, { fit: "inside" })),
      blurred(LARGEST_SCREEN, GLASS_BLUR),
      blurred(copyBox, POSTER_COPY_BLUR),
    ]);
    const behindPoster = measureBackdrop(copy, "poster");
    return {
      ok: true,
      picture: {
        renditions: { background, card, poster: poster.data },
        sample: {
          ...sampleColours(colours),
          ...measureBackdrop(glass),
          posterLightest: behindPoster.lightest,
          posterDarkest: behindPoster.darkest,
          posterWidth: poster.info.width,
          posterHeight: poster.info.height,
        },
      },
    };
  } catch {
    // A file whose header reads but whose pixels do not.
    return unsupported;
  }
}
