import { describe, expect, it } from "vitest";
import { ffmpegUsable, parseFfmpegVersion } from "./ffmpeg";

// Whether the server's ffmpeg can process videos (M7 ticket 05, ADR-0007): 6 or later, since a
// phone's rotation survives a stream copy only from 6.
describe("parseFfmpegVersion", () => {
  it("reads the version from ffmpeg's first line", () => {
    expect(parseFfmpegVersion("ffmpeg version 6.1.1 Copyright (c) 2000-2023 the FFmpeg developers\nbuilt with gcc")).toBe("6.1.1");
    expect(parseFfmpegVersion("ffmpeg version n7.0.2 Copyright")).toBe("n7.0.2");
    expect(parseFfmpegVersion("ffmpeg version 5.1.4-0+deb12u1 Copyright")).toBe("5.1.4-0+deb12u1");
  });

  it("is nothing for output that is not ffmpeg's", () => {
    expect(parseFfmpegVersion("")).toBeUndefined();
    expect(parseFfmpegVersion("sh: ffmpeg: not found")).toBeUndefined();
  });
});

describe("ffmpegUsable", () => {
  it("takes 6 and later, with or without a leading n, and refuses older or unknown", () => {
    expect(ffmpegUsable("6.0")).toBe(true);
    expect(ffmpegUsable("6.1.1")).toBe(true);
    expect(ffmpegUsable("n7.0.2")).toBe(true);
    expect(ffmpegUsable("5.1.4-0+deb12u1")).toBe(false);
    expect(ffmpegUsable("4.4")).toBe(false);
    expect(ffmpegUsable(undefined)).toBe(false);
    expect(ffmpegUsable("latest")).toBe(false);
  });
});
