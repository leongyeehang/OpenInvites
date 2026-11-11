import type { KeepDetails } from "./details";

// A photo's EXIF block, read by the album itself (M8 ticket 07; plan ruling 13): sharp hands back
// the raw block and no tags, and no library is added for a handful of them. Only IFD0 and the Exif
// IFD are read, by the tags named below, and only the groups the host keeps. The GPS IFD's pointer
// is never followed, nor any other, so where a picture was taken cannot be read by accident. Every
// read is bounds-checked: a block cut short, garbage, or an IFD pointing at itself gives what was
// read before it, never an error. Pure.

// What a camera says of a picture, in its own words: the capture time as "YYYY:MM:DD HH:MM:SS"
// and its offset ("+08:00"), and the exposure in seconds, f-number, ISO and millimetres.
export type ExifFacts = {
  make?: string;
  model?: string;
  lens?: string;
  dateTime?: string;
  offset?: string;
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
};

type Group = keyof KeepDetails;
type Kind = "text" | "number";

// The tags read, by IFD, each with the group whose switch keeps it.
const IFD0_TAGS: Record<number, { key: keyof ExifFacts; group: Group; kind: Kind }> = {
  0x010f: { key: "make", group: "camera", kind: "text" },
  0x0110: { key: "model", group: "camera", kind: "text" },
};
const EXIF_TAGS: Record<number, { key: keyof ExifFacts; group: Group; kind: Kind }> = {
  0x829a: { key: "exposureTime", group: "camera", kind: "number" },
  0x829d: { key: "fNumber", group: "camera", kind: "number" },
  0x8827: { key: "iso", group: "camera", kind: "number" },
  0x9003: { key: "dateTime", group: "takenAt", kind: "text" },
  0x9011: { key: "offset", group: "takenAt", kind: "text" },
  0x920a: { key: "focalLength", group: "camera", kind: "number" },
  0xa434: { key: "lens", group: "camera", kind: "text" },
};
// IFD0's pointer to the Exif IFD, the one pointer followed.
const EXIF_POINTER = 0x8769;

// Bytes per value of the TIFF types read: ASCII, SHORT, LONG, RATIONAL, SRATIONAL and IFD, which
// some writers give the Exif IFD's pointer and which reads as a LONG.
const TYPE_SIZES: Record<number, number> = { 2: 1, 3: 2, 4: 4, 5: 8, 10: 8, 13: 4 };

const MAX_TEXT = 64;
// The most bytes 64 characters take in UTF-8. A string's count is the uploader's own, bounded only
// by the block, which may be as large as the file: no more than this is ever decoded.
const MAX_TEXT_BYTES = MAX_TEXT * 4;
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0];

export function readExif(exif: Uint8Array, groups: KeepDetails): ExifFacts {
  const facts: ExifFacts = {};
  if (!groups.takenAt && !groups.camera) return facts;
  const start = EXIF_HEADER.every((byte, i) => exif[i] === byte) ? EXIF_HEADER.length : 0;
  const block = exif.subarray(start);
  const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
  const fits = (at: number, length: number) => at >= 0 && length >= 0 && at + length <= block.byteLength;
  if (!fits(0, 8)) return facts;
  const order = String.fromCharCode(block[0], block[1]);
  if (order !== "II" && order !== "MM") return facts;
  const little = order === "II";
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  if (u16(2) !== 42) return facts;

  // One value of an entry: the first number, or the whole string; nothing when it runs past the
  // end or is of a type not read.
  const value = (slot: number, kind: Kind): string | number | undefined => {
    const type = u16(slot + 2);
    const count = u32(slot + 4);
    const size = TYPE_SIZES[type];
    if (!size || count === 0) return undefined;
    const length = size * count;
    const at = length <= 4 ? slot + 8 : u32(slot + 8);
    if (!fits(at, length)) return undefined;
    if (kind === "text") return type === 2 ? text(block.subarray(at, at + Math.min(length, MAX_TEXT_BYTES))) : undefined;
    if (type === 3) return u16(at);
    if (type === 4 || type === 13) return u32(at);
    if (type === 2) return undefined;
    const [top, bottom] = type === 5 ? [u32(at), u32(at + 4)] : [view.getInt32(at, little), view.getInt32(at + 4, little)];
    return bottom === 0 ? undefined : top / bottom;
  };

  // An IFD's entries, as far as they fit, each tag named in `tags` kept when its group is; answers
  // the Exif IFD's offset when the entry for it is met.
  const readIfd = (at: number, tags: typeof IFD0_TAGS): number | undefined => {
    if (!fits(at, 2)) return undefined;
    const entries = u16(at);
    let pointer: number | undefined;
    for (let index = 0; index < entries; index += 1) {
      const slot = at + 2 + index * 12;
      if (!fits(slot, 12)) break;
      const tag = u16(slot);
      if (tag === EXIF_POINTER) {
        const found = value(slot, "number");
        if (typeof found === "number") pointer = found;
        continue;
      }
      const known = tags[tag];
      if (!known || !groups[known.group]) continue;
      const found = value(slot, known.kind);
      if (found === undefined || found === "" || (typeof found === "number" && !(Number.isFinite(found) && found > 0))) continue;
      (facts as Record<string, string | number>)[known.key] = found;
    }
    return pointer;
  };

  try {
    const ifd0 = u32(4);
    const exifIfd = readIfd(ifd0, IFD0_TAGS);
    // Read once: an Exif IFD aimed back at IFD0 is not read again.
    if (exifIfd !== undefined && exifIfd !== ifd0) readIfd(exifIfd, EXIF_TAGS);
  } catch {
    // Bounds are checked before every read; whatever slips past them leaves what was read.
  }
  return facts;
}

// A string as people read it, at most 64 characters: NULs and control characters dropped, and the
// bidi and zero-width characters that could reorder or hide what a page shows. Video tags and the
// column read back are cleaned the same way (details.ts). Cut before it is spread, so a long value
// costs no more than a short one.
export function plainText(value: string): string {
  const head = value.slice(0, MAX_TEXT_BYTES);
  return [...withoutUnseen(head, "")].slice(0, MAX_TEXT).join("").trim();
}

// The one rule for text from outside that a page shows as it is (camera names here, captions in
// album.ts): each control character (C0, DEL and C1, line breaks and tabs among them) becomes
// `control`, and the bidi and zero-width characters, which could reorder or hide what is around
// them, are dropped.
export function withoutUnseen(value: string, control: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, control).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "");
}

// An ASCII value, read as UTF-8, which is what phones write there.
function text(bytes: Uint8Array): string {
  return plainText(new TextDecoder("utf-8").decode(bytes));
}
