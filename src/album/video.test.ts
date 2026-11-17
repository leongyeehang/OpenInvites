import { describe, expect, it } from "vitest";
import { MEGABYTE, MIN_FREE_BYTES } from "@/lib/sizes";
import {
  asProcessed,
  autoSize,
  copyEstimateBytes,
  copyName,
  copySide,
  copyTimeoutMs,
  effectiveVideoCaps,
  EVENT_SIZES,
  formatPick,
  madeBeforeReady,
  missingSizes,
  needsCopy,
  OLD_PICK_KEY,
  PICK_KEY,
  pickedSize,
  playable,
  probeOfItem,
  readPick,
  roomForCopy,
  SENT_FILE,
  shortSide,
  shouldStepDown,
  shownFailure,
  endWait,
  recentWaits,
  sizeLabel,
  sizesToMake,
  stepDown,
  TARGET_BITRATE,
  TARGET_SHORT_SIDE,
  VIDEO_FILES,
  VIDEO_QUALITIES,
  VIDEO_WORKS,
  videoFileNamed,
  videoKey,
  videoProblem,
  videoProcessor,
  videoSizes,
  videoUrl,
  withFourK,
  WORKER_STALE_MS,
  type SizePick,
  type VideoQuality,
  type VideoSize,
} from "./video";

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

// The operator's 4K copy (M8 ticket 04): for a 4K original that is not H.264, which some browsers
// cannot play, when the switch is on; never the copy made before the item is ready.
describe("the 4K copy", () => {
  const hevc4k = { codec: "hevc", width: 3840, height: 2160, rotation: 0, bitRate: 40_000_000 };
  const both = ["1080p", "720p"] as const;

  it("is added first for a 4K original that is not H.264, only with the switch on", () => {
    expect(withFourK(hevc4k, both, true)).toEqual(["2160p", "1080p", "720p"]);
    expect(withFourK(hevc4k, both, false)).toEqual(["1080p", "720p"]);
    expect(withFourK({ ...hevc4k, codec: "h264" }, both, true)).toEqual(["1080p", "720p"]);
    expect(withFourK({ ...hevc4k, width: 1920, height: 1080 }, both, true)).toEqual(["1080p", "720p"]);
    expect(withFourK({ ...hevc4k, width: 2160, height: 3840 }, both, true)).toEqual(["2160p", "1080p", "720p"]);
  });

  it("is made after the item is ready, and counts among the sizes an item lacks", () => {
    expect(sizesToMake(hevc4k, withFourK(hevc4k, both, true))).toEqual(["2160p", "1080p", "720p"]);
    expect(madeBeforeReady(hevc4k, sizesToMake(hevc4k, both))).toEqual(["1080p"]);
    const item = { codec: "hvc1.1.6.L93.B0", width: 3840, height: 2160, bytes: 10_000_000, durationMs: 2000, copies: ["1080p"] as VideoQuality[] };
    expect(missingSizes(item, withFourK(probeOfItem(item)!, both, true))).toEqual(["2160p", "720p"]);
  });

  it("is listed as 4K beside the 4K original", () => {
    const item = { codec: "hvc1.1.6.L93.B0", width: 3840, height: 2160, bytes: 10_000_000, durationMs: 2000, copies: ["720p", "2160p", "1080p"] as VideoQuality[] };
    expect(videoSizes(item).map(({ side }) => side)).toEqual([2160, 2160, 1080, 720]);
    expect(sizeLabel(2160)).toBe("4K");
  });
});

// A copy's timeout grows with the clip: 30 times its length at 4K, 8 times at the other sizes,
// never under an hour.
describe("copyTimeoutMs", () => {
  const minutes = (count: number) => count * 60_000;

  it("gives a copy an hour, or more for a long clip", () => {
    expect(copyTimeoutMs(minutes(2), "1080p")).toBe(minutes(60));
    expect(copyTimeoutMs(minutes(15), "1080p")).toBe(minutes(120));
    expect(copyTimeoutMs(minutes(1), "2160p")).toBe(minutes(60));
    expect(copyTimeoutMs(minutes(15), "2160p")).toBe(minutes(450));
  });
});

