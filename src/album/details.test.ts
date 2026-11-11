import { describe, expect, it } from "vitest";
import {
  albumOrderFor,
  cameraLine,
  exposureLine,
  formatTaken,
  frameRate,
  hdrKind,
  keepDetailsOf,
  photoDetails,
  readDetails,
  shownDetails,
  shutterOf,
  takenAtFrom,
  videoDetails,
  type ItemDetails,
} from "./details";

// What processing learns of an item beyond its size and length (M8 ticket 05): a video's HDR kind
// and frame rate, read from ffprobe's words, and the column read back whatever it holds. M8
// ticket 07: the capture time, camera and exposure a host may keep, and what an open item shows.

const NOW = new Date("2026-11-11T12:00:00Z");

describe("hdrKind", () => {
  it("is HLG or PQ by the stream's transfer, and nothing for standard colour or none", () => {
    expect(hdrKind("arib-std-b67")).toBe("hlg");
    expect(hdrKind("smpte2084")).toBe("pq");
    expect(hdrKind("bt709")).toBeUndefined();
    expect(hdrKind("unknown")).toBeUndefined();
    expect(hdrKind(undefined)).toBeUndefined();
  });
});

describe("frameRate", () => {
  it("reads a fraction or a number, to two decimals", () => {
    expect(frameRate("30000/1001")).toBe(29.97);
    expect(frameRate("60/1")).toBe(60);
    expect(frameRate("25")).toBe(25);
  });

  it("is nothing for a rate ffprobe could not tell", () => {
    expect(frameRate("0/0")).toBeUndefined();
    expect(frameRate("")).toBeUndefined();
    expect(frameRate("abc")).toBeUndefined();
    expect(frameRate(undefined)).toBeUndefined();
  });
});

describe("readDetails", () => {
  it("keeps what it knows and drops anything else", () => {
    expect(readDetails(null)).toEqual({});
    expect(readDetails({ hdr: "hlg", fps: 29.97 })).toEqual({ hdr: "hlg", fps: 29.97 });
    expect(readDetails({ hdr: "dolby" })).toEqual({});
    expect(readDetails({ fps: "30" })).toEqual({});
    expect(readDetails({ fps: -1 })).toEqual({});
    expect(readDetails({ hdr: "pq", camera: "iPhone" })).toEqual({ hdr: "pq" });
  });
});

describe("readDetails, with the details a host may keep (ticket 07)", () => {
  it("keeps the picture's size, the camera and the exposure, and drops what is not theirs", () => {
    const stored = {
      pixels: { width: 4032, height: 3024 },
      camera: { make: "Apple", model: "iPhone 15 Pro", lens: "back camera" },
      exposure: { shutter: "1/120", aperture: 1.78, iso: 80, focalLength: 6.86 },
    };
    expect(readDetails(stored)).toEqual(stored);
    expect(readDetails({ pixels: { width: 0, height: 10 } })).toEqual({});
    expect(readDetails({ pixels: { width: 1.5, height: 10 } })).toEqual({});
    expect(readDetails({ camera: { make: 3, model: "X", where: "Tokyo" } })).toEqual({ camera: { model: "X" } });
    expect(readDetails({ camera: {} })).toEqual({});
    expect(readDetails({ exposure: { iso: "80", aperture: -2, shutter: "1/60" } })).toEqual({ exposure: { shutter: "1/60" } });
    expect(readDetails({ location: "+35.6895+139.6917/" })).toEqual({});
  });
});

describe("keepDetailsOf", () => {
  it("is the event's two switches", () => {
    expect(keepDetailsOf({ albumKeepTakenAt: true, albumKeepCamera: false })).toEqual({ takenAt: true, camera: false });
  });
});

