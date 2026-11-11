import { describe, expect, it } from "vitest";
import { readExif, type ExifFacts } from "./exif";

// The album's own reader of a photo's EXIF block (M8 ticket 07): IFD0 and the Exif IFD by the
// tags it names, each group only when the host keeps it, bounds-checked, and the GPS IFD never
// followed, so where a picture was taken cannot be read by accident.

type Entry = { tag: number; type: 2 | 3 | 4 | 5; values: string | number[] };

// A TIFF block as a camera writes it: the header, IFD0 at offset 8, then the Exif IFD, each
// value too long for its entry placed after the IFD that names it. A rational is given as
// [numerator, denominator]; `prefix` adds sharp's leading "Exif\0\0".
function tiff(ifd0: Entry[], exif: Entry[], { order = "II", prefix = false }: { order?: "II" | "MM"; prefix?: boolean } = {}): Uint8Array {
  const little = order === "II";
  const bytes: number[] = [];
  // A whole number as `size` bytes in the block's order.
  const encode = (size: 2 | 4, value: number): number[] => {
    const out = Array.from({ length: size }, (_, i) => Math.floor(value / 256 ** i) % 256);
    return little ? out : out.reverse();
  };
  const put = (at: number, data: number[]) => data.forEach((byte, i) => (bytes[at + i] = byte));
  const raw = (entry: Entry): number[] => {
    if (entry.type === 2) return [...Buffer.from(`${entry.values as string}\0`, "latin1")];
    const values = entry.values as number[];
    return values.flatMap((value) => encode(entry.type === 3 ? 2 : 4, value));
  };
  const count = (entry: Entry) => (entry.type === 2 ? (entry.values as string).length + 1 : entry.type === 5 ? (entry.values as number[]).length / 2 : (entry.values as number[]).length);
  // An IFD at `at`, its long values after it; answers where the next free byte is.
  const writeIfd = (at: number, entries: Entry[]): number => {
    put(at, encode(2, entries.length));
    let data = at + 2 + entries.length * 12 + 4;
    entries.forEach((entry, index) => {
      const slot = at + 2 + index * 12;
      const value = raw(entry);
      put(slot, [...encode(2, entry.tag), ...encode(2, entry.type), ...encode(4, count(entry))]);
      if (value.length <= 4) put(slot + 8, [...value, 0, 0, 0, 0].slice(0, 4));
      else {
        put(slot + 8, encode(4, data));
        put(data, value);
        data += value.length + (value.length % 2);
      }
    });
    put(at + 2 + entries.length * 12, encode(4, 0));
    return data;
  };
  put(0, [...Buffer.from(order, "latin1"), ...encode(2, 42), ...encode(4, 8)]);
  const exifAt = writeIfd(8, exif.length > 0 ? [...ifd0, { tag: 0x8769, type: 4, values: [0] }] : ifd0);
  if (exif.length > 0) {
    // The pointer to the Exif IFD is IFD0's last entry; it is filled in now that its place is known.
    put(8 + 2 + ifd0.length * 12 + 8, encode(4, exifAt));
    writeIfd(exifAt, exif);
  }
  const block = Uint8Array.from(bytes, (byte) => byte ?? 0);
  return prefix ? Uint8Array.from([...Buffer.from("Exif\0\0", "latin1"), ...block]) : block;
}

const IFD0: Entry[] = [
  { tag: 0x010f, type: 2, values: "Apple" },
  { tag: 0x0110, type: 2, values: "iPhone 15 Pro" },
];
const EXIF: Entry[] = [
  { tag: 0x829a, type: 5, values: [1, 120] },
  { tag: 0x829d, type: 5, values: [178, 100] },
  { tag: 0x8827, type: 3, values: [80] },
  { tag: 0x9003, type: 2, values: "2026:01:10 16:42:05" },
  { tag: 0x9011, type: 2, values: "+08:00" },
  { tag: 0x920a, type: 5, values: [686, 100] },
  { tag: 0xa434, type: 2, values: "iPhone 15 Pro back camera 6.86mm f/1.78" },
];
const BOTH = { takenAt: true, camera: true };
const ALL: ExifFacts = {
  make: "Apple",
  model: "iPhone 15 Pro",
  lens: "iPhone 15 Pro back camera 6.86mm f/1.78",
  dateTime: "2026:01:10 16:42:05",
  offset: "+08:00",
  exposureTime: 1 / 120,
  fNumber: 1.78,
  iso: 80,
  focalLength: 6.86,
};
const KEYS = Object.keys(ALL);