// The size a guest picked, kept on the device (M8 ticket 06): "auto", a side, or a side and
// "original"; M7's "original" or "copy" is read once from its own key.
describe("readPick and formatPick", () => {
  it("reads nothing as nothing, and each kind of pick as itself", () => {
    expect(readPick(null, null)).toBeUndefined();
    expect(readPick("auto", null)).toBe("auto");
    expect(readPick("1080", null)).toEqual({ side: 1080, original: false });
    expect(readPick("2160:original", null)).toEqual({ side: 2160, original: true });
    expect(readPick("original", null)).toEqual({ side: Infinity, original: true });
  });

  it("reads M7's choice when the new key is absent, and the new key when both are there", () => {
    expect(readPick(null, "original")).toEqual({ side: Infinity, original: true });
    expect(readPick(null, "copy")).toBe("auto");
    expect(readPick("1080", "original")).toEqual({ side: 1080, original: false });
  });

  it("reads an unreadable value as absent", () => {
    expect(readPick("junk", null)).toBeUndefined();
    expect(readPick("-5", null)).toBeUndefined();
    expect(readPick("0", null)).toBeUndefined();
    expect(readPick("junk", "copy")).toBe("auto");
  });

  it("writes each pick so that it reads back as itself", () => {
    const picks: SizePick[] = ["auto", { side: 1080, original: false }, { side: 2160, original: true }, { side: Infinity, original: true }];
    expect(picks.map(formatPick)).toEqual(["auto", "1080", "2160:original", "original"]);
    for (const pick of picks) expect(readPick(formatPick(pick), null)).toEqual(pick);
  });

  it("keeps its keys", () => {
    expect(PICK_KEY).toBe("openinvites.videoSize");
    expect(OLD_PICK_KEY).toBe("openinvites.videoQuality");
  });
});

// A 4K HDR original with a 4K copy, a 1080p and a 720p one.
const original4k: VideoSize = { name: "original", side: 2160, original: true, bitRate: 40e6 };
const copy4k: VideoSize = { name: "2160p", side: 2160, original: false, bitRate: 16e6 };
const copy1080: VideoSize = { name: "1080p", side: 1080, original: false, bitRate: 6e6 };
const copy720: VideoSize = { name: "720p", side: 720, original: false, bitRate: 3e6 };
const four = [original4k, copy4k, copy1080, copy720];

describe("pickedSize", () => {
  const all = () => true;
  const copiesOnly = (size: VideoSize) => !size.original;

  it("plays the size picked, or the nearest below, or the smallest above", () => {
    expect(pickedSize(four, { side: 1080, original: false }, all)).toBe(copy1080);
    expect(pickedSize(four, { side: 1440, original: false }, all)).toBe(copy1080);
    expect(pickedSize(four, { side: 480, original: false }, all)).toBe(copy720);
  });

  it("plays the original picked where it plays, and the copy of its side where it does not", () => {
    expect(pickedSize(four, { side: 2160, original: true }, all)).toBe(original4k);
    expect(pickedSize(four, { side: 2160, original: true }, copiesOnly)).toBe(copy4k);
    expect(pickedSize(four, { side: 2160, original: false }, all)).toBe(copy4k);
  });

  it("plays the original whatever its size, or the largest copy where it does not play", () => {
    expect(pickedSize(four, { side: Infinity, original: true }, all)).toBe(original4k);
    expect(pickedSize(four, { side: Infinity, original: true }, copiesOnly)).toBe(copy4k);
  });

  it("plays nothing when nothing plays", () => {
    expect(pickedSize(four, { side: 1080, original: false }, () => false)).toBeUndefined();
  });
});

