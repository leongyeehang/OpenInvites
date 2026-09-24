import sharp from "sharp";

// Pictures a host would upload, made here so the audit needs no files of its own. What matters
// for the page's weight is how much detail survives the server's re-encoding, so they are drawn
// with the detail of the real thing: soft shapes of colour under the fine, uneven texture of a
// photograph, from a fixed seed, so every run uploads the same bytes.

// A small seeded generator (mulberry32): the same numbers for the same seed, on every machine.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Grey noise at a scale, drawn small and enlarged, so each grain is `scale` pixels across, and
// `strength` from mid-grey at most.
async function noise(width: number, height: number, [scale, strength]: readonly [number, number], seed: number) {
  const next = random(seed);
  const [w, h] = [Math.ceil(width / scale), Math.ceil(height / scale)];
  const data = Buffer.alloc(w * h);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(128 + (next() + next() + next() - 1.5) * (strength / 1.5));
  return sharp(data, { raw: { width: w, height: h, channels: 1 } })
    .resize(width, height, { kernel: "cubic" })
    .png()
    .toBuffer();
}

// Grain sizes in pixels, and how strong each is: broad patches, leaves, twigs, the sensor's grain.
const TEXTURE = [
  [48, 90],
  [12, 60],
  [3, 34],
  [1, 14],
] as const;

// Texture from coarse to fine, laid over a scene in soft light, as leaves, water and a sensor's
// grain are.
async function textured(scene: string, width: number, height: number, seed: number) {
  const layers = await Promise.all(TEXTURE.map((layer, at) => noise(width, height, layer, seed + at)));
  return sharp(Buffer.from(scene))
    .resize(width, height)
    .composite(layers.map((input) => ({ input, blend: "soft-light" as const })))
    .jpeg({ quality: 88 });
}

// A phone's photo of an evening garden party: 12 megapixels, landscape, as a phone sends it.
export async function gardenPhoto() {
  const [width, height] = [4032, 3024];
  const scene = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a3a6b"/><stop offset="0.45" stop-color="#c46a5a"/><stop offset="0.6" stop-color="#f0b46a"/><stop offset="1" stop-color="#2f3d24"/>
      </linearGradient>
      <radialGradient id="light"><stop offset="0" stop-color="#ffe7a8"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#sky)"/>
    <ellipse cx="${width * 0.5}" cy="${height * 0.92}" rx="${width * 0.7}" ry="${height * 0.3}" fill="#263220"/>
    <ellipse cx="${width * 0.15}" cy="${height * 0.6}" rx="${width * 0.2}" ry="${height * 0.28}" fill="#1f2b1c"/>
    <ellipse cx="${width * 0.85}" cy="${height * 0.55}" rx="${width * 0.22}" ry="${height * 0.3}" fill="#223020"/>
    ${Array.from({ length: 14 }, (_, at) => `<circle cx="${width * (0.08 + at * 0.065)}" cy="${height * (0.32 + 0.05 * Math.sin(at))}" r="${height * 0.03}" fill="url(#light)"/>`).join("")}
  </svg>`;
  return { name: "garden-party.jpg", mimeType: "image/jpeg", buffer: await (await textured(scene, width, height, 7)).toBuffer() };
}

// A poster made in a design tool and exported for print: A4 portrait at 300 dpi, a photograph
// across its top and a band of colour with the event's lettering at its foot.
export async function fairPoster() {
  const [width, height] = [2480, 3508];
  const photo = await (await textured(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height * 0.62}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2d8"/><stop offset="0.7" stop-color="#f3d9a4"/><stop offset="1" stop-color="#6f8f4a"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${width * 0.7}" cy="${height * 0.2}" r="${width * 0.12}" fill="#fff1c1"/>
      <path d="M0 ${height * 0.5} Q ${width * 0.3} ${height * 0.38} ${width * 0.6} ${height * 0.48} T ${width} ${height * 0.44} V ${height * 0.62} H 0 Z" fill="#4f6d33"/>
    </svg>`,
    width,
    Math.round(height * 0.62),
    11,
  )).toBuffer();
  const lettering = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#1d2340"/>
    <rect y="${height * 0.62}" width="100%" height="${height * 0.38}" fill="#c0392b"/>
    <text x="${width / 2}" y="${height * 0.76}" font-family="sans-serif" font-weight="800" font-size="${width * 0.13}" fill="#fff4dc" text-anchor="middle">SUMMER FAIR</text>
    <text x="${width / 2}" y="${height * 0.84}" font-family="sans-serif" font-size="${width * 0.045}" fill="#fff4dc" text-anchor="middle">Saturday 10 July · 11am till late</text>
    <text x="${width / 2}" y="${height * 0.9}" font-family="sans-serif" font-size="${width * 0.035}" fill="#f5c16c" text-anchor="middle">The village green · music · food · games</text>
  </svg>`;
  const buffer = await sharp(Buffer.from(lettering))
    .composite([{ input: photo, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
  return { name: "summer-fair-poster.jpg", mimeType: "image/jpeg", buffer };
}
