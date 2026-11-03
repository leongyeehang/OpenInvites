import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import { ART } from "../../scripts/posters/art";
import { findBackground } from "./backgrounds";
import { hexToRgb } from "./legibility";
import { findGalleryPoster, GALLERY_POSTERS, OCCASIONS } from "./posters";
import { BUTTON_STYLES, EFFECTS, FONTS, LEGACY_TEMPLATES, TITLE_PLACEMENTS } from "./theme";

// The gallery is data contributors edit, and files a script builds; these checks catch a slip
// before it reaches a page (docs/contributing/posters.md).
describe("the gallery posters", () => {
  it("ships twenty, each with a unique id that is no colour's", () => {
    expect(GALLERY_POSTERS).toHaveLength(20);
    expect(new Set(GALLERY_POSTERS.map((poster) => poster.id)).size).toBe(20);
    for (const poster of GALLERY_POSTERS) expect(findBackground(poster.id), poster.id).toBeUndefined();
  });

  it("are the drawings scripts/posters/art.ts makes, one each", () => {
    expect(GALLERY_POSTERS.map((poster) => poster.id).sort()).toEqual(ART.map((art) => art.id).sort());
  });

  it("sorts each under an occasion, gives every occasion one, and keeps an occasion's together", () => {
    for (const occasion of OCCASIONS) expect(GALLERY_POSTERS.some((poster) => poster.occasion === occasion), occasion).toBe(true);
    const order = GALLERY_POSTERS.map((poster) => OCCASIONS.indexOf(poster.occasion));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("names every poster and occasion in English, and nothing else", () => {
    expect(Object.keys(en.Posters.names).sort()).toEqual(GALLERY_POSTERS.map((poster) => poster.id).sort());
    expect(Object.keys(en.Posters.occasions).sort()).toEqual([...OCCASIONS].sort());
  });

  it("carries a look of knobs the drawer can show, and an accent", () => {
    for (const { id, look, accent } of GALLERY_POSTERS) {
      expect(Object.keys(look).sort(), id).toEqual(["buttonStyle", "effect", "font", "titlePlacement"]);
      expect(FONTS, id).toContain(look.font);
      expect(EFFECTS, id).toContain(look.effect);
      expect(TITLE_PLACEMENTS, id).toContain(look.titlePlacement);
      expect(BUTTON_STYLES, id).toContain(look.buttonStyle);
      expect(accent, id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("carries what was measured of it, as `pnpm posters` measures it", () => {
    for (const { id, luminance, lightest, darkest } of GALLERY_POSTERS) {
      expect(luminance, id).toBeGreaterThanOrEqual(0);
      expect(luminance, id).toBeLessThanOrEqual(1);
      expect(lightest, id).toMatch(/^#[0-9a-f]{6}$/);
      expect(darkest, id).toMatch(/^#[0-9a-f]{6}$/);
      expect(() => hexToRgb(lightest)).not.toThrow();
    }
  });

  it("is an SVG at 4:5 with no text in it, nothing it fetches, and small enough to arrive with the page", () => {
    for (const { id, src, card, copy } of GALLERY_POSTERS) {
      expect(src, id).toMatch(/^\/posters\/[a-z-]+\.[0-9a-f]{8}\.svg$/);
      expect(card, id).toMatch(/^\/posters\/[a-z-]+\.[0-9a-f]{8}\.jpg$/);
      expect(copy, id).toMatch(/^\/posters\/[a-z-]+-copy\.[0-9a-f]{8}\.webp$/);
      const svg = readFileSync(`public${src}`, "utf8");
      expect(svg.length, id).toBeLessThanOrEqual(60 * 1024);
      expect(svg, id).toContain('viewBox="0 0 1200 1500"');
      expect(svg, id).not.toMatch(/<text\b/);
      expect(svg, id).not.toMatch(/(href|src)=|url\((?!#)|@import/);
      expect(svg, id).toContain('filter="url(#grain)"');
    }
  });

  it("finds a poster by id and nothing for an unknown one", () => {
    expect(findGalleryPoster("disco")?.occasion).toBe("nightOut");
    expect(findGalleryPoster("golden")).toBeUndefined();
    expect(findGalleryPoster("nope")).toBeUndefined();
  });

  it("has a poster for each template of 0.4", () => {
    expect(Object.keys(LEGACY_TEMPLATES).sort()).toEqual(["birthday", "festival", "kids", "quiet", "supper", "vows"]);
    for (const [template, poster] of Object.entries(LEGACY_TEMPLATES)) expect(findGalleryPoster(poster), template).toBeDefined();
  });

  it("keeps the ids the four scenes of 0.4 had, which stored themes name", () => {
    for (const id of ["sunset-sea", "bokeh", "aurora", "rose"]) expect(findGalleryPoster(id), id).toBeDefined();
  });
});
