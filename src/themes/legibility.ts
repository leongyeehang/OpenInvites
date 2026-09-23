import type { Background } from "./backgrounds";

// Every combination of knobs must read (spec, story 44). This is the rule that makes it so: from
// the backdrop at its most extreme, the text tone and the accent, it works out how strongly the
// glass is tinted, how far secondary text may fade, and which colours go on the accent and stand
// for it as text, so that all text meets WCAG 2 AA (4.5:1). Colours are sRGB channels 0 to 255
// with an alpha of 0 to 1, blended the way a browser blends them.

export type Rgb = readonly [number, number, number];
export type Rgba = readonly [number, number, number, number];
export type Tone = "light" | "dark";

export const AA = 4.5;
// Solved a hair above AA, so that rounding to whole channels and the film grain over the
// backdrop cannot tip a page under it.
const TARGET = 4.6;

// Secondary text fades no further than its tone allows (`muted`, `faint` below), and comes no
// closer to full strength than this, so the page keeps its hierarchy and a placeholder never
// looks typed: surfaces are tinted until text at this strength reads.
const SECONDARY_AT_MOST = 0.8;

export function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as unknown as Rgb;
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// WCAG 2's relative luminance and contrast ratio.
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

// A translucent colour laid over an opaque one.
export function over([r, g, b, a]: Rgba, [R, G, B]: Rgb): Rgb {
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
// Text on a light accent (from the prototype).
const PLUM = hexToRgb("#2a1540");

// The two text tones. `shade` is the colour that pulls a surface away from the text: glass is a
// frost of white laid over a tint of it, and the tint stays 0 wherever the settled frost reads.
export const TONES = {
  light: {
    text: WHITE,
    base: hexToRgb("#1b0f2b"), // what the backdrop fades into at the foot of the page
    shade: hexToRgb("#1b0f2b"),
    frost: 0.1,
    frostStrong: 0.14,
    scrim: [0, 0, 0, 0.25] as Rgba, // over scenes
    glassBorder: [255, 255, 255, 0.15] as Rgba,
    muted: 0.75,
    faint: 0.55,
  },
  dark: {
    text: hexToRgb("#1a1030"),
    base: hexToRgb("#f4f1ea"),
    shade: WHITE,
    frost: 0.55,
    frostStrong: 0.7,
    scrim: [255, 255, 255, 0.25] as Rgba,
    glassBorder: [0, 0, 0, 0.1] as Rgba,
    muted: 0.75,
    faint: 0.55,
  },
} as const;

// The second of the two soft blobs that drift over a gradient backdrop; the first is the accent.
export const GLOW = hexToRgb("#ff5c8a");

// What a backdrop is, for this rule: the brightest point light text can meet on it and the
// darkest point dark text can meet, as a glass pane sees them (backgrounds.ts says how they are
// measured).
export type Backdrop = Pick<Background, "lightest" | "darkest">;

// An upload has not been measured (ticket 12 samples it): assume the worst, a white or a black
// picture under the tone's scrim.
export const UNMEASURED: Backdrop = { lightest: "#bfbfbf", darkest: "#404040" };

// The point of the backdrop where the tone's text is hardest to read.
export function worstBackdrop(tone: Tone, backdrop: Backdrop): Rgb {
  return hexToRgb(tone === "light" ? backdrop.lightest : backdrop.darkest);
}

export type ToneTokens = {
  base: Rgb;
  text: Rgb;
  textMuted: Rgba;
  textFaint: Rgba;
  glass: Rgba;
  glassStrong: Rgba;
  glassBorder: Rgba;
  // Behind text set straight on the page: outline buttons and short notes. Often nothing at all.
  veil: Rgba;
  scrim: Rgba;
  onAccent: Rgb;
  // The accent where it is set as text, moved towards the tone's text until it reads.
  accentInk: Rgb;
};

// A surface text is set on, as its layers over the backdrop (bottom first), and what it carries:
// the tone's text in every strength, only at full strength (a button's label), or the accent.
export type Surface = { layers: Rgba[]; carries: "every strength" | "full strength" | "accent" };

// The surfaces of the Poster layout, as its markup stacks them. Keep this in step with the
// markup when a new surface appears.
export function SURFACES({ glass, glassStrong, veil }: Pick<ToneTokens, "glass" | "glassStrong" | "veil">) {
  return {
    // Outline RSVP buttons and the "not taking replies" note, set straight on the page.
    page: { layers: [veil], carries: "every strength" },
    // The poster card and every tile.
    card: { layers: [glass], carries: "every strength" },
    // Glass RSVP buttons, notices.
    strongGlass: { layers: [glassStrong], carries: "every strength" },
    // Fields and their placeholders, the date sticker, chips, calendar links.
    inset: { layers: [glass, glassStrong], carries: "every strength" },
    // The copy button beside the edit link.
    insetButton: { layers: [glass, glassStrong, glass], carries: "full strength" },
    // "Remove my RSVP", the asterisk on a required question. Anything bigger that wants the
    // accent (the countdown, avatars, the chosen answer) is filled with it and set in onAccent.
    accentOnCard: { layers: [glass], carries: "accent" },
  } satisfies Record<string, Surface>;
}

// A frost of white at `frost` over a tint of `shade` at `tint`, as one translucent colour.
function frosted(shade: Rgb, tint: number, frost: number): Rgba {
  const alpha = 1 - (1 - frost) * (1 - tint);
  const colour = shade.map((channel) => Math.round(((1 - frost) * tint * channel + frost * 255) / alpha));
  return [...(colour as unknown as Rgb), Math.round(alpha * 1000) / 1000];
}

// The smallest step, from `from` up to 1, at which `reads` holds; at 1 it always does here.
function least(from: number, reads: (value: number) => boolean): number {
  for (let step = Math.round(from * 100); step < 100; step++) if (reads(step / 100)) return step / 100;
  return 1;
}

export function toneTokens(tone: Tone, backdrop: Backdrop, accent: string): ToneTokens {
  const t = TONES[tone];
  const behind = worstBackdrop(tone, backdrop);
  const on = (layers: Rgba[]) => layers.reduce<Rgb>((colour, layer) => over(layer, colour), behind);
  const reads = (colour: Rgb | Rgba, layers: Rgba[]) => {
    const surface = on(layers);
    return contrast(colour.length === 4 ? over(colour, surface) : colour, surface) >= TARGET;
  };
  const text = t.text;
  const secondary: Rgba = [...text, SECONDARY_AT_MOST];
  const accentRgb = hexToRgb(accent);

  // Full-strength text must read wherever it goes, secondary text at its strongest wherever it
  // goes, and the tone's text on the accent's surfaces too, because that is where the accent ink
  // ends up at worst.
  const fits = ({ layers, carries }: Surface) => reads(text, layers) && (carries !== "every strength" || reads(secondary, layers));

  // The glass is tinted as little as the page's hardest point allows.
  const glassAt = (tint: number) => ({ glass: frosted(t.shade, tint, t.frost), glassStrong: frosted(t.shade, tint, t.frostStrong) });
  const tint = least(0, (value) =>
    Object.entries(SURFACES({ ...glassAt(value), veil: [...t.shade, 0] })).every(([name, surface]) => name === "page" || fits(surface)),
  );
  const { glass, glassStrong } = glassAt(tint);
  // The veil is solved on its own: on most backdrops bare text reads with none.
  const veil: Rgba = [...t.shade, least(0, (value) => fits(SURFACES({ glass, glassStrong, veil: [...t.shade, value] }).page))];

  const surfaces: Surface[] = Object.values(SURFACES({ glass, glassStrong, veil }));
  const everyStrength = surfaces.filter((surface) => surface.carries === "every strength");
  const fadedReads = (alpha: number) => everyStrength.every(({ layers }) => reads([...text, alpha], layers));

  const accentSurfaces = surfaces.filter((surface) => surface.carries === "accent");
  const inkAt = (amount: number) => over([...text, amount], accentRgb).map(Math.round) as unknown as Rgb;
  const accentInk = inkAt(least(0, (amount) => accentSurfaces.every(({ layers }) => reads(inkAt(amount), layers))));

  return {
    base: t.base,
    text,
    textMuted: [...text, least(t.muted, fadedReads)],
    textFaint: [...text, least(t.faint, fadedReads)],
    glass,
    glassStrong,
    glassBorder: t.glassBorder,
    veil,
    scrim: t.scrim,
    onAccent: onAccent(accentRgb),
    accentInk,
  };
}

// Text on the accent: plum or white, whichever reads better (from the prototype), and black or
// white on the few mid tones where neither reaches AA. One of those two always does.
function onAccent(accent: Rgb): Rgb {
  const better = (a: Rgb, b: Rgb) => (contrast(a, accent) >= contrast(b, accent) ? a : b);
  const preferred = better(PLUM, WHITE);
  return contrast(preferred, accent) >= TARGET ? preferred : better(BLACK, WHITE);
}

// CSS for a token: hex when opaque, so resolved accents read as they were written.
export function css(colour: Rgb | Rgba): string {
  const [r, g, b] = colour.map(Math.round);
  if (colour.length === 3 || colour[3] === 1) return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  return `rgb(${r} ${g} ${b} / ${colour[3]})`;
}
