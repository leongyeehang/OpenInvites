import { describe, expect, it } from "vitest";
import { parseRange } from "./range";

// A Range header against a file of a known size (M7 ticket 04): one range, clamped to the file;
// nothing for no header or several ranges (the whole file is sent); unsatisfiable past the end.
describe("parseRange", () => {
  it("reads a closed range, an open-ended one, and a suffix", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("clamps an end past the file to its last byte", () => {
    expect(parseRange("bytes=0-5000", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange("bytes=-5000", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange("bytes=0-", 1)).toEqual({ start: 0, end: 0 });
  });

  it("is nothing without a header, and for several ranges, which are answered whole", () => {
    expect(parseRange(null, 1000)).toBeUndefined();
    expect(parseRange("", 1000)).toBeUndefined();
    expect(parseRange("bytes=0-1,5-9", 1000)).toBeUndefined();
  });

  it("is unsatisfiable past the end, for a start after the end, for an empty suffix, and for nonsense", () => {
    expect(parseRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=5-2", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=abc", 1000)).toBe("unsatisfiable");
    expect(parseRange("items=0-1", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-0", 0)).toBe("unsatisfiable");
  });
});
