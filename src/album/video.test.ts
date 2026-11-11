import { describe, expect, it } from "vitest";
import { MEGABYTE } from "@/lib/sizes";
import { chooseQuality, copyName, copySide, effectiveVideoCaps, EVENT_SIZES, madeBeforeReady, missingSizes, needsCopy, playable, probeOfItem, SENT_FILE, shortSide, sizeLabel, sizesToMake, TARGET_BITRATE, TARGET_SHORT_SIDE, VIDEO_FILES, VIDEO_QUALITIES, VIDEO_WORKS, videoFileNamed, videoKey, videoProblem, videoProcessor, videoSizes, videoUrl, WORKER_STALE_MS, type VideoQuality } from "./video";

// Videos in the album (M7 ticket 05): the files a video is kept as, and the caps a clip is held to.

// M8 ticket 02: the sizes an item may keep, largest first, and the two a host may tick.
describe("video sizes", () => {
  it("stores 4K, 1080p and 720p, and lets a host tick 1080p and 720p", () => {
    expect(VIDEO_QUALITIES).toEqual(["2160p", "1080p", "720p"]);
    expect(EVENT_SIZES).toEqual(["1080p", "720p"]);
  });
});

describe("a video's files", () => {
  it("names the original, the three sizes, the poster and the thumbnail, and never the file as sent", () => {
    expect(videoFileNamed("video.mp4")).toBe("original");
    expect(videoFileNamed("video-2160p.mp4")).toBe("copy2160");
    expect(videoFileNamed("video-1080p.mp4")).toBe("copy1080");
    expect(videoFileNamed("video-720p.mp4")).toBe("copy720");
    expect(videoFileNamed("video-poster.webp")).toBe("poster");
    expect(videoFileNamed("video-thumb.webp")).toBe("thumb");
    expect(videoFileNamed(SENT_FILE)).toBeUndefined();
    expect(videoFileNamed("photo.webp")).toBeUndefined();
    expect(VIDEO_FILES.original.type).toBe("video/mp4");
    expect(VIDEO_FILES.poster.type).toBe("image/webp");
  });

  it("keeps each under the item's id, and serves it under the uploads route", () => {
    expect(videoKey("abc", "original")).toBe("abc-video.mp4");
    expect(videoUrl("abc", "poster")).toBe("/uploads/abc/video-poster.webp");
    expect(copyName("2160p")).toBe("copy2160");
    expect(copyName("1080p")).toBe("copy1080");
    expect(copyName("720p")).toBe("copy720");
  });
});

describe("effectiveVideoCaps", () => {
  const site = { maxVideoMb: 750, maxVideoMinutes: 15, videosAvailable: true, videosOn: true };

  it("takes the site's caps when the event sets none", () => {
    expect(effectiveVideoCaps({ albumVideosAllowed: true, albumMaxVideoMb: null, albumMaxVideoMinutes: null }, site)).toEqual({ allowed: true, maxBytes: 750 * MEGABYTE, maxMs: 15 * 60_000 });
  });

  it("takes the event's caps when they are lower, and the site's when the event's are higher", () => {
    expect(effectiveVideoCaps({ albumVideosAllowed: true, albumMaxVideoMb: 100, albumMaxVideoMinutes: 2 }, site)).toEqual({ allowed: true, maxBytes: 100 * MEGABYTE, maxMs: 2 * 60_000 });
    expect(effectiveVideoCaps({ albumVideosAllowed: true, albumMaxVideoMb: 5000, albumMaxVideoMinutes: 60 }, site)).toEqual({ allowed: true, maxBytes: 750 * MEGABYTE, maxMs: 15 * 60_000 });
  });

  it("disallows videos when the event says so, or when the site has no usable ffmpeg, whatever the event says", () => {
    expect(effectiveVideoCaps({ albumVideosAllowed: false, albumMaxVideoMb: null, albumMaxVideoMinutes: null }, site).allowed).toBe(false);
    expect(effectiveVideoCaps({ albumVideosAllowed: true, albumMaxVideoMb: null, albumMaxVideoMinutes: null }, { ...site, videosAvailable: false }).allowed).toBe(false);
  });

  // M8 ticket 01: the operator's Videos switch.
  it("disallows videos while the operator has Videos switched off, whatever the event and ffmpeg say, with the same caps", () => {
    const event = { albumVideosAllowed: true, albumMaxVideoMb: 100, albumMaxVideoMinutes: 2 };
    const off = effectiveVideoCaps(event, { ...site, videosOn: false });
    expect(off.allowed).toBe(false);
    expect(off).toEqual({ ...effectiveVideoCaps(event, site), allowed: false });
  });
});

