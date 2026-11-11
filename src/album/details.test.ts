import { describe, expect, it } from "vitest";
import { frameRate, hdrKind, readDetails } from "./details";

// What processing learns of an item beyond its size and length (M8 ticket 05): a video's HDR kind
// and frame rate, read from ffprobe's words, and the column read back whatever it holds.

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
