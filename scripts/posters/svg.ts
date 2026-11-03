// Small helpers for drawing the gallery posters as SVG (scripts/posters/art.ts). Every poster is
// 1200 by 1500, 4:5, with no text in it: the title is the page's, set in the host's font.

export const W = 1200;
export const H = 1500;
export const TAU = Math.PI * 2;

// A seeded random source, so a poster draws the same every time it is built.
export function rng(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (value: number) => Number(value.toFixed(1));

type Stops = [offset: number, colour: string, opacity?: number][];

const stops = (list: Stops) =>
  list.map(([offset, colour, opacity]) => `<stop offset="${offset}" stop-color="${colour}"${opacity === undefined ? "" : ` stop-opacity="${opacity}"`}/>`).join("");

export const linear = (id: string, list: Stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;

export const radial = (id: string, list: Stops, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;

// A fine grain over the whole poster, as print has, so flat colour does not look digital.
export const GRAIN_FILTER = `<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" seed="7"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="table" tableValues="0 0.11"/></feComponentTransfer>
</filter>`;
export const GRAIN = `<rect width="${W}" height="${H}" filter="url(#grain)"/>`;

export const blurFilter = (id: string, deviation: number) =>
  `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${deviation}"/></filter>`;

// A whole poster: its definitions, its drawing, and the grain on top.
export function poster(defs: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${GRAIN_FILTER}${defs}</defs>${body}${GRAIN}</svg>\n`;
}

export const rect = (fill: string, x = 0, y = 0, width = W, height = H, extra = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${fill}"${extra}/>`;

export const circle = (x: number, y: number, r: number, fill: string, extra = "") => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"${extra}/>`;

export const ellipse = (x: number, y: number, rx: number, ry: number, fill: string, extra = "") =>
  `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${extra}/>`;

export const path = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}"${extra}/>`;

// A group of shapes, moved by `transform` unless it is empty.
export const group = (transform: string, body: string, extra = "") => `<g${transform ? ` transform="${transform}"` : ""}${extra}>${body}</g>`;

export const at = (x: number, y: number, rotate = 0, scale = 1) => `translate(${n(x)} ${n(y)}) rotate(${n(rotate)}) scale(${n(scale * 100) / 100})`;

// A four-pointed sparkle centred on the origin.
export const sparkle = (r: number, fill: string, extra = "") =>
  path(`M0 ${-r} Q0 0 ${r} 0 Q0 0 0 ${r} Q0 0 ${-r} 0 Q0 0 0 ${-r}Z`, fill, extra);

// A candle flame centred on the origin, with its glow.
export const flame = (s: number, glow: string) =>
  circle(0, 0, s * 5, `url(#${glow})`) +
  path(`M0 ${-s * 1.7} C${s * 0.95} ${-s * 0.4} ${s * 0.75} ${s * 0.85} 0 ${s * 0.85} C${-s * 0.75} ${s * 0.85} ${-s * 0.95} ${-s * 0.4} 0 ${-s * 1.7}Z`, "url(#flameBody)");

export const FLAME_DEFS =
  radial("flameGlow", [
    [0, "#ffd08a", 0.55],
    [1, "#ff9a3c", 0],
  ]) +
  linear("flameBody", [
    [0, "#fff8e4"],
    [0.55, "#ffd27a"],
    [1, "#ff9a3c"],
  ]);

// Confetti strips and dots scattered over a box.
export function confetti(random: () => number, count: number, colours: string[], box = { x: 0, y: 0, w: W, h: H }, size = 1): string {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = box.x + random() * box.w;
    const y = box.y + random() * box.h;
    const colour = colours[i % colours.length];
    const opacity = (0.7 + random() * 0.3).toFixed(2);
    if (i % 3 === 0) out += circle(x, y, (5 + random() * 6) * size, colour, ` opacity="${opacity}"`);
    else out += group(at(x, y, random() * 180), rect(colour, -11 * size, -4.5 * size, 22 * size, 9 * size, ` rx="${2 * size}" opacity="${opacity}"`));
  }
  return out;
}

// Points along a quadratic curve.
export function quad(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): [number, number] {
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
}
