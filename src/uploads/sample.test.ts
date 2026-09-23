import { describe, expect, it } from "vitest";
import { hexToRgb, luminance as relativeLuminance, type Rgb } from "@/themes/legibility";
import { measureBackdrop, sampleColours, type Raster } from "./sample";

// Fixture pictures: bands of colour, top to bottom, each taking its share of a 40x40 picture.
function picture(...bands: [hex: string, share: number][]): Raster {
  const width = 40;
  const height = 40;
  const data = new Uint8Array(width * height * 3);
  let row = 0;
  for (const [hex, share] of bands) {
    const [r, g, b] = hexToRgb(hex);
    const rows = Math.round(share * height);
    for (let y = row; y < Math.min(row + rows, height); y++) {
      for (let x = 0; x < width; x++) data.set([r, g, b], (y * width + x) * 3);
    }
    row += rows;
  }
  return { data, width, height, channels: 3 };
}

// Hue in degrees, HSL saturation and lightness, to say what kind of colour an accent is.
function hueAndLightness(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return { hue: 0, saturation: 0, lightness, grey: true };
  const d = max - min;
  const hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: hue * 60, saturation: d / (1 - Math.abs(2 * lightness - 1)), lightness, grey: false };
}

// Channels are whole numbers, so a lightness is only ever this close to the one asked for.
const ROUNDING = 1 / 255;

const near = (hue: number, target: number, within = 12) => Math.abs(((hue - target + 540) % 360) - 180) <= within;

describe("a picture's average luminance", () => {
  it("is the mean brightness of its pixels, as the curated backgrounds are measured", () => {
    expect(sampleColours(picture(["#ffffff", 1])).luminance).toBeCloseTo(1, 5);
    expect(sampleColours(picture(["#000000", 1])).luminance).toBeCloseTo(0, 5);
    expect(sampleColours(picture(["#ffffff", 0.5], ["#000000", 0.5])).luminance).toBeCloseTo(0.5, 5);
    expect(sampleColours(picture(["#808080", 1])).luminance).toBeCloseTo(128 / 255, 5);
  });

  it("puts a pale photo over the line for dark text and a night scene under it", () => {
    expect(sampleColours(picture(["#f3ead8", 0.7], ["#d9c7a3", 0.3])).luminance).toBeGreaterThan(0.6);
    expect(sampleColours(picture(["#1d2340", 0.8], ["#f5c16c", 0.2])).luminance).toBeLessThan(0.6);
  });
});

describe("a picture's accent", () => {
  it("is written as a CSS colour", () => {
    expect(sampleColours(picture(["#3b82f6", 1])).accent).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("is its dominant colour, not a muddy average of every colour in it", () => {
    // Sky over a beach: the sky covers more, so the accent is blue, not the grey-brown the two
    // average to.
    const { hue, saturation } = hueAndLightness(sampleColours(picture(["#3b82f6", 0.7], ["#f97316", 0.3])).accent);
    expect(near(hue, 217), `hue ${hue}`).toBe(true);
    // As vivid as the sky itself (0.91); their average is a dull 0.29.
    expect(saturation).toBeGreaterThan(0.85);
  });

  it("favours a vivid colour over a dull one that covers more of the picture", () => {
    const { hue } = hueAndLightness(sampleColours(picture(["#9c8f7a", 0.7], ["#ff2d95", 0.3])).accent);
    expect(near(hue, 330), `hue ${hue}`).toBe(true);
  });

  it("looks past white, grey and black to find the colour there is", () => {
    const { hue } = hueAndLightness(sampleColours(picture(["#ffffff", 0.4], ["#7a7a7a", 0.3], ["#0a0a0a", 0.2], ["#22c55e", 0.1])).accent);
    expect(near(hue, 142), `hue ${hue}`).toBe(true);
  });

  it("is a neutral for a picture with no colour in it", () => {
    expect(hueAndLightness(sampleColours(picture(["#333333", 0.6], ["#555555", 0.4])).accent).grey).toBe(true);
    expect(hueAndLightness(sampleColours(picture(["#fafafa", 1])).accent).grey).toBe(true);
  });

  it("is lifted on a dark picture and deepened on a light one, so it stands out as the curated accents do", () => {
    const onDark = hueAndLightness(sampleColours(picture(["#7f1d1d", 1])).accent);
    expect(near(onDark.hue, 0)).toBe(true);
    expect(onDark.lightness).toBeGreaterThanOrEqual(0.7 - ROUNDING);
    expect(onDark.lightness).toBeLessThanOrEqual(0.85 + ROUNDING);

    const onLight = hueAndLightness(sampleColours(picture(["#bfdbfe", 1])).accent);
    expect(near(onLight.hue, 213)).toBe(true);
    expect(onLight.lightness).toBeGreaterThanOrEqual(0.3 - ROUNDING);
    expect(onLight.lightness).toBeLessThanOrEqual(0.45 + ROUNDING);

    // A colour already light enough on a dark picture keeps its own lightness.
    expect(hueAndLightness(sampleColours(picture(["#101010", 0.7], ["#ffc36b", 0.3])).accent).lightness).toBeCloseTo(0.71, 1);
  });
});

describe("the backdrop the glass sees on a picture", () => {
  // `measureBackdrop` is handed the picture already blurred, as the glass blurs a background or
  // as the page blurs the copy behind a poster; what it adds is the tone's scrim, which every
  // picture wears there (themed-page.tsx), and the choice of extremes.
  const rgb = (hex: string): Rgb => hexToRgb(hex);

  it("is white and black under their scrims on a picture with both", () => {
    // The worst there can be, which is what an unmeasured picture had to be assumed to be.
    expect(measureBackdrop(picture(["#ffffff", 0.5], ["#000000", 0.5]))).toEqual({ lightest: "#bfbfbf", darkest: "#404040" });
  });

  it("is the picture's own colour under each tone's scrim when it is all one colour", () => {
    expect(measureBackdrop(picture(["#808080", 1]))).toEqual({ lightest: "#606060", darkest: "#a0a0a0" });
  });

  it("is taken under the stronger poster scrim for the blurred copy behind a poster", () => {
    // White under 45% black, and black under 45% white.
    expect(measureBackdrop(picture(["#ffffff", 0.5], ["#000000", 0.5]), "poster")).toEqual({ lightest: "#8c8c8c", darkest: "#737373" });
    expect(measureBackdrop(picture(["#808080", 1]), "poster")).toEqual({ lightest: "#464646", darkest: "#b9b9b9" });
  });

  it("is the brightest and darkest pixel as the eye sees them, not the brightest channel", () => {
    // Pure blue has a high channel but is darker to the eye than mid grey.
    const { lightest, darkest } = measureBackdrop(picture(["#0000ff", 0.5], ["#808080", 0.5]));
    expect(lightest).toBe("#606060");
    expect(relativeLuminance(rgb(darkest))).toBeLessThan(relativeLuminance(rgb("#a0a0a0")));
  });
});
