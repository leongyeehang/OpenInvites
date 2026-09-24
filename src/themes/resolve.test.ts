import { describe, expect, it } from "vitest";
import { css, TONES } from "./legibility";
import { posterTitleVariables, resolveTheme, sheetVariables, themeVariables, type ThemeUpload } from "./resolve";
import { DEFAULT_THEME, type Theme } from "./theme";

const UPLOAD = "0192f0a1-7b3c-7d4e-8f00-123456789abc";
const onUpload: Theme = { ...DEFAULT_THEME, backgroundId: null, uploadId: UPLOAD };

// The same picture as a portrait poster, the widths it comes in, and its blurred copy behind it: dark.
const POSTER: ThemeUpload["poster"] = {
  src: `/uploads/${UPLOAD}/poster.webp`,
  srcSet: `/uploads/${UPLOAD}/poster-720.webp 720w, /uploads/${UPLOAD}/poster.webp 1200w`,
  copySrc: `/uploads/${UPLOAD}/poster-copy.webp`,
  width: 1200,
  height: 1800,
  lightest: "#202020",
  darkest: "#707070",
};

// The event's upload as the server sampled it: a dark photo unless a test says otherwise.
const upload = (sampled: Partial<ThemeUpload> = {}): ThemeUpload => ({
  id: UPLOAD,
  src: `/uploads/${UPLOAD}/background.webp`,
  portraitSrc: `/uploads/${UPLOAD}/background-portrait.webp`,
  accent: "#3aa885",
  luminance: 0.2,
  lightest: "#303030",
  darkest: "#505050",
  altText: "",
  poster: POSTER,
  ...sampled,
});

