// An emoji poster (M4 spec, "Emoji posters"): up to three emoji tiled on one of seven colours,
// drawn in the host's browser and uploaded as a picture whose origin is "emoji". The server keeps
// the choice beside the picture, so the Poster sheet can show it again; it checks it as it checks
// anything a browser sends.

// The seven colours an emoji pattern is drawn on.
export const EMOJI_BACKGROUNDS = ["#ffd6e0", "#ffe8a3", "#c8f0d8", "#cfe3ff", "#e3d4ff", "#ff9e7a", "#1f1a2e"] as const;
export type EmojiBackground = (typeof EMOJI_BACKGROUNDS)[number];

// The palette the sheet offers, beside whatever the host types.
export const EMOJI_PALETTE = ["🎉", "🎂", "🎈", "🥳", "🍰", "🎁", "🍾", "🥂", "🍕", "🌮", "🍣", "☕", "🌸", "🌻", "🌈", "⭐", "🌙", "🔥", "💃", "🎶", "🏖️", "⛺", "🎄", "👶"] as const;

export const MAX_EMOJI = 3;

// A pictograph, or a flag, which is a pair of regional indicators.
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// The emoji in what the host typed, in order, each once, at most three: whole graphemes with a
// pictograph in them, so a flag, a skin tone or a family stays one, and letters are left out.
export function emojiIn(typed: string): string[] {
  const found: string[] = [];
  for (const { segment } of segmenter.segment(typed)) {
    if (!PICTOGRAPHIC.test(segment) || found.includes(segment)) continue;
    found.push(segment);
    if (found.length === MAX_EMOJI) break;
  }
  return found;
}

export type EmojiChoice = { emoji: string[]; background: EmojiBackground };

// A choice as a browser sent it: one to three emoji, each one, and one of the seven colours.
export function parseEmojiChoice(emoji: unknown, background: unknown): EmojiChoice | undefined {
  if (!Array.isArray(emoji) || emoji.length < 1 || emoji.length > MAX_EMOJI) return undefined;
  if (!emoji.every((each) => typeof each === "string" && emojiIn(each).length === 1 && emojiIn(each)[0] === each)) return undefined;
  if (new Set(emoji).size !== emoji.length) return undefined;
  const colour = EMOJI_BACKGROUNDS.find((each) => each === background);
  return colour ? { emoji: emoji as string[], background: colour } : undefined;
}
