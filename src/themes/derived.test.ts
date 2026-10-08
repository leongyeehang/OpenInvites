import { describe, expect, it } from "vitest";
import { DERIVED_BACKGROUND_IDS, derivedBackground, derivedUpload, isDerivedBackground } from "./derived";
import { resolveTheme, type ThemeUpload } from "./resolve";
import { DEFAULT_THEME, type Theme } from "./theme";

const UPLOAD = "0192f0a1-7b3c-7d4e-8f00-123456789abc";

// A host's picture as the server would sample it (uploads/sample.ts): a night-blue garden
// (#1d2340) with a marigold lantern (#f5c16c), and an accent lifted from the lantern. Its
// brightest point is the lantern under the light tone's scrim (25% black) and its darkest the
// night blue under the dark tone's (25% white). Its blurred copy behind a poster is measured on
// its own, under the poster's stronger scrims (45%), where the lantern is blurred to #c8a070.
const upload: ThemeUpload = {
  id: UPLOAD,
  src: `/uploads/${UPLOAD}/background.webp`,
  portraitSrc: `/uploads/${UPLOAD}/background-portrait.webp`,
  thumbnailSrc: `/uploads/${UPLOAD}/poster-720.webp`,
  accent: "#f6c571",
  luminance: 0.18,
  lightest: "#b89151",
  darkest: "#565a70",
  altText: "The garden at dusk, strung with fairy lights",
  poster: {
    src: `/uploads/${UPLOAD}/poster.webp`,
    srcSet: `/uploads/${UPLOAD}/poster-720.webp 720w, /uploads/${UPLOAD}/poster.webp 1200w`,
    copySrc: `/uploads/${UPLOAD}/poster-copy.webp`,
    width: 1200,
    height: 750,
    lightest: "#6e583e",
    darkest: "#838696",
  },
};

describe("backgrounds made from the host's picture", () => {
  it("are two, a soft blur and a colour wash, apart from the curated ones", () => {
    expect(DERIVED_BACKGROUND_IDS).toEqual(["upload-blur", "upload-wash"]);
    expect(isDerivedBackground("upload-blur")).toBe(true);
    expect(isDerivedBackground("upload-wash")).toBe(true);
    expect(isDerivedBackground("golden")).toBe(false);
    expect(isDerivedBackground(null)).toBe(false);
  });

  it("paints Soft blur with the picture's blurred copy, measured as it is behind a poster", () => {
    expect(derivedBackground("upload-blur", upload)).toEqual({
      id: "upload-blur",
      kind: "photo",
      src: `/uploads/${UPLOAD}/poster-copy.webp`,
      accent: "#f6c571",
      luminance: 0.18,
      lightest: "#6e583e",
      darkest: "#838696",
      blurred: true,
    });
  });

  it("paints Colour wash as a gradient from the picture's darkest point through its accent to its lightest", () => {
    const wash = derivedBackground("upload-wash", upload);
    expect(wash).toMatchObject({
      id: "upload-wash",
      kind: "gradient",
      css: "linear-gradient(135deg, #565a70, #f6c571, #b89151)",
      accent: "#f6c571",
      // The marigold accent is the brightest of the three stops.
      lightest: "#f6c571",
      darkest: "#565a70",
    });
    // Measured as every background's luminance is (luma): the mean of 0.3558, 0.7896 and 0.5830.
    expect(wash.luminance).toBeCloseTo(0.58, 2);
  });

  it("takes the wash's extremes from its stops by luminance, whatever the sample calls them", () => {
    // A dark picture: its brightest point under the light tone's scrim is darker than its darkest
    // under the dark tone's, and the accent is brighter than both (0.3451, 0.5572 and 0.1882).
    const wash = derivedBackground("upload-wash", { ...upload, accent: "#3aa885", lightest: "#303030", darkest: "#585858" });
    expect(wash).toMatchObject({ css: "linear-gradient(135deg, #585858, #3aa885, #303030)", lightest: "#3aa885", darkest: "#303030" });
    expect(wash.luminance).toBeCloseTo(0.36, 2);
  });
});

describe("what a guest's page is sent of the picture under a background made from it", () => {
  const on = (backgroundId: string): Theme => ({ ...DEFAULT_THEME, backgroundId, uploadId: UPLOAD });

  it("is enough to paint the page as the whole picture would", () => {
    for (const id of DERIVED_BACKGROUND_IDS) {
      expect(resolveTheme(on(id), derivedUpload(upload, id)), id).toEqual(resolveTheme(on(id), upload));
    }
  });

  it("leaves out the picture itself and its description, and under the wash its copy too", () => {
    const sent = (id: (typeof DERIVED_BACKGROUND_IDS)[number]) => JSON.stringify(derivedUpload(upload, id));
    for (const id of DERIVED_BACKGROUND_IDS) {
      for (const kept of [upload.src, upload.portraitSrc, upload.thumbnailSrc, upload.poster.src, upload.altText]) expect(sent(id), id).not.toContain(kept);
    }
    expect(sent("upload-blur")).toContain(upload.poster.copySrc);
    expect(sent("upload-wash")).not.toContain(UPLOAD);
  });
});
