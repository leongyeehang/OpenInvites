import sharp, { type Sharp } from "sharp";
import type { RenditionName } from "./renditions";
import { measureBackdrop, sampleColours, type Raster } from "./sample";
import { imageTypeOf, MAX_PIXELS, pixelProblem } from "./validate";

// A host's picture, made ready for the page (spec, "Uploads and images"): decoded, stood upright
// by its EXIF orientation, re-encoded into the sizes the page needs, and sampled for the theme.
// Nothing the file carried besides its pixels survives: re-encoding writes no EXIF, XMP, IPTC or
// colour profile, so a photo's location never reaches a guest.

export type Sample = { luminance: number; accent: string; lightest: string; darkest: string };
export type ProcessedPicture = { renditions: Record<RenditionName, Uint8Array>; sample: Sample };
export type ProcessResult = { ok: true; picture: ProcessedPicture } | { ok: false; problem: "unsupported" | "tooManyPixels" };

// The largest the background is kept at, on its longer side.
const BACKGROUND_SIZE = 2048;
const CARD_SIZE = { width: 1200, height: 630 };

// The glass's blur (backdrop-blur-xl in glass.tsx) in CSS pixels, and the largest screen the
// curated backgrounds are measured on (backgrounds.ts). A background covers the screen, so this
// is where the picture is drawn largest and the blur covers least of it; on every smaller screen
// the same blur softens it more, so its extremes there are no worse.
const GLASS_BLUR = 24;
const LARGEST_SCREEN = { width: 1920, height: 1080 };
// Measured at a quarter of that size, where the blur is 6 pixels: the same light and dark, from
// a sixteenth of the pixels.
const MEASURE_AT = 1 / 4;

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
  const glassScale = Math.max(LARGEST_SCREEN.width / size.width, LARGEST_SCREEN.height / size.height) * MEASURE_AT;

  try {
    const [background, card, colours, glass] = await Promise.all([
      decode().resize(BACKGROUND_SIZE, BACKGROUND_SIZE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      decode().resize(CARD_SIZE.width, CARD_SIZE.height, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer(),
      raster(decode().resize(COLOURS_SIZE, COLOURS_SIZE, { fit: "inside" })),
      raster(
        decode()
          .resize(Math.max(1, Math.round(size.width * glassScale)), Math.max(1, Math.round(size.height * glassScale)), { fit: "fill" })
          .blur(GLASS_BLUR * MEASURE_AT),
      ),
    ]);
    return { ok: true, picture: { renditions: { background, card }, sample: { ...sampleColours(colours), ...measureBackdrop(glass) } } };
  } catch {
    // A file whose header reads but whose pixels do not.
    return unsupported;
  }
}
