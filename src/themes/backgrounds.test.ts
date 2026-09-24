import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import { BACKGROUNDS, findBackground } from "./backgrounds";
import { hexToRgb, luminance } from "./legibility";

// The gallery is data contributors edit; these checks catch a slip before it reaches a page.
describe("curated backgrounds", () => {
  it("ships the prototype's nine, each with a unique id", () => {
    expect(BACKGROUNDS).toHaveLength(9);
    expect(new Set(BACKGROUNDS.map((b) => b.id)).size).toBe(9);
  });

  it("carries a pre-chosen accent and a luminance for every background", () => {
    for (const background of BACKGROUNDS) {
      expect(background.accent, background.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(background.luminance, background.id).toBeGreaterThanOrEqual(0);
      expect(background.luminance, background.id).toBeLessThanOrEqual(1);
    }
  });

  it("names every background in English, and nothing else", () => {
    expect(Object.keys(en.DesignDrawer.backgroundNames).sort()).toEqual(BACKGROUNDS.map((b) => b.id).sort());
  });

  it("carries the lightest and darkest points the legibility rule reads", () => {
    for (const background of BACKGROUNDS) {
      expect(background.lightest, background.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(background.darkest, background.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(luminance(hexToRgb(background.lightest)), background.id).toBeGreaterThanOrEqual(luminance(hexToRgb(background.darkest)));
    }
  });

  it("points every photo at a file the page can serve", () => {
    for (const background of BACKGROUNDS) {
      if (background.kind === "photo") expect(existsSync(`public${background.src}`), background.src).toBe(true);
      else expect(background.css, background.id).toMatch(/gradient\(/);
    }
  });

  it("finds a background by id and nothing for an unknown or missing id", () => {
    expect(findBackground("golden")?.accent).toBe("#ffc36b");
    expect(findBackground("nope")).toBeUndefined();
    expect(findBackground(null)).toBeUndefined();
  });
});
