import { describe, expect, it } from "vitest";
import { MEGABYTE } from "@/lib/sizes";
import { copyName, effectiveVideoCaps, SENT_FILE, VIDEO_FILES, videoFileNamed, videoKey, videoProblem, videoUrl } from "./video";

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
