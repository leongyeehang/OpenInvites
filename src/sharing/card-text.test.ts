import { describe, expect, it } from "vitest";
import { cardText } from "./card-text";

// Faces that draw ASCII, the en dash, the curly apostrophe, the no-break space, and 陈 and 陳.
const DRAWN = new Set([..."陈陳–’ "].map((character) => character.codePointAt(0)!));
const canDraw = (codePoint: number) => (codePoint >= 0x20 && codePoint <= 0x7e) || DRAWN.has(codePoint);

describe("the text the preview card writes", () => {
  it("is the text itself where the faces draw all of it", () => {
    expect(cardText("Ada’s birthday", canDraw)).toBe("Ada’s birthday");
    expect(cardText("陈 陳", canDraw)).toBe("陈 陳");
  });

  it("writes a space the faces lack as a plain one, and keeps one they draw", () => {
    // How Intl writes an English time range: thin spaces around the dash, a narrow no-break
    // space before PM.
    expect(cardText("7:00 – 10:00 PM", canDraw)).toBe("7:00 – 10:00 PM");
    expect(cardText("Sat, Mar 6", canDraw)).toBe("Sat, Mar 6");
  });

  it("leaves out what no face can draw, an emoji whole, and the space it leaves behind", () => {
    expect(cardText("Party 🎂", canDraw)).toBe("Party");
    expect(cardText("🎉 Ada 👩🏽‍💻 turns 30 1️⃣ 🇸🇬!", canDraw)).toBe("Ada turns 30 !");
    expect(cardText("陈家婚宴 陳家婚宴", canDraw)).toBe("陈 陳");
  });
});