describe("videoProblem", () => {
  const caps = { maxBytes: 100 * MEGABYTE, maxMs: 2 * 60_000 };

  it("passes a clip within both caps, and one whose length is not known yet", () => {
    expect(videoProblem({ size: 50 * MEGABYTE, durationMs: 90_000 }, caps)).toBeUndefined();
    expect(videoProblem({ size: 100 * MEGABYTE, durationMs: 120_000 }, caps)).toBeUndefined();
    expect(videoProblem({ size: 50 * MEGABYTE, durationMs: undefined }, caps)).toBeUndefined();
  });

  it("refuses a clip over the size cap, and one over the length cap", () => {
    expect(videoProblem({ size: 100 * MEGABYTE + 1, durationMs: 1000 }, caps)).toBe("tooLarge");
    expect(videoProblem({ size: 1000, durationMs: 120_001 }, caps)).toBe("tooLong");
    // The size is looked at first.
    expect(videoProblem({ size: 200 * MEGABYTE, durationMs: 200_000 }, caps)).toBe("tooLarge");
  });
});

// Whether a clip needs a lighter copy (M7 ticket 06): judged by the short side, so a portrait
// 1080x1920 clip is 1080p, not "taller than 1080p" (plan ruling 13).
describe("needsCopy", () => {
  const probe = { codec: "h264", width: 1920, height: 1080, rotation: 0, bitRate: 5_000_000 };

  it("needs none for an H.264 clip at the quality or below, at a sane bit rate, portrait or not", () => {
    expect(needsCopy(probe, "1080p")).toBe(false);
    expect(needsCopy({ ...probe, width: 1080, height: 1920 }, "1080p")).toBe(false);
    expect(needsCopy({ ...probe, width: 1280, height: 720 }, "1080p")).toBe(false);
  });

  it("needs one for another codec, a larger short side, or a bit rate over one and a half times the target", () => {
    expect(needsCopy({ ...probe, codec: "hevc" }, "1080p")).toBe(true);
    expect(needsCopy({ ...probe, width: 3840, height: 2160 }, "1080p")).toBe(true);
    expect(needsCopy({ ...probe, bitRate: 20_000_000 }, "1080p")).toBe(true);
    expect(needsCopy({ ...probe, bitRate: 9_000_000 }, "1080p")).toBe(false);
    expect(needsCopy({ ...probe, bitRate: 9_000_001 }, "1080p")).toBe(true);
  });

  it("holds the short side and the bit rate to 720p when the host chose it", () => {
    expect(needsCopy(probe, "720p")).toBe(true);
    expect(needsCopy({ ...probe, width: 1280, height: 720, bitRate: 2_500_000 }, "720p")).toBe(false);
    expect(needsCopy({ ...probe, width: 1280, height: 720, bitRate: 4_500_001 }, "720p")).toBe(true);
    expect(TARGET_BITRATE["720p"]).toBe(3_000_000);
  });

  // M8 ticket 02: the 4K size, 16 Mbit/s.
  it("holds a 4K clip to 4K's short side and bit rate", () => {
    expect(TARGET_BITRATE["2160p"]).toBe(16_000_000);
    expect(TARGET_SHORT_SIDE["2160p"]).toBe(2160);
    expect(needsCopy({ ...probe, codec: "hevc", width: 3840, height: 2160 }, "2160p")).toBe(true);
    expect(needsCopy({ ...probe, width: 3840, height: 2160, bitRate: 20_000_000 }, "2160p")).toBe(false);
  });

  it("reads the short side after a rotation", () => {
    expect(shortSide({ width: 1920, height: 1080, rotation: 90 })).toBe(1080);
    expect(shortSide({ width: 640, height: 480, rotation: 0 })).toBe(480);
  });
});

