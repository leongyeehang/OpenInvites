import { describe, expect, it } from "vitest";
import { strayKeys } from "./strays";

// The stray-file check (M7 ticket 10; plan ruling 10): a file in storage that no photo, video or
// host's picture names, old enough that no upload in progress could still be about to name it.

const NOW = new Date("2026-11-09T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

// A UUIDv7 made `ms` milliseconds before NOW.
function idMade(ms: number): string {
  const hex = (NOW.getTime() - ms).toString(16).padStart(12, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7abc-8def-0123456789ab`;
}

const OLD = idMade(3 * HOUR);
const KNOWN = idMade(5 * HOUR);
const named = (id: string, file: string) => id === KNOWN && file === "photo.webp";
const file = (key: string, modifiedAt = ago(2 * HOUR), size = 1000) => ({ key, size, modifiedAt });

describe("strayKeys", () => {
  it("names a file whose id nothing in the database has", () => {
    expect(strayKeys([file(`${OLD}-photo.webp`)], named, NOW)).toEqual([{ key: `${OLD}-photo.webp`, size: 1000 }]);
  });

  it("leaves a file its item names, and takes one of another kind under a known id", () => {
    expect(strayKeys([file(`${KNOWN}-photo.webp`), file(`${KNOWN}-video.mp4`)], named, NOW)).toEqual([{ key: `${KNOWN}-video.mp4`, size: 1000 }]);
  });

  it("skips a file whose id is under an hour old, since its rows may be about to follow", () => {
    expect(strayKeys([file(`${idMade(HOUR - 1)}-photo.webp`)], named, NOW)).toEqual([]);
    expect(strayKeys([file(`${idMade(HOUR + 1)}-photo.webp`)], named, NOW)).toHaveLength(1);
  });

  it("skips a file written under an hour ago, whatever its name", () => {
    expect(strayKeys([file(`${OLD}-photo.webp`, ago(HOUR - 1))], named, NOW)).toEqual([]);
    expect(strayKeys([file("stray.bin", ago(HOUR - 1))], named, NOW)).toEqual([]);
  });

  it("names a key that is no id at all, and a half-written file older than the hour", () => {
    expect(strayKeys([file("stray.bin"), file(`${OLD}-video.mp4.partial`)], named, NOW)).toEqual([
      { key: "stray.bin", size: 1000 },
      { key: `${OLD}-video.mp4.partial`, size: 1000 },
    ]);
  });

  it("takes the age limit it is given", () => {
    expect(strayKeys([file(`${idMade(2 * HOUR)}-photo.webp`, ago(2 * HOUR))], named, NOW, 3 * HOUR)).toEqual([]);
  });
});