describe("takenAtFrom", () => {
  it("reads a capture time with its offset", () => {
    expect(takenAtFrom("2026:01:10 16:42:05", "+08:00", "Europe/London", NOW)).toEqual(new Date("2026-01-10T08:42:05Z"));
    expect(takenAtFrom("2026:01:10 16:42:05", "-05:30", "Europe/London", NOW)).toEqual(new Date("2026-01-10T22:12:05Z"));
  });

  it("reads one with no offset in the event's zone, where the party was", () => {
    expect(takenAtFrom("2026:01:10 16:42:05", undefined, "Europe/London", NOW)).toEqual(new Date("2026-01-10T16:42:05Z"));
    expect(takenAtFrom("2026:01:10 16:42:05", undefined, "Asia/Singapore", NOW)).toEqual(new Date("2026-01-10T08:42:05Z"));
  });

  it("drops a zeroed clock, a time before 2000, one more than a day ahead, and anything unreadable", () => {
    expect(takenAtFrom("0000:00:00 00:00:00", undefined, "Europe/London", NOW)).toBeNull();
    expect(takenAtFrom("1999:12:31 23:59:59", "+00:00", "Europe/London", NOW)).toBeNull();
    expect(takenAtFrom("2026:11:12 12:00:01", "+00:00", "Europe/London", NOW)).toBeNull();
    expect(takenAtFrom("2026:11:12 11:59:59", "+00:00", "Europe/London", NOW)).toEqual(new Date("2026-11-12T11:59:59Z"));
    expect(takenAtFrom("2026:02:30 10:00:00", "+00:00", "Europe/London", NOW)).toBeNull();
    expect(takenAtFrom("yesterday", undefined, "Europe/London", NOW)).toBeNull();
  });
});

describe("photoDetails", () => {
  it("turns what was read into the item's capture time, camera and exposure", () => {
    const facts = { make: "Apple", model: "iPhone 15 Pro", lens: "back camera", dateTime: "2026:01:10 16:42:05", offset: "+08:00", exposureTime: 1 / 120, fNumber: 1.78, iso: 80, focalLength: 6.86 };
    expect(photoDetails(facts, "Asia/Singapore", NOW)).toEqual({
      takenAt: new Date("2026-01-10T08:42:05Z"),
      camera: { make: "Apple", model: "iPhone 15 Pro", lens: "back camera" },
      exposure: { shutter: "1/120", aperture: 1.78, iso: 80, focalLength: 6.86 },
    });
    expect(photoDetails({}, "Asia/Singapore", NOW)).toEqual({ takenAt: null });
  });
});

describe("videoDetails", () => {
  const tags = {
    "com.apple.quicktime.creationdate": "2026-01-10T16:20:00+0800",
    creation_time: "2026-01-10T08:21:00.000000Z",
    "com.apple.quicktime.make": "Apple",
    "com.apple.quicktime.model": "iPhone 15 Pro",
    "com.apple.quicktime.location.ISO6709": "+35.6895+139.6917/",
  };

  it("takes the creation date with its offset first, and the camera, and never the location", () => {
    const details = videoDetails(tags, { takenAt: true, camera: true }, NOW);
    expect(details).toEqual({ takenAt: new Date("2026-01-10T08:20:00Z"), camera: { make: "Apple", model: "iPhone 15 Pro" } });
    expect(JSON.stringify(details)).not.toContain("35.6895");
  });

  it("falls back to the creation time, and reads an Android phone's camera", () => {
    const android = { creation_time: "2026-01-10T08:21:00.000000Z", "com.android.manufacturer": "Google", "com.android.model": "Pixel 8" };
    expect(videoDetails(android, { takenAt: true, camera: true }, NOW)).toEqual({ takenAt: new Date("2026-01-10T08:21:00Z"), camera: { make: "Google", model: "Pixel 8" } });
  });

  it("drops a creation time of 1970, and keeps nothing with both switches off", () => {
    expect(videoDetails({ creation_time: "1970-01-01T00:00:00.000000Z" }, { takenAt: true, camera: true }, NOW)).toEqual({ takenAt: null });
    expect(videoDetails(tags, { takenAt: false, camera: false }, NOW)).toEqual({ takenAt: null });
    expect(videoDetails(tags, { takenAt: false, camera: true }, NOW)).toEqual({ takenAt: null, camera: { make: "Apple", model: "iPhone 15 Pro" } });
  });
});

describe("shutterOf", () => {
  it("writes a fraction under a second and seconds from one", () => {
    expect(shutterOf(1 / 120)).toBe("1/120");
    expect(shutterOf(0.5)).toBe("1/2");
    expect(shutterOf(1 / 3200)).toBe("1/3200");
    expect(shutterOf(2)).toBe("2");
    expect(shutterOf(1.5)).toBe("1.5");
  });
});