// M8 ticket 03: the sizes processing makes. Each ticked size when needsCopy says so, skipped when
// its side matches a copy already taken, never the original's, and never larger than the original.
describe("sizesToMake", () => {
  const both = ["1080p", "720p"] as const;
  const hevc = { codec: "hevc", width: 1920, height: 1080, rotation: 0, bitRate: 5_000_000 };
  const h264 = { ...hevc, codec: "h264" };

  it("makes only the sizes a clip needs, smallest side once", () => {
    expect(sizesToMake(h264, both)).toEqual(["720p"]);
    expect(sizesToMake(hevc, both)).toEqual(["1080p", "720p"]);
    // The M7 fixture: a 720p copy would be 480 on its short side, as the 1080p one is.
    expect(sizesToMake({ ...hevc, width: 640, height: 480 }, both)).toEqual(["1080p"]);
    expect(sizesToMake({ ...hevc, width: 2160, height: 3840 }, both)).toEqual(["1080p", "720p"]);
    expect(sizesToMake({ ...h264, width: 640, height: 480, bitRate: 3_000_000 }, both)).toEqual([]);
  });

  it("never compares a size with the original, so a heavy H.264 original still gets a lighter copy at its own size", () => {
    expect(sizesToMake({ ...h264, bitRate: 20_000_000 }, both)).toEqual(["1080p", "720p"]);
  });

  it("goes through the sizes largest first whatever the order ticked, and makes only what is ticked", () => {
    expect(sizesToMake(hevc, ["720p", "1080p"])).toEqual(["1080p", "720p"]);
    expect(sizesToMake(hevc, ["720p"])).toEqual(["720p"]);
    expect(sizesToMake(hevc, [])).toEqual([]);
  });

  it("gives a copy the size's short side, or the original's when that is smaller", () => {
    expect(copySide({ width: 1920, height: 1080 }, "720p")).toBe(720);
    expect(copySide({ width: 640, height: 480 }, "1080p")).toBe(480);
    expect(copySide({ width: 2160, height: 3840 }, "2160p")).toBe(2160);
  });
});

// A video is ready as soon as it plays everywhere: only an original that is not H.264 waits for
// one copy, the first size made, or 720p when the host ticked none (M8 ticket 02's ruling).
describe("madeBeforeReady", () => {
  const hevc = { codec: "hevc", width: 1920, height: 1080, rotation: 0, bitRate: 5_000_000 };

  it("makes nothing before an H.264 clip is ready, and one copy before any other is", () => {
    expect(madeBeforeReady({ ...hevc, codec: "h264" }, ["720p"])).toEqual([]);
    expect(madeBeforeReady(hevc, ["1080p", "720p"])).toEqual(["1080p"]);
    expect(madeBeforeReady(hevc, [])).toEqual(["720p"]);
  });
});

describe("sizeLabel", () => {
  it("rounds a short side down to a standard name, and names any other by itself", () => {
    expect(sizeLabel(3840)).toBe("4K");
    expect(sizeLabel(2160)).toBe("4K");
    expect(sizeLabel(2159)).toBe("1440p");
    expect(sizeLabel(1440)).toBe("1440p");
    expect(sizeLabel(1080)).toBe("1080p");
    expect(sizeLabel(1079)).toBe("720p");
    expect(sizeLabel(720)).toBe("720p");
    expect(sizeLabel(480)).toBe("480p");
    expect(sizeLabel(479)).toBe("360p");
    expect(sizeLabel(360)).toBe("360p");
    expect(sizeLabel(300)).toBe("300p");
  });
});

