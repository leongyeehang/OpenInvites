import { describe, expect, it } from "vitest";
import { MEGABYTE } from "@/lib/sizes";
import { chooseQuality, copyName, effectiveVideoCaps, needsCopy, playable, SENT_FILE, shortSide, TARGET_BITRATE, VIDEO_FILES, videoFileNamed, videoKey, videoProblem, videoUrl } from "./video";

// Videos in the album (M7 ticket 05): the files a video is kept as, and the caps a clip is held to.

describe("a video's files", () => {
  it("names the original, the two lighter copies, the poster and the thumbnail, and never the file as sent", () => {
    expect(videoFileNamed("video.mp4")).toBe("original");
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
    expect(copyName("1080p")).toBe("copy1080");
    expect(copyName("720p")).toBe("copy720");
  });
});

describe("effectiveVideoCaps", () => {
  const site = { maxVideoMb: 750, maxVideoMinutes: 15, videosAvailable: true };

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

  it("reads the short side after a rotation", () => {
    expect(shortSide({ width: 1920, height: 1080, rotation: 90 })).toBe(1080);
    expect(shortSide({ width: 640, height: 480, rotation: 0 })).toBe(480);
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