describe("readExif", () => {
  it("reads the named tags from either byte order, with or without sharp's leading Exif", () => {
    for (const order of ["II", "MM"] as const) {
      for (const prefix of [false, true]) {
        expect(readExif(tiff(IFD0, EXIF, { order, prefix }), BOTH)).toEqual(ALL);
      }
    }
  });

  it("reads only the groups the host keeps", () => {
    const camera = readExif(tiff(IFD0, EXIF), { takenAt: false, camera: true });
    expect(camera).not.toHaveProperty("dateTime");
    expect(camera).not.toHaveProperty("offset");
    expect(camera).toMatchObject({ make: "Apple", model: "iPhone 15 Pro", iso: 80 });
    expect(readExif(tiff(IFD0, EXIF), { takenAt: true, camera: false })).toEqual({ dateTime: "2026:01:10 16:42:05", offset: "+08:00" });
    expect(readExif(tiff(IFD0, EXIF), { takenAt: false, camera: false })).toEqual({});
  });

  it("never follows the GPS pointer, even one aimed past the end", () => {
    for (const order of ["II", "MM"] as const) {
      const facts = readExif(tiff([...IFD0, { tag: 0x8825, type: 4, values: [0xfffffff0] }], EXIF, { order }), BOTH);
      expect(facts).toEqual(ALL);
      expect(Object.keys(facts).every((key) => KEYS.includes(key))).toBe(true);
    }
  });

  it("returns what it read so far from a truncated block, without throwing", () => {
    const block = tiff(IFD0, EXIF);
    // Cut inside the Exif IFD's values: IFD0's make and model were read.
    const cut = readExif(block.subarray(0, 120), BOTH);
    expect(cut).toMatchObject({ make: "Apple", model: "iPhone 15 Pro" });
    for (let length = 0; length < block.length; length += 7) expect(() => readExif(block.subarray(0, length), BOTH)).not.toThrow();
  });

  it("reads nothing from garbage, without throwing", () => {
    expect(readExif(Uint8Array.from({ length: 64 }, (_, i) => (i * 37) % 251), BOTH)).toEqual({});
    expect(readExif(new Uint8Array(), BOTH)).toEqual({});
    expect(readExif(Uint8Array.from(Buffer.from("MM\0*\xff\xff\xff\xff", "latin1")), BOTH)).toEqual({});
  });

  it("reads an IFD that points at itself once", () => {
    const block = tiff(IFD0, EXIF);
    // IFD0's Exif pointer aimed back at IFD0.
    const view = new DataView(block.buffer, block.byteOffset);
    view.setUint32(8 + 2 + IFD0.length * 12 + 8, 8, true);
    expect(readExif(block, BOTH)).toEqual({ make: "Apple", model: "iPhone 15 Pro" });
  });

  it("skips a value whose count runs past the end, and an IFD whose count does", () => {
    const block = tiff(IFD0, EXIF);
    const view = new DataView(block.buffer, block.byteOffset);
    // The make's count, then IFD0's entry count, past the end of the block.
    view.setUint32(8 + 2 + 4, 0x00ffffff, true);
    expect(readExif(block, BOTH)).toEqual({ ...ALL, make: undefined });
    view.setUint16(8, 0xffff, true);
    expect(() => readExif(block, BOTH)).not.toThrow();
  });

  it("cuts a string at 64 characters and drops NULs and control characters", () => {
    const long = `Canon\u0001\u0007 EOS${"x".repeat(80)}`;
    const facts = readExif(tiff([{ tag: 0x010f, type: 2, values: long }], []), BOTH);
    expect(facts.make).toBe(`Canon EOS${"x".repeat(55)}`);
    expect(facts.make).toHaveLength(64);
    const nul = readExif(tiff([{ tag: 0x0110, type: 2, values: "EOS\0\0R5" }], []), BOTH);
    expect(nul.model).toBe("EOSR5");
  });
});
