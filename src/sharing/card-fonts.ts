import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Font, FontWeight } from "satori";
import type { FontKey } from "@/themes/theme";

// The faces the link's preview card is drawn in, all in src/sharing/fonts with their licences
// (SIL Open Font License), which next.config.ts ships with the card's route. The card is drawn
// from these alone, and never fetches a face for a character they lack (card-text.ts).
//
// Satori reads TTF and OTF but not the WOFF2 the page is served, so each title face is here again
// as a TTF: its file in public/fonts unpacked, the same Latin subset. The host's name and the
// date are written in Noto Sans SC Bold, which also draws whatever the title's face lacks,
// Chinese above all. It is cut down from the Noto CJK project's NotoSansSC-Bold.otf
// (github.com/notofonts/noto-cjk, Sans/SubsetOTF/SC, version 2.004) with fontTools:
// `pyftsubset NotoSansSC-Bold.otf --text-file=<characters> --no-hinting`, the characters being
// U+0020–007E, U+00A0–00FF, U+2010–2027, U+2030–205E, U+3000–303F and U+FF00–FFEF, what GB 2312's
// rows hold (A1A1–F7FE, decoded as GBK, less private use), and Big5's symbols and level-1
// characters (A140–A3FE, A440–C67E). That is 8,861 hanzi: the Simplified characters in everyday
// use and the Traditional ones, drawn in their Simplified-region forms, in 2.2 MB.
const FOLDER = join(process.cwd(), "src/sharing/fonts");

type Face = { name: string; file: string; weight: FontWeight };

// Each title face at the weight the page sets its title in (themes/fonts.ts).
const TITLE_FACES: Record<FontKey, Face> = {
  serif: { name: "Instrument Serif", file: "instrument-serif-400.ttf", weight: 400 },
  grotesque: { name: "Bricolage Grotesque", file: "bricolage-grotesque-800.ttf", weight: 800 },
  display: { name: "Syne", file: "syne-800.ttf", weight: 800 },
  rounded: { name: "Fredoka", file: "fredoka-600.ttf", weight: 600 },
};

const TEXT_FACE: Face = { name: "Noto Sans SC", file: "noto-sans-sc-700.otf", weight: 700 };

export type CardFaces = {
  title: Face;
  text: Face;
  fonts: Font[];
  // Whether one of the faces has a glyph for a character: Satori draws each character in the
  // first face that has one.
  canDraw: (codePoint: number) => boolean;
};

type Loaded = { font: Font; codePoints: Set<number> };

// Read once each, the first time a card needs them.
const loaded = new Map<string, Promise<Loaded>>();

function load(face: Face): Promise<Loaded> {
  let found = loaded.get(face.file);
  if (!found) {
    found = readFile(join(FOLDER, face.file)).then((data) => ({
      font: { name: face.name, data, weight: face.weight, style: "normal" },
      codePoints: codePointsOf(data),
    }));
    loaded.set(face.file, found);
  }
  return found;
}

export async function cardFaces(key: FontKey): Promise<CardFaces> {
  const faces = await Promise.all([load(TITLE_FACES[key]), load(TEXT_FACE)]);
  return {
    title: TITLE_FACES[key],
    text: TEXT_FACE,
    fonts: faces.map(({ font }) => font),
    canDraw: (codePoint) => faces.some(({ codePoints }) => codePoints.has(codePoint)),
  };
}

// The characters a TrueType or OpenType font has a glyph for, from its character map: the
// Unicode subtable, in format 12 (any character) or format 4 (the Basic Multilingual Plane),
// which are what font tools write.
function codePointsOf(data: Buffer): Set<number> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tables = view.getUint16(4);
  let cmap = -1;
  for (let table = 0; table < tables; table++) {
    const record = 12 + table * 16;
    if (data.toString("latin1", record, record + 4) === "cmap") cmap = view.getUint32(record + 8);
  }
  if (cmap < 0) throw new Error("The font has no character map");

  // Where each Unicode subtable is, by its format: the Unicode platform's, or Windows' for the
  // Basic Multilingual Plane (encoding 1) or for every character (encoding 10).
  const subtables = new Map<number, number>();
  for (let index = 0; index < view.getUint16(cmap + 2); index++) {
    const record = cmap + 4 + index * 8;
    const [platform, encoding] = [view.getUint16(record), view.getUint16(record + 2)];
    const at = cmap + view.getUint32(record + 4);
    if (platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) subtables.set(view.getUint16(at), at);
  }

  const codePoints = new Set<number>();
  const format12 = subtables.get(12);
  const format4 = subtables.get(4);
  if (format12 !== undefined) {
    for (let group = 0; group < view.getUint32(format12 + 12); group++) {
      const at = format12 + 16 + group * 12;
      const [start, end, glyph] = [view.getUint32(at), view.getUint32(at + 4), view.getUint32(at + 8)];
      for (let codePoint = start; codePoint <= end; codePoint++) if (glyph + codePoint - start !== 0) codePoints.add(codePoint);
    }
  } else if (format4 !== undefined) {
    const segments = view.getUint16(format4 + 6) / 2;
    const ends = format4 + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const offsets = deltas + segments * 2;
    for (let segment = 0; segment < segments; segment++) {
      const start = view.getUint16(starts + segment * 2);
      const end = view.getUint16(ends + segment * 2);
      const delta = view.getUint16(deltas + segment * 2);
      const offset = view.getUint16(offsets + segment * 2);
      for (let codePoint = start; codePoint <= end && codePoint !== 0xffff; codePoint++) {
        const index = offset === 0 ? codePoint : view.getUint16(offsets + segment * 2 + offset + (codePoint - start) * 2);
        if (offset !== 0 && index === 0) continue;
        if (((index + delta) & 0xffff) !== 0) codePoints.add(codePoint);
      }
    }
  } else {
    throw new Error("The font has no Unicode character map in format 4 or 12");
  }
  return codePoints;
}
