import { css, luma, luminance as relativeLuminance, over, TONES, type Backdrop, type BackdropUse, type Rgb } from "@/themes/legibility";

// What the server reads from a host's picture (spec, "Uploads and images"), so the theme's auto
// accent and auto text tone follow it, and every surface on the page is solved against it
// (legibility.ts) as it is against each curated background. process.ts hands these rules the
// decoded picture; they only count.

// Decoded pixels, row by row, `channels` bytes each with red, green and blue first.
export type Raster = { data: Uint8Array; width: number; height: number; channels: number };

// Above this average luminance a picture counts as light, and the text on it goes dark
// (resolve.ts reads the same line).
const LIGHT_PICTURE = 0.6;

// How colourful a pixel must be to count towards the accent: its chroma, the gap between its
// strongest and weakest channel. White, greys and black have none.
const COLOURFUL = 0.12;
// Hues are counted in bands of 15 degrees, and the accent is taken from the strongest band and
// its two neighbours, so a colour that straddles two bands is not split.
const BANDS = 24;

// The accent is set as lightly on a dark picture, and as deeply on a light one, as the curated
// accents are: lifted into this range of lightness, or deepened into that one.
const ON_DARK = { from: 0.7, to: 0.85 };
const ON_LIGHT = { from: 0.3, to: 0.45 };

function* pixels({ data, width, height, channels }: Raster): Generator<Rgb> {
  for (let at = 0; at < width * height * channels; at += channels) yield [data[at], data[at + 1], data[at + 2]];
}

// The average luminance, measured as the curated backgrounds' is (backgrounds.ts), and the accent.
export function sampleColours(raster: Raster): { luminance: number; accent: string } {
  const bands = Array.from({ length: BANDS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  const mean = { r: 0, g: 0, b: 0 };
  let brightness = 0;
  let count = 0;
  for (const [r, g, b] of pixels(raster)) {
    brightness += luma([r, g, b]);
    mean.r += r;
    mean.g += g;
    mean.b += b;
    count++;
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (chroma < COLOURFUL) continue;
    // Vivid colour counts for more than dull, so a small bright subject can outweigh a wide
    // muted ground.
    const weight = chroma * chroma;
    const band = bands[Math.floor(hsl([r, g, b]).hue / (360 / BANDS)) % BANDS];
    band.weight += weight;
    band.r += r * weight;
    band.g += g * weight;
    band.b += b * weight;
  }
  const luminance = count ? brightness / count : 0;

  // The strongest band of hue, with its neighbours on either side.
  const around = (index: number) => [index - 1, index, index + 1].map((at) => bands[(at + BANDS) % BANDS]);
  const strength = (index: number) => around(index).reduce((sum, band) => sum + band.weight, 0);
  const strongest = bands.reduce((best, _, index) => (strength(index) > strength(best) ? index : best), 0);
  const dominant = around(strongest).reduce((sum, band) => ({ weight: sum.weight + band.weight, r: sum.r + band.r, g: sum.g + band.g, b: sum.b + band.b }));
  // A picture without colour gets its own average grey.
  const colour: Rgb =
    dominant.weight > 0
      ? [dominant.r / dominant.weight, dominant.g / dominant.weight, dominant.b / dominant.weight]
      : [mean.r / Math.max(count, 1), mean.g / Math.max(count, 1), mean.b / Math.max(count, 1)];

  const { hue, saturation, lightness } = hsl(colour);
  const range = luminance > LIGHT_PICTURE ? ON_LIGHT : ON_DARK;
  const accent = fromHsl(hue, saturation, Math.min(Math.max(lightness, range.from), range.to));
  return { luminance, accent: css(accent) };
}

// The picture's brightest and darkest points as text on the page meets them, from the picture
// blurred as the page blurs it (process.ts): the brightest pixel under the light tone's scrim,
// which is where light text is hardest to read, and the darkest under the dark tone's. As the
// background, that is under the glass's blur and a scene's scrim; as the blurred copy behind a
// poster, under the copy's own blur and the stronger poster scrim. The fade into the base colour
// at the foot of the page only darkens under light text and lightens under dark, so it can only
// make these easier.
export function measureBackdrop(blurred: Raster, use: BackdropUse = "background"): Backdrop {
  let lightest = { pixel: [0, 0, 0] as Rgb, luminance: 0 };
  let darkest = { pixel: [255, 255, 255] as Rgb, luminance: 1 };
  for (const pixel of pixels(blurred)) {
    const luminance = relativeLuminance(pixel);
    if (luminance > lightest.luminance) lightest = { pixel, luminance };
    if (luminance < darkest.luminance) darkest = { pixel, luminance };
  }
  const scrim = use === "poster" ? "posterScrim" : "scrim";
  return { lightest: css(over(TONES.light[scrim], lightest.pixel)), darkest: css(over(TONES.dark[scrim], darkest.pixel)) };
}

// Hue in degrees, saturation and lightness from 0 to 1.
function hsl([r, g, b]: Rgb): { hue: number; saturation: number; lightness: number } {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = d / (1 - Math.abs(2 * lightness - 1));
  const sector = max === red ? ((green - blue) / d + 6) % 6 : max === green ? (blue - red) / d + 2 : (red - green) / d + 4;
  return { hue: sector * 60, saturation, lightness };
}

function fromHsl(hue: number, saturation: number, lightness: number): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const [r, g, b] =
    hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  const m = lightness - chroma / 2;
  const channel = (value: number) => Math.min(255, Math.max(0, (value + m) * 255));
  return [channel(r), channel(g), channel(b)];
}
