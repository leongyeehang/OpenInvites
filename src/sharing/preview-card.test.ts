import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTheme } from "@/themes/resolve";
import { DEFAULT_THEME, FONTS } from "@/themes/theme";
import { cardFaces } from "./card-fonts";
import { cardText } from "./card-text";
import { drawPreviewCard } from "./preview-card";

// The link's preview card is drawn on the instance alone, which promises its operator that it
// sends nothing to anyone. Drawn by next/og, it asked Google Fonts for a face for any character
// its own lacked (the thin spaces in an English time range, every Chinese title), sending the
// characters with it, and jsDelivr for each emoji.

const TITLES = ["Ada’s birthday 🎂", "陈家的婚宴", "陳家的婚宴"];
// How the card writes an event's time in English: Intl puts thin spaces around the dash and a
// narrow no-break space before PM.
const WHEN = "Sat, Mar 6, 2027, 7:00 – 10:00 PM";

describe("the link's preview card", () => {
  const reached: string[] = [];
  beforeEach(() => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      reached.push(String(input));
      throw new Error("The card may not reach the network");
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    reached.length = 0;
  });

  it("is drawn with the network out of reach, in every title face, for English, Chinese and emoji", async () => {
    // A host's picture comes to the card as a data URL of its card rendition.
    const rendition = await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#7a4b2a" } }).jpeg().toBuffer();
    const picture = `data:image/jpeg;base64,${rendition.toString("base64")}`;
    for (const font of FONTS) {
      const theme = resolveTheme({ ...DEFAULT_THEME, font });
      for (const title of TITLES) {
        for (const shown of [undefined, picture]) {
          const png = await drawPreviewCard({ title, hostName: "Mei 陈 🌸" }, theme, WHEN, shown);
          const { format, width, height } = await sharp(png).metadata();
          expect({ font, title, format, width, height }).toEqual({ font, title, format: "png", width: 1200, height: 630 });
        }
      }
    }
    expect(reached).toEqual([]);
  });

  it("writes Chinese titles, Simplified and Traditional, and the English date whole, in every title face", async () => {
    for (const font of FONTS) {
      const { canDraw } = await cardFaces(font);
      for (const text of ["陈家的婚宴", "陳家的婚宴", "我們的畢業典禮", "我们的毕业典礼", "Ada’s birthday"]) expect(cardText(text, canDraw), font).toBe(text);
      // Its spaces as plain ones where no face has them, or as they are where one does.
      expect(cardText(WHEN, canDraw).replace(/\s/g, " "), font).toBe("Sat, Mar 6, 2027, 7:00 – 10:00 PM");
      expect(cardText("Ada’s birthday 🎂", canDraw), font).toBe("Ada’s birthday");
    }
  });
});
