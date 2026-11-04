import { describe, expect, it } from "vitest";
import { EMOJI_BACKGROUNDS, EMOJI_PALETTE, emojiIn, parseEmojiChoice } from "./emoji";

describe("the emoji in what a host types", () => {
  it("are whole graphemes with a pictograph in them, each once, at most three", () => {
    expect(emojiIn("🎉 party 🎂🎉")).toEqual(["🎉", "🎂"]);
    expect(emojiIn("🇸🇬👍🏽👨‍👩‍👧🌈")).toEqual(["🇸🇬", "👍🏽", "👨‍👩‍👧"]);
    expect(emojiIn("abc 123")).toEqual([]);
  });

  it("include every emoji of the palette as itself", () => {
    expect(EMOJI_PALETTE).toHaveLength(24);
    for (const emoji of EMOJI_PALETTE) expect(emojiIn(emoji), emoji).toEqual([emoji]);
  });
});

describe("an emoji choice a browser sends", () => {
  it("is one to three emoji, each once, on one of the seven colours", () => {
    expect(EMOJI_BACKGROUNDS).toHaveLength(7);
    expect(parseEmojiChoice(["🎉"], "#ffd6e0")).toEqual({ emoji: ["🎉"], background: "#ffd6e0" });
    expect(parseEmojiChoice(["🎉", "🎂", "🌈"], "#1f1a2e")).toEqual({ emoji: ["🎉", "🎂", "🌈"], background: "#1f1a2e" });
  });

  it("is refused otherwise", () => {
    for (const [emoji, background] of [
      [[], "#ffd6e0"],
      [["🎉", "🎂", "🌈", "⭐"], "#ffd6e0"],
      [["🎉", "🎉"], "#ffd6e0"],
      [["a"], "#ffd6e0"],
      [["🎉🎂"], "#ffd6e0"],
      [["🎉"], "#123456"],
      ["🎉", "#ffd6e0"],
      [[7], "#ffd6e0"],
    ] as [unknown, unknown][]) {
      expect(parseEmojiChoice(emoji, background), JSON.stringify([emoji, background])).toBeUndefined();
    }
  });
});
