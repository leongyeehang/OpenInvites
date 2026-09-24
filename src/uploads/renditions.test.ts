import { describe, expect, it } from "vitest";
import { portraitCut, posterSrcSet, renditionNamed, RENDITION_NAMES, renditionUrl } from "./renditions";

const ID = "01a0d222-6cfe-7ae8-a96f-dbb7845ea90d";

describe("the part of a background a phone held upright shows", () => {
  it("is the middle of a wide picture, its full height, cut to 2:3", () => {
    expect(portraitCut({ width: 2048, height: 1536 })).toEqual({ left: 512, top: 0, width: 1024, height: 1536 });
    expect(portraitCut({ width: 2048, height: 1152 })).toEqual({ left: 640, top: 0, width: 768, height: 1152 });
    // A square one keeps its middle two thirds, and a photo taken upright at 3:4 a little less.
    expect(portraitCut({ width: 1500, height: 1500 })).toEqual({ left: 250, top: 0, width: 1000, height: 1500 });
    expect(portraitCut({ width: 1536, height: 2048 })).toEqual({ left: 85, top: 0, width: 1365, height: 2048 });
  });

  it("is the whole picture when it is already as narrow as that", () => {
    expect(portraitCut({ width: 1152, height: 2048 })).toEqual({ left: 0, top: 0, width: 1152, height: 2048 });
    expect(portraitCut({ width: 200, height: 300 })).toEqual({ left: 0, top: 0, width: 200, height: 300 });
  });

  // A portrait screen is at most 2:3. A picture covering it from the centre is scaled to the
  // screen's height, so the screen shows a centred band as wide as the screen is, in the
  // picture's pixels: never wider than the cut, so the cut shows the phone all it would see.
  it("holds everything a portrait screen shows of the picture", () => {
    const pictures = [
      { width: 2048, height: 1536 },
      { width: 2048, height: 1152 },
      { width: 2048, height: 683 },
      { width: 1500, height: 1500 },
      { width: 1600, height: 2048 },
    ];
    const screens = [
      { width: 390, height: 844 },
      { width: 390, height: 664 },
      { width: 412, height: 823 },
      { width: 360, height: 740 },
      { width: 400, height: 600 },
    ];
    for (const picture of pictures) {
      const cut = portraitCut(picture);
      for (const screen of screens) {
        const scale = Math.max(screen.width / picture.width, screen.height / picture.height);
        const shown = screen.width / scale;
        const from = (picture.width - shown) / 2;
        const where = `${picture.width}x${picture.height} on ${screen.width}x${screen.height}`;
        expect(cut.left, where).toBeLessThanOrEqual(Math.ceil(from));
        expect(cut.left + cut.width, where).toBeGreaterThanOrEqual(Math.floor(from + shown));
        expect(cut.height, where).toBe(picture.height);
      }
    }
  });
});

describe("the poster's widths", () => {
  it("offers the 720-pixel poster beside the full one", () => {
    expect(posterSrcSet(ID, { width: 1200, height: 1697 })).toBe(`/uploads/${ID}/poster-720.webp 720w, /uploads/${ID}/poster.webp 1200w`);
    expect(posterSrcSet(ID, { width: 900, height: 600 })).toBe(`/uploads/${ID}/poster-720.webp 720w, /uploads/${ID}/poster.webp 900w`);
  });

  it("gives a poster as tall as it can be the width its height allows", () => {
    // 1200x2400 at most, and the smaller one at 720x1440: a very tall poster stops at the height.
    expect(posterSrcSet(ID, { width: 600, height: 2400 })).toBe(`/uploads/${ID}/poster-720.webp 360w, /uploads/${ID}/poster.webp 600w`);
  });

  it("offers one picture when the poster is no wider than the smaller one", () => {
    expect(posterSrcSet(ID, { width: 720, height: 1000 })).toBeUndefined();
    expect(posterSrcSet(ID, { width: 500, height: 700 })).toBeUndefined();
  });
});

describe("the renditions", () => {
  it("are served under their file names", () => {
    for (const name of RENDITION_NAMES) expect(renditionNamed(renditionUrl(ID, name).split("/").pop()!)).toBe(name);
    expect(renditionNamed("poster-1080.webp")).toBeUndefined();
  });
});
