import { describe, expect, it } from "vitest";
import { formatOption } from "./format";

// Intl puts thin and narrow spaces in ranges and times; compared with plain spaces.
const plain = (text: string) => text.replace(/[  ]/g, " ");

describe("formatOption", () => {
  it("writes the day, and the times as the host typed them", () => {
    expect(plain(formatOption({ day: "2027-05-08", startTime: null, endTime: null }, "en"))).toBe("Sat, May 8, 2027");
    expect(plain(formatOption({ day: "2027-05-08", startTime: "19:00", endTime: null }, "en"))).toBe("Sat, May 8, 2027 · 7:00 PM");
    expect(plain(formatOption({ day: "2027-05-08", startTime: "19:00", endTime: "22:30" }, "en"))).toBe("Sat, May 8, 2027 · 7:00 – 10:30 PM");
  });

  it("speaks the reader's language", () => {
    expect(formatOption({ day: "2027-05-08", startTime: null, endTime: null }, "zh-Hans")).toContain("5月8日");
  });
});
