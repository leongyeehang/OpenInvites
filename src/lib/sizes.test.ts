import { describe, expect, it } from "vitest";
import { clockTime, formatMinutes, formatSize, GIGABYTE, MEGABYTE } from "./sizes";

// How sizes and lengths read to people (M7 ticket 01): binary units written as MB and GB.
describe("formatSize", () => {
  it("writes megabytes below a gigabyte and gigabytes from one on, with at most one decimal", () => {
    expect(formatSize(40 * MEGABYTE, "en")).toBe("40 MB");
    expect(formatSize(1.5 * GIGABYTE, "en")).toBe("1.5 GB");
    expect(formatSize(51200 * MEGABYTE, "en")).toBe("50 GB");
    expect(formatSize(1023 * MEGABYTE, "en")).toBe("1,023 MB");
  });

  it("never shows a size as nothing: under a tenth of a megabyte reads as one tenth, zero as zero", () => {
    expect(formatSize(1024, "en")).toBe("0.1 MB");
    expect(formatSize(0, "en")).toBe("0 MB");
  });

  it("keeps the unit's symbol in Chinese", () => {
    expect(formatSize(40 * MEGABYTE, "zh-Hans")).toContain("MB");
    expect(formatSize(2 * GIGABYTE, "zh-Hant")).toContain("GB");
  });
});

describe("formatMinutes", () => {
  it("writes minutes with their unit", () => {
    expect(formatMinutes(15, "en")).toBe("15 min");
    expect(formatMinutes(1, "en")).toBe("1 min");
  });
});

describe("clockTime", () => {
  it("writes a length as a clock reads it", () => {
    expect(clockTime(7_000)).toBe("0:07");
    expect(clockTime(65_000)).toBe("1:05");
    expect(clockTime(3_723_000)).toBe("1:02:03");
    expect(clockTime(0)).toBe("0:00");
  });
});