describe("resolveTheme", () => {
  describe("accent", () => {
    it("takes the host's override first", () => {
      expect(resolveTheme({ ...DEFAULT_THEME, accentOverride: "#ff7a59" }).accent).toBe("#ff7a59");
      expect(resolveTheme({ ...onUpload, accentOverride: "#ff7a59" }, upload()).accent).toBe("#ff7a59");
    });

    it("else the upload's sampled accent when an upload is in use", () => {
      expect(resolveTheme(onUpload, upload()).accent).toBe("#3aa885");
    });

    it("else the curated background's pre-chosen accent", () => {
      expect(resolveTheme(DEFAULT_THEME).accent).toBe("#ffc36b");
      expect(resolveTheme({ ...DEFAULT_THEME, backgroundId: "slate" }).accent).toBe("#d9d9e3");
    });

    it("leaves a kept upload alone once the host picks a curated background again", () => {
      const backToSlate: Theme = { ...onUpload, backgroundId: "slate" };
      expect(resolveTheme(backToSlate, upload({ luminance: 0.9 })).accent).toBe("#d9d9e3");
      expect(resolveTheme(backToSlate, upload({ luminance: 0.9 })).textTone).toBe("light");
    });

    it("falls back to the default background when the theme's own is unknown or the upload is missing", () => {
      expect(resolveTheme({ ...DEFAULT_THEME, backgroundId: "nope" }).accent).toBe("#ffc36b");
      expect(resolveTheme(onUpload).accent).toBe("#ffc36b");
      // An upload other than the one the theme names is not the one to show.
      expect(resolveTheme(onUpload, upload({ id: "0192f0a1-7b3c-7d4e-8f00-000000000000" })).accent).toBe("#ffc36b");
    });

    it("pairs the accent with a text colour that reads on it", () => {
      expect(css(resolveTheme(DEFAULT_THEME).tokens.onAccent)).toBe("#2a1540");
      expect(css(resolveTheme({ ...DEFAULT_THEME, accentOverride: "#3a1b5c" }).tokens.onAccent)).toBe("#ffffff");
    });
  });

  describe("text tone", () => {
    it("takes the host's override first", () => {
      expect(resolveTheme({ ...DEFAULT_THEME, textTone: "dark" }).textTone).toBe("dark");
      expect(resolveTheme({ ...onUpload, textTone: "light" }, upload({ luminance: 0.9 })).textTone).toBe("light");
    });

    it("is light on a dark background and dark on a light one", () => {
      expect(resolveTheme(DEFAULT_THEME).textTone).toBe("light");
      expect(resolveTheme(onUpload, upload({ luminance: 0.9 })).textTone).toBe("dark");
      expect(resolveTheme(onUpload, upload({ luminance: 0.6 })).textTone).toBe("light");
      expect(resolveTheme(onUpload, upload({ luminance: 0.61 })).textTone).toBe("dark");
    });
  });

  it("renders every stored layout as Poster in M1", () => {
    expect(resolveTheme({ ...DEFAULT_THEME, layout: "broadsheet" }).layout).toBe("poster");
    expect(resolveTheme({ ...DEFAULT_THEME, layout: "thread" }).layout).toBe("poster");
  });

  it("resolves the background to what the page paints and the title font to its face", () => {
    expect(resolveTheme(DEFAULT_THEME).background).toMatchObject({ kind: "gradient", css: expect.stringContaining("#ffc36b") });
    expect(resolveTheme({ ...DEFAULT_THEME, backgroundId: "aurora" }).background).toMatchObject({ kind: "photo", src: "/backgrounds/aurora.6e1d45e9.svg" });
    expect(resolveTheme(DEFAULT_THEME).font).toMatchObject({ key: "serif", sizes: { short: "text-poster-serif" } });
    expect(resolveTheme({ ...DEFAULT_THEME, font: "rounded" }).font.key).toBe("rounded");
  });

  it("paints the host's upload as a photo background, and says which upload it is", () => {
    const resolved = resolveTheme(onUpload, upload());
    expect(resolved.background).toMatchObject({
      kind: "photo",
      src: `/uploads/${UPLOAD}/background.webp`,
      portraitSrc: `/uploads/${UPLOAD}/background-portrait.webp`,
    });
    expect(resolved.upload).toEqual(upload());
    expect(resolveTheme({ ...onUpload, backgroundId: "dusk" }, upload()).upload).toBeNull();
  });

  it("solves the page against the upload's own light and dark, so a dark photo keeps the light frost", () => {
    // Measured, a dark photo reads under the settled 10% white frost; assumed to be anything, it
    // would have been smoked.
    expect(css(resolveTheme(onUpload, upload()).tokens.glass)).toBe("rgb(255 255 255 / 0.1)");
    expect(css(resolveTheme(onUpload, upload({ lightest: "#bfbfbf" })).tokens.glass)).not.toBe("rgb(255 255 255 / 0.1)");
  });

  describe("poster mode", () => {
    const asPoster: Theme = { ...onUpload, uploadMode: "poster", titlePlacement: "on" };

    it("shows the host's upload as the invitation itself: the poster at its size, with what it shows and the title where the host put it", () => {
      expect(resolveTheme(asPoster, upload({ altText: "Our summer fair poster" })).poster).toEqual({
        src: `/uploads/${UPLOAD}/poster.webp`,
        srcSet: `/uploads/${UPLOAD}/poster-720.webp 720w, /uploads/${UPLOAD}/poster.webp 1200w`,
        width: 1200,
        height: 1800,
        altText: "Our summer fair poster",
        titlePlacement: "on",
      });
      expect(resolveTheme({ ...asPoster, titlePlacement: "below" }, upload()).poster?.titlePlacement).toBe("below");
      // It is the upload in use, so guests are sent it.
      expect(resolveTheme(asPoster, upload()).upload).toEqual(upload());
    });

    it("shows no poster when the upload is the background, is put aside, or is missing", () => {
      expect(resolveTheme(onUpload, upload()).poster).toBeNull();
      expect(resolveTheme({ ...asPoster, backgroundId: "dusk" }, upload()).poster).toBeNull();
      expect(resolveTheme({ ...asPoster, backgroundId: "dusk" }, upload()).upload).toBeNull();
      expect(resolveTheme(asPoster).poster).toBeNull();
      expect(resolveTheme(DEFAULT_THEME).poster).toBeNull();
    });

    it("takes the accent and the text tone from the picture, as the background does", () => {
      expect(resolveTheme(asPoster, upload()).accent).toBe("#3aa885");
      expect(resolveTheme(asPoster, upload({ luminance: 0.9 })).textTone).toBe("dark");
      expect(resolveTheme({ ...asPoster, accentOverride: "#ff7a59" }, upload()).accent).toBe("#ff7a59");
    });

    it("solves the page against the blurred copy behind the poster, under its own stronger scrim", () => {
      expect(resolveTheme(asPoster, upload()).background).toMatchObject({ kind: "photo", src: `/uploads/${UPLOAD}/poster-copy.webp` });
      expect(resolveTheme(asPoster, upload()).tokens.scrim).toEqual(TONES.light.posterScrim);
      expect(resolveTheme(onUpload, upload()).tokens.scrim).toEqual(TONES.light.scrim);
      // The copy's own measurements decide: a bright copy smokes the glass, though the same
      // picture's darker background measurement would not.
      const brightCopy = upload({ poster: { ...POSTER, lightest: "#8c8c8c" } });
      expect(css(resolveTheme(asPoster, brightCopy).tokens.glass)).not.toBe("rgb(255 255 255 / 0.1)");
      expect(css(resolveTheme(onUpload, brightCopy).tokens.glass)).toBe("rgb(255 255 255 / 0.1)");
    });

    it("gives the title on the poster its scrim and the secondary text that reads on it, to set on itself", () => {
      const resolved = resolveTheme(asPoster, upload());
      const variables = posterTitleVariables(resolved);
      expect(variables).toEqual({
        "--theme-title-scrim": css(resolved.tokens.titleOnPoster.scrim),
        "--theme-text-muted": css(resolved.tokens.titleOnPoster.textMuted),
        "--theme-text-faint": css(resolved.tokens.titleOnPoster.textFaint),
      });
      for (const [name, value] of Object.entries(variables)) expect(value, name).toMatch(/^(#[0-9a-f]{6}|rgb\(\d+ \d+ \d+ \/ [0-9.]+\))$/);
    });
  });

  it("expresses the accent and the tone's colours as CSS variables for first paint", () => {
    const variables = themeVariables(resolveTheme(DEFAULT_THEME));
    expect(variables).toMatchObject({ "--theme-accent": "#ffc36b", "--theme-on-accent": "#2a1540", "--theme-text": "#ffffff", "--theme-base": "#1b0f2b" });
    for (const name of ["--theme-text-muted", "--theme-text-faint", "--theme-glass", "--theme-glass-strong", "--theme-veil", "--theme-accent-ink"]) {
      expect(variables[name], name).toMatch(/^(#[0-9a-f]{6}|rgb\(\d+ \d+ \d+ \/ [0-9.]+\))$/);
    }
    expect(themeVariables(resolveTheme({ ...DEFAULT_THEME, textTone: "dark" }))["--theme-text"]).toBe("#1a1030");
  });

  it("carries how guests answer: in the sheet or inline", () => {
    expect(resolveTheme(DEFAULT_THEME).rsvpStyle).toBe("sheet");
    expect(resolveTheme({ ...DEFAULT_THEME, rsvpStyle: "inline" }).rsvpStyle).toBe("inline");
  });

  it("gives the RSVP sheet its own tint, secondary text, accent ink and focus ring, to set on itself", () => {
    const resolved = resolveTheme(DEFAULT_THEME);
    const variables = sheetVariables(resolved);
    expect(variables).toEqual({
      "--theme-sheet": css(resolved.tokens.sheet.tint),
      "--theme-text-muted": css(resolved.tokens.sheet.textMuted),
      "--theme-text-faint": css(resolved.tokens.sheet.textFaint),
      "--theme-accent-ink": css(resolved.tokens.sheet.accentInk),
      "--theme-focus-ring": css(resolved.tokens.sheet.focusRing),
    });
    for (const [name, value] of Object.entries(variables)) expect(value, name).toMatch(/^(#[0-9a-f]{6}|rgb\(\d+ \d+ \d+ \/ [0-9.]+\))$/);
  });
});
