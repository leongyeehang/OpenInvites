import type { FontKey } from "./theme";

// A title set so large that one of its words is wider than the page breaks that word in two. An
// event's title rarely has such a word, but the home page's title is the instance's name, often
// one word: "OpenInvites" itself, in Bricolage Grotesque at the poster's everyday size, is wider
// than the column on a wide screen. So the home page fits its title: the size steps down until
// the widest word fits the width the title has, and never below a floor, under which a long name
// with no spaces (the 40 characters the name may have) breaks where it must.
//
// The title is drawn before anything is measured, so a word's width is estimated from its letters,
// in ems of the face as the title sets it (fonts.ts: its weight and tracking): a capital or a
// figure, a wide letter (m, w), or any other. The widths are the faces' averages, measured in a
// browser from the files in public/fonts, and the widest letters' widths; the estimate allows a
// little more, so that a word of the wider letters still fits.
const LETTER_EMS: Record<FontKey, { other: number; capital: number; wide: number }> = {
  serif: { other: 0.39, capital: 0.48, wide: 0.69 },
  grotesque: { other: 0.54, capital: 0.64, wide: 0.95 },
  display: { other: 0.9, capital: 1.18, wide: 1.75 },
  rounded: { other: 0.5, capital: 0.64, wide: 0.87 },
};
const ROOM = 1.08;

// Chinese, Japanese and Korean break between any two characters, so each is a word of its own.
const BREAKS_ANYWHERE = /[⺀-鿿가-힯豈-﫿＀-￯]/u;

const WIDE = /[mwMW]/;
const CAPITAL = /[\p{Lu}\p{N}]/u;

export function widestWordEms(title: string, font: FontKey): number {
  const ems = LETTER_EMS[font];
  const words = title
    .split(/\s+/)
    .flatMap((word) => word.split(BREAKS_ANYWHERE))
    .filter((word) => word !== "");
  // A character that breaks anywhere is a word as wide as a square.
  let widest = BREAKS_ANYWHERE.test(title) ? 1 : 0;
  for (const word of words) {
    const width = Array.from(word).reduce((sum, letter) => sum + (WIDE.test(letter) ? ems.wide : CAPITAL.test(letter) ? ems.capital : ems.other), 0);
    widest = Math.max(widest, width * ROOM);
  }
  return Math.round(widest * 100) / 100;
}

// The smallest a fitted title is drawn.
const FLOOR = "1.75rem";
// The title's own margins inside the width it is given (poster-card.tsx: px-5, sm:px-6).
const MARGINS = "3rem";

// The CSS font size of a title fitted to `width` (a CSS length: the poster card's, in container
// units), set inside the heading: its size (1em, the size the heading's class gives it), or less,
// so that its widest word fits, but never below the floor.
export function fittedTitleSize(title: string, font: FontKey, width: string): string {
  return `min(1em, max(${FLOOR}, calc((${width} - ${MARGINS}) / ${widestWordEms(title, font)})))`;
}