describe("autoSize", () => {
  const video = { width: 3840, height: 2160 };
  const at = (width: number, height: number, pixelRatio: number) => ({ width, height, pixelRatio });
  const fourK = at(3840, 2160, 1);

  it("picks by the screen alone when the browser says nothing of the connection", () => {
    expect(autoSize(four, video, at(1280, 800, 1), undefined)).toBe(copy720);
    expect(autoSize(four, video, at(390, 844, 3), undefined)).toBe(copy1080);
    expect(autoSize(four, video, at(1180, 1600, 1), undefined)).toBe(copy1080);
  });

  it("never picks over the video's own size, and a copy before the original of the same side", () => {
    expect(autoSize(four, video, at(2560, 1440, 2), undefined)).toBe(copy4k);
    const small: VideoSize = { name: "original", side: 720, original: true, bitRate: 2e6 };
    expect(autoSize([small], { width: 1280, height: 720 }, fourK, undefined)).toBe(small);
    const original1080: VideoSize = { name: "original", side: 1080, original: true, bitRate: 8e6 };
    expect(autoSize([original1080, copy1080, copy720], { width: 1920, height: 1080 }, fourK, undefined)).toBe(copy1080);
  });

  it("plays the smallest under data saver or a 2G connection, and 720p at most on 3G", () => {
    expect(autoSize(four, video, fourK, { saveData: true })).toBe(copy720);
    expect(autoSize(four, video, fourK, { effectiveType: "2g" })).toBe(copy720);
    expect(autoSize(four, video, fourK, { effectiveType: "slow-2g" })).toBe(copy720);
    expect(autoSize(four, video, fourK, { effectiveType: "3g" })).toBe(copy720);
    expect(autoSize(four, video, fourK, { effectiveType: "4g" })).toBe(copy4k);
  });

  it("keeps to sizes whose bit rate fits in 0.7 of the downlink under 10 Mbit/s", () => {
    expect(autoSize(four, video, fourK, { downlink: 5 })).toBe(copy720);
    expect(autoSize(four, video, at(1920, 1080, 1), { downlink: 9 })).toBe(copy1080);
    expect(autoSize(four, video, fourK, { downlink: 1 })).toBe(copy720);
    expect(autoSize(four, video, fourK, { downlink: 12 })).toBe(copy4k);
  });

  it("picks nothing from no sizes", () => {
    expect(autoSize([], video, fourK, undefined)).toBeUndefined();
  });
});