// A stored item read back as a probe, for the sizes it lacks and the player's list of its sizes.
describe("an item's sizes", () => {
  const item = { codec: "hvc1.1.6.L93.B0", width: 1920, height: 1080, bytes: 500_000, durationMs: 2000, copies: [] as VideoQuality[] };
  const both = ["1080p", "720p"] as const;

  it("reads the codec string back as ffprobe's name, upright, with the bit rate of the file as sent", () => {
    expect(probeOfItem(item)).toEqual({ codec: "hevc", width: 1920, height: 1080, rotation: 0, bitRate: 2_000_000 });
    expect(probeOfItem({ ...item, codec: "avc1.640028" })?.codec).toBe("h264");
    expect(probeOfItem({ ...item, codec: "vp09" })?.codec).toBe("vp09");
    expect(probeOfItem({ ...item, bytes: 1_000_001, durationMs: 3000 })?.bitRate).toBe(2_666_669);
  });

  it("reads no probe of an item without its width, height, file size or length", () => {
    expect(probeOfItem({ ...item, width: null })).toBeUndefined();
    expect(probeOfItem({ ...item, height: null })).toBeUndefined();
    expect(probeOfItem({ ...item, bytes: null })).toBeUndefined();
    expect(probeOfItem({ ...item, durationMs: null })).toBeUndefined();
  });

  it("finds the sizes an item lacks, counting the copies it has", () => {
    expect(missingSizes({ ...item, copies: ["1080p"] }, both)).toEqual(["720p"]);
    expect(missingSizes({ ...item, copies: ["1080p", "720p"] }, both)).toEqual([]);
    // A 0.7 event that chose 720p: a 1080p copy of the 640x480 fixture would be 480, as its 720p one is.
    expect(missingSizes({ ...item, width: 640, height: 480, copies: ["720p"] }, both)).toEqual([]);
    expect(missingSizes({ ...item, codec: "avc1.640028", bytes: 1_250_000 }, both)).toEqual(["720p"]);
    expect(missingSizes(item, [])).toEqual([]);
    // A copy the event no longer asks for stays, and counts.
    expect(missingSizes({ ...item, copies: ["720p"] }, ["1080p"])).toEqual(["1080p"]);
  });

  it("lists the original first, then the copies largest first, each with its side and bit rate", () => {
    expect(videoSizes({ ...item, copies: ["720p", "1080p"] })).toEqual([
      { name: "original", side: 1080, original: true, bitRate: 2_000_000 },
      { name: "1080p", side: 1080, original: false, bitRate: 6_000_000 },
      { name: "720p", side: 720, original: false, bitRate: 3_000_000 },
    ]);
    expect(videoSizes({ ...item, width: 640, height: 480, copies: ["1080p"] }).map(({ name, side }) => ({ name, side }))).toEqual([
      { name: "original", side: 480 },
      { name: "1080p", side: 480 },
    ]);
    expect(videoSizes({ ...item, width: null })).toEqual([]);
  });

  it("names the jobs the queue does", () => {
    expect(VIDEO_WORKS).toEqual(["process", "sizes", "motion"]);
  });
});

// The player's choice of quality (M7 ticket 07): the viewer's own choice rules, kept on the
// device; a device that never chose gets the lighter copy; the original only where it plays.
describe("chooseQuality", () => {
  it("plays the original when there is no copy, whatever was chosen", () => {
    expect(chooseQuality(undefined, true, false)).toBe("original");
    expect(chooseQuality("copy", true, false)).toBe("original");
  });

  it("plays the lighter copy by default, and the stored choice when there is one", () => {
    expect(chooseQuality(undefined, true, true)).toBe("copy");
    expect(chooseQuality("original", true, true)).toBe("original");
    expect(chooseQuality("copy", true, true)).toBe("copy");
  });

  it("plays the copy when the original cannot be played here, whatever was chosen", () => {
    expect(chooseQuality("original", false, true)).toBe("copy");
    expect(chooseQuality(undefined, false, true)).toBe("copy");
    // With no copy either, the original is all there is; the player says it cannot play it.
    expect(chooseQuality("original", false, false)).toBe("original");
  });
});

describe("playable", () => {
  it("asks the browser for the codec in an MP4, and takes any answer but an empty one", () => {
    const asked: string[] = [];
    expect(playable("avc1.64001F", (type) => (asked.push(type), "probably"))).toBe(true);
    expect(asked).toEqual(['video/mp4; codecs="avc1.64001F"']);
    expect(playable("hvc1.1.6.L93.B0", () => "")).toBe(false);
    expect(playable("avc1.42E01E", () => "maybe")).toBe(true);
  });
});

describe("who processes videos", () => {
  const now = new Date("2026-11-09T12:00:00Z");

  it("is the app in app mode, whatever a worker once reported", () => {
    expect(videoProcessor("app", undefined, now)).toBe("app");
    expect(videoProcessor("app", now, now)).toBe("app");
  });

  it("is the worker while its heartbeat is under five minutes old, and missing otherwise", () => {
    expect(WORKER_STALE_MS).toBe(5 * 60_000);
    expect(videoProcessor("worker", new Date(now.getTime() - 60_000), now)).toBe("worker");
    expect(videoProcessor("worker", new Date(now.getTime() - WORKER_STALE_MS + 1), now)).toBe("worker");
    expect(videoProcessor("worker", new Date(now.getTime() - WORKER_STALE_MS), now)).toBe("missing");
    expect(videoProcessor("worker", undefined, now)).toBe("missing");
  });
});