describe("cameraLine", () => {
  it("names the camera once, and its lens after it", () => {
    expect(cameraLine({ make: "Apple", model: "iPhone 15 Pro" })).toBe("iPhone 15 Pro");
    expect(cameraLine({ make: "Canon", model: "EOS R5" })).toBe("Canon EOS R5");
    expect(cameraLine({ make: "Canon", model: "Canon EOS R5" })).toBe("Canon EOS R5");
    expect(cameraLine({ make: "NIKON CORPORATION", model: "NIKON Z 6" })).toBe("NIKON CORPORATION NIKON Z 6");
    expect(cameraLine({ make: "Canon", model: "EOS R5", lens: "RF24-70mm F2.8 L IS USM" })).toBe("Canon EOS R5 · RF24-70mm F2.8 L IS USM");
    expect(cameraLine({ model: "Pixel 8" })).toBe("Pixel 8");
    expect(cameraLine({ make: "Google" })).toBe("Google");
  });
});

describe("exposureLine", () => {
  it("reads aperture, shutter, ISO and focal length, leaving out what is missing", () => {
    expect(exposureLine({ shutter: "1/120", aperture: 1.78, iso: 80, focalLength: 6.86 })).toBe("f/1.8 · 1/120 s · ISO 80 · 6.9 mm");
    expect(exposureLine({ aperture: 2, focalLength: 50 })).toBe("f/2 · 50 mm");
    expect(exposureLine({ iso: 3200 })).toBe("ISO 3200");
  });
});

describe("shownDetails", () => {
  const camera = { make: "Apple", model: "iPhone 15 Pro" };
  const photo = (details: ItemDetails, bytes: number | null = 3_250_000) => ({ kind: "photo" as const, width: 2048, height: 1536, bytes, durationMs: null, details });

  it("shows a camera kept while the switch is on, and hides it, not erased, while it is off", () => {
    const details = { pixels: { width: 4032, height: 3024 }, camera, exposure: { shutter: "1/120", aperture: 1.78, iso: 80, focalLength: 6.86 } };
    expect(shownDetails(photo(details), { albumKeepCamera: false })).toEqual({ kind: "photo", width: 4032, height: 3024, bytes: 3_250_000 });
    expect(shownDetails(photo(details), { albumKeepCamera: true })).toEqual({
      kind: "photo",
      width: 4032,
      height: 3024,
      bytes: 3_250_000,
      camera: "iPhone 15 Pro",
      exposure: "f/1.8 · 1/120 s · ISO 80 · 6.9 mm",
    });
  });

  it("gives a photo from before 0.8 its row's size, and no file size when none is known", () => {
    expect(shownDetails(photo({}, null), { albumKeepCamera: true })).toEqual({ kind: "photo", width: 2048, height: 1536 });
  });

  it("gives a video its size by name, its frame rate, HDR, length and file size", () => {
    const video = { kind: "video" as const, width: 3840, height: 2160, bytes: 310 * 1024 * 1024, durationMs: 42_000, details: { fps: 59.94, hdr: "hlg" as const, camera } };
    expect(shownDetails(video, { albumKeepCamera: false })).toEqual({ kind: "video", size: "4K", fps: 60, hdr: true, durationMs: 42_000, bytes: 310 * 1024 * 1024 });
    expect(shownDetails(video, { albumKeepCamera: true })).toMatchObject({ camera: "iPhone 15 Pro" });
    expect(shownDetails({ ...video, details: {} }, { albumKeepCamera: false })).toEqual({ kind: "video", size: "4K", hdr: false, durationMs: 42_000, bytes: 310 * 1024 * 1024 });
  });
});

describe("albumOrderFor", () => {
  it("orders by when taken only while capture time is kept", () => {
    expect(albumOrderFor({ albumKeepTakenAt: true, albumOrder: "taken" })).toBe("taken");
    expect(albumOrderFor({ albumKeepTakenAt: false, albumOrder: "taken" })).toBe("added");
    expect(albumOrderFor({ albumKeepTakenAt: true, albumOrder: "added" })).toBe("added");
  });
});

describe("formatTaken", () => {
  it("writes the capture time in the event's zone, in the viewer's language", () => {
    const at = new Date("2026-01-10T08:42:05Z");
    expect(formatTaken(at, "Asia/Singapore", "en")).toBe(new Intl.DateTimeFormat("en", { timeZone: "Asia/Singapore", dateStyle: "long", timeStyle: "short" }).format(at));
    expect(formatTaken(at, "Asia/Singapore", "en")).toContain("4:42");
    expect(formatTaken(at, "Europe/London", "en")).toContain("8:42");
  });
});
