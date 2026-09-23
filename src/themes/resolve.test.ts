import { describe, expect, it } from "vitest";
import { css } from "./legibility";
import { resolveTheme, themeVariables } from "./resolve";
import { DEFAULT_THEME, type Theme } from "./theme";

const onUpload: Theme = { ...DEFAULT_THEME, backgroundId: null, uploadId: "0192f0a1-7b3c-7d4e-8f00-123456789abc" };

describe("resolveTheme", () => {
  describe("accent", () => {
    it("takes the host's override first", () => {
      expect(resolveTheme({ ...DEFAULT_THEME, accentOverride: "#ff7a59" }).accent).toBe("#ff7a59");
      expect(resolveTheme({ ...onUpload, accentOverride: "#ff7a59" }, { accent: "#3aa885", luminance: 0.2 }).accent).toBe("#ff7a59");
    });

    it("else the upload's sampled accent when an upload is in use", () => {
      expect(resolveTheme(onUpload, { accent: "#3aa885", luminance: 0.2 }).accent).toBe("#3aa885");
    });

    it("else the curated background's pre-chosen accent", () => {
      expect(resolveTheme(DEFAULT_THEME).accent).toBe("#ffc36b");
      expect(resolveTheme({ ...DEFAULT_THEME, backgroundId: "slate" }).accent).toBe("#d9d9e3");
    });

    it("leaves a kept upload alone once the host picks a curated background again", () => {
      const backToSlate: Theme = { ...onUpload, backgroundId: "slate" };
      expect(resolveTheme(backToSlate, { accent: "#3aa885", luminance: 0.9 }).accent).toBe("#d9d9e3");
      expect(resolveTheme(backToSlate, { accent: "#3aa885", luminance: 0.9 }).textTone).toBe("light");
    });

    it("falls back to the default background when the theme's own is unknown or the upload is missing", () => {
      expect(resolveTheme({ ...DEFAULT_THEME, backgroundId: "nope" }).accent).toBe("#ffc36b");
      expect(resolveTheme(onUpload).accent).toBe("#ffc36b");
      expect(resolveTheme(onUpload, { accent: null, luminance: 0.2 }).accent).toBe("#ffc36b");
    });

    it("pairs the accent with a text colour that reads on it", () => {
      expect(css(resolveTheme(DEFAULT_THEME).tokens.onAccent)).toBe("#2a1540");
      expect(css(resolveTheme({ ...DEFAULT_THEME, accentOverride: "#3a1b5c" }).tokens.onAccent)).toBe("#ffffff");
    });
  });

  describe("text tone", () => {
    it("takes the host's override first", () => {
      expect(resolveTheme({ ...DEFAULT_THEME, textTone: "dark" }).textTone).toBe("dark");
      expect(resolveTheme({ ...onUpload, textTone: "light" }, { accent: null, luminance: 0.9 }).textTone).toBe("light");
    });

    it("is light on a dark background and dark on a light one", () => {
      expect(resolveTheme(DEFAULT_THEME).textTone).toBe("light");
      expect(resolveTheme(onUpload, { accent: null, luminance: 0.9 }).textTone).toBe("dark");
      expect(resolveTheme(onUpload, { accent: null, luminance: 0.6 }).textTone).toBe("light");
      expect(resolveTheme(onUpload, { accent: null, luminance: 0.61 }).textTone).toBe("dark");
    });
  });

  it("renders every stored layout as Poster in M1", () => {
    expect(resolveTheme({ ...DEFAULT_THEME, layout: "broadsheet" }).layout).toBe("poster");
    expect(resolveTheme({ ...DEFAULT_THEME, layout: "thread" }).layout).toBe("poster");
  });

  it("resolves the background to what the page paints and names the title font", () => {
    expect(resolveTheme(DEFAULT_THEME).background).toMatchObject({ kind: "gradient", css: expect.stringContaining("#ffc36b") });
    expect(resolveTheme({ ...DEFAULT_THEME, backgroundId: "aurora" }).background).toMatchObject({ kind: "photo", src: "/backgrounds/aurora.svg" });
    expect(resolveTheme(DEFAULT_THEME).font).toMatchObject({ key: "serif", name: "Instrument Serif" });
    expect(resolveTheme({ ...DEFAULT_THEME, font: "rounded" }).font.name).toBe("Fredoka");
  });

  it("expresses the accent and the tone's colours as CSS variables for first paint", () => {
    const variables = themeVariables(resolveTheme(DEFAULT_THEME));
    expect(variables).toMatchObject({ "--theme-accent": "#ffc36b", "--theme-on-accent": "#2a1540", "--theme-text": "#ffffff", "--theme-base": "#1b0f2b" });
    for (const name of ["--theme-text-muted", "--theme-text-faint", "--theme-glass", "--theme-glass-strong", "--theme-veil", "--theme-accent-ink"]) {
      expect(variables[name], name).toMatch(/^(#[0-9a-f]{6}|rgb\(\d+ \d+ \d+ \/ [0-9.]+\))$/);
    }
    expect(themeVariables(resolveTheme({ ...DEFAULT_THEME, textTone: "dark" }))["--theme-text"]).toBe("#1a1030");
  });
});
