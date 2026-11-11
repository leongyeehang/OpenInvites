import { afterEach, describe, expect, it, vi } from "vitest";
import { checkFfmpegAtStart, detectFfmpeg, ffmpegStatus, ffmpegUsable, parseFfmpegVersion, parseFilters, toneMappingAvailable } from "./ffmpeg";

// What the start-up check is told by ffmpeg, -version and -filters, set per test; a command left
// out is a command not found.
const outputs = vi.hoisted(() => ({ byArgs: new Map<string, string>() }));
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const spawnSync = vi.fn((command: string, args: string[]) => {
    const stdout = outputs.byArgs.get(`${command} ${args.join(" ")}`);
    return stdout === undefined ? { error: new Error("ENOENT"), status: null, stdout: "" } : { status: 0, stdout };
  });
  return { ...actual, spawnSync };
});

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

// Whether HDR copies can be converted to standard colour (M8 ticket 05): the server's ffmpeg has
// the zscale and tonemap filters. ffmpeg 6 and 7 print three flag columns, 8 two.
const FILTERS = `Filters:
  T.. = Timeline support
  .S. = Slice threading
  ..C = Command support
  A = Audio input/output
  V = Video input/output
  N = Dynamic number and/or type of input/output
  | = Source or sink filter
 ... abench            A->A       Benchmark part of a filtergraph.
 ..C zscale            V->V       Apply resizing, colorspace and bit depth conversion.
 T.. tonemap           V->V       Conversion to/from different dynamic ranges.
 .S scale              V->V       Scale the input video size and/or convert the image format.
 .. libplacebo         N->V       Apply various GPU filters from libplacebo
`;

describe("parseFilters", () => {
  it("holds every filter's name and nothing from the legend", () => {
    const filters = parseFilters(FILTERS);
    expect(filters).toEqual(new Set(["abench", "zscale", "tonemap", "scale", "libplacebo"]));
    for (const legend of ["T..", "=", "Timeline", "A", "V", "N", "|", "Filters:"]) expect(filters.has(legend)).toBe(false);
  });

  it("is empty for output that is not a filter list", () => {
    expect(parseFilters("")).toEqual(new Set());
    expect(parseFilters("sh: ffmpeg: not found")).toEqual(new Set());
  });
});

describe("toneMappingAvailable", () => {
  it("is true with zscale and tonemap, and false without either", () => {
    expect(toneMappingAvailable(new Set(["zscale", "tonemap", "scale"]))).toBe(true);
    expect(toneMappingAvailable(new Set(["tonemap", "scale"]))).toBe(false);
    expect(toneMappingAvailable(new Set(["zscale", "scale"]))).toBe(false);
    expect(toneMappingAvailable(new Set())).toBe(false);
  });
});

describe("detectFfmpeg", () => {
  afterEach(() => {
    outputs.byArgs.clear();
    vi.restoreAllMocks();
  });

  const usable = () => {
    outputs.byArgs.set("ffmpeg -version", "ffmpeg version 8.1.3 Copyright (c) 2000-2026 the FFmpeg developers\n");
    outputs.byArgs.set("ffprobe -version", "ffprobe version 8.1.3 Copyright (c) 2007-2026 the FFmpeg developers\n");
  };

  it("asks a usable ffmpeg for its filters, and tells whether it tone-maps", async () => {
    const { spawnSync } = await import("node:child_process");
    usable();
    outputs.byArgs.set("ffmpeg -hide_banner -filters", FILTERS);
    expect(detectFfmpeg()).toEqual({ available: true, version: "8.1.3", toneMapping: true });
    expect(spawnSync).toHaveBeenCalledWith("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8", timeout: 5000 });
    outputs.byArgs.set("ffmpeg -hide_banner -filters", FILTERS.replace(/^.*zscale.*$/m, ""));
    expect(detectFfmpeg()).toEqual({ available: true, version: "8.1.3", toneMapping: false });
    outputs.byArgs.delete("ffmpeg -hide_banner -filters");
    expect(detectFfmpeg()).toEqual({ available: true, version: "8.1.3", toneMapping: false });
  });

  it("logs at start whether HDR copies are converted", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    usable();
    outputs.byArgs.set("ffmpeg -hide_banner -filters", FILTERS);
    checkFfmpegAtStart();
    expect(ffmpegStatus()).toMatchObject({ available: true, toneMapping: true });
    expect(log.mock.calls.flat().join("\n")).toContain("HDR videos' copies are converted to standard colour");
    log.mockClear();
    outputs.byArgs.set("ffmpeg -hide_banner -filters", "");
    checkFfmpegAtStart();
    expect(log.mock.calls.flat().join("\n")).toContain("lacks the zscale and tonemap filters");
  });
});