describe("shouldStepDown and stepDown", () => {
  const now = 1_000_000;
  const ended = (secondsAgo: number) => ({ at: now - secondsAgo * 1000, until: now - secondsAgo * 1000 + 500 });

  it("steps down after three waits in a minute, or one of six seconds", () => {
    expect(shouldStepDown([], now)).toBe(false);
    expect(shouldStepDown([ended(50), ended(30), ended(1)], now)).toBe(true);
    expect(shouldStepDown([ended(61), ended(30), ended(1)], now)).toBe(false);
    expect(shouldStepDown([{ at: now - 6000 }], now)).toBe(true);
    expect(shouldStepDown([{ at: now - 5999 }], now)).toBe(false);
  });

  // Ticket 06's review, carried in ticket 07: a guest who pauses during a stall ends its wait, so
  // the six-second check finds none open and a paused video is not stepped down.
  it("ends the open wait, so a pause during a stall is no long wait six seconds on", () => {
    const paused = endWait([ended(30), { at: now - 6000 }], now - 4000);
    expect(paused).toEqual([ended(30), { at: now - 6000, until: now - 4000 }]);
    expect(shouldStepDown(paused, now)).toBe(false);
    expect(shouldStepDown([ended(30), { at: now - 6000 }], now)).toBe(true);
    expect(endWait([ended(1)], now)).toEqual([ended(1)]);
  });

  it("keeps the waits still counted: those open, and those begun within the minute", () => {
    const open = { at: now - 90_000, check: 3 };
    const old = { ...ended(61), check: 1 };
    const recent = { ...ended(59), check: 2 };
    expect(recentWaits([old, recent, open], now)).toEqual([recent, open]);
    expect(shouldStepDown(recentWaits([old, recent], now), now)).toBe(shouldStepDown([old, recent], now));
  });

  it("steps down to the largest smaller size, and no further than the smallest", () => {
    expect(stepDown(four, copy1080)).toBe(copy720);
    expect(stepDown(four, original4k)).toBe(copy1080);
    expect(stepDown(four, copy720)).toBeUndefined();
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

// One figure for "this video lacks a size" (media part review): processing decides from the bit
// rate the row gives back, the file as sent over its length, not the stream's, so a video just
// processed is never counted as lacking a size at the margin and queued again at every press.
describe("asProcessed", () => {
  // An H.264 1080p clip whose stream is under 1.5 times 1080p's 6 Mbit/s, while the file as sent,
  // its sound and box included, is just over.
  const stream = { codec: "h264", width: 1920, height: 1080, rotation: 0, bitRate: 8_800_000, durationMs: 10_000 };
  const bytes = 11_375_000; // 9.1 Mbit/s over ten seconds
  const both = ["1080p", "720p"] as const;

  it("is the clip with the bit rate of the file as sent, as the row reads back", () => {
    expect(asProcessed(stream, bytes)).toEqual({ ...stream, bitRate: 9_100_000 });
    expect(asProcessed(stream, bytes).bitRate).toBe(probeOfItem({ codec: "avc1.640028", width: 1920, height: 1080, bytes, durationMs: 10_000, copies: [] })!.bitRate);
  });

  it("leaves nothing missing once the sizes processing chose are made", () => {
    const made = sizesToMake(asProcessed(stream, bytes), both);
    expect(made).toEqual(["1080p", "720p"]);
    expect(missingSizes({ codec: "avc1.640028", width: 1920, height: 1080, bytes, durationMs: 10_000, copies: made }, both)).toEqual([]);
  });
});

// A copy is not started on a full disk (media part review): its size estimated from its bit rate
// and the sound's over the clip's length, and made only when the free-space floor uploads keep
// (MIN_FREE_BYTES) is still free afterwards. A disk the app cannot see (S3) never stops it.
describe("roomForCopy", () => {
  it("estimates a copy from its size's bit rate and the sound's, over the clip's length", () => {
    expect(copyEstimateBytes("1080p", 60_000)).toBe(((6_000_000 + 128_000) * 60) / 8);
    expect(copyEstimateBytes("2160p", 60_000)).toBe(((16_000_000 + 128_000) * 60) / 8);
    expect(copyEstimateBytes("720p", 1)).toBe(391);
  });

  it("makes the copy when the floor stays free afterwards, exactly included", () => {
    const copy = copyEstimateBytes("2160p", 120_000);
    expect(roomForCopy(MIN_FREE_BYTES + copy, "2160p", 120_000)).toBe(true);
    expect(roomForCopy(MIN_FREE_BYTES + copy - 1, "2160p", 120_000)).toBe(false);
    expect(roomForCopy(MIN_FREE_BYTES - 1, "720p", 1000)).toBe(false);
    expect(roomForCopy(undefined, "2160p", 3_600_000)).toBe(true);
  });
});

// What a failed video's tile is told (media part review): the reason the interface names, never
// the processor's own text, which can hold the server's scratch path.
describe("shownFailure", () => {
  it("is the length cap, or nothing", () => {
    expect(shownFailure("tooLong")).toBe("tooLong");
    expect(shownFailure("unsupported")).toBeNull();
    expect(shownFailure("ffmpeg exited with 1: /tmp/openinvites/scratch/0193-abc/sent: Invalid data found")).toBeNull();
    expect(shownFailure(null)).toBeNull();
  });
});
