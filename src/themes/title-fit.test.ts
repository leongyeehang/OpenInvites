import { describe, expect, it } from "vitest";
import { fittedTitleSize, widestWordEms } from "./title-fit";

describe("widestWordEms", () => {
  it("is the widest word's width, in ems of the title's face, with room to spare", () => {
    // Bricolage Grotesque at 800 sets "OpenInvites" 5.6em wide; the estimate is never less.
    expect(widestWordEms("OpenInvites", "grotesque")).toBeGreaterThanOrEqual(5.6);
    expect(widestWordEms("OpenInvites", "grotesque")).toBeLessThan(7.5);
    expect(widestWordEms("Casa OpenInvites", "grotesque")).toBe(widestWordEms("OpenInvites", "grotesque"));
  });

  it("counts capitals and the wide letters wider than the rest", () => {
    expect(widestWordEms("Mwmw", "serif")).toBeGreaterThan(widestWordEms("Abcd", "serif"));
    expect(widestWordEms("ABCD", "rounded")).toBeGreaterThan(widestWordEms("abcd", "rounded"));
  });

  it("takes a wider face's words as wider", () => {
    expect(widestWordEms("OpenInvites", "display")).toBeGreaterThan(widestWordEms("OpenInvites", "grotesque"));
    expect(widestWordEms("OpenInvites", "grotesque")).toBeGreaterThan(widestWordEms("OpenInvites", "serif"));
  });

  it("breaks Chinese and Japanese between any two characters, so none of them makes a long word", () => {
    expect(widestWordEms("我们的活动邀请站点名称", "serif")).toBeLessThan(1.2);
    expect(widestWordEms("Ada的家", "serif")).toBe(widestWordEms("Ada", "serif"));
  });
});

describe("fittedTitleSize", () => {
  it("steps the title's size down until its widest word fits the width it has, but no further than the floor", () => {
    const size = fittedTitleSize("OpenInvites", "grotesque", "100cqi");
    expect(size).toBe(`min(1em, max(1.75rem, calc((100cqi - 3rem) / ${widestWordEms("OpenInvites", "grotesque")})))`);
  });
});
