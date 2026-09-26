// The preview card is drawn in the faces it is given and nothing else: it fetches no font and no
// picture for a character they lack (card-fonts.ts). So it writes only what they draw. A space
// they lack (Intl puts a thin one either side of a time range's dash, and a narrow no-break one
// before PM) is written as a plain space. Any other character they lack is left out, an emoji
// with everything that makes it up (its skin tone, its joiners, a keycap's digit), and so is the
// space it leaves behind.
const SPACE = /^\p{Zs}$/u;
// What decorates a character without being drawn itself: joiners and variation selectors.
const INVISIBLE = new Set([0x200d, 0xfe0e, 0xfe0f]);
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function cardText(text: string, canDraw: (codePoint: number) => boolean): string {
  let written = "";
  for (const { segment } of graphemes.segment(text.normalize("NFC"))) {
    const drawn = [...segment].every((character) => INVISIBLE.has(character.codePointAt(0)!) || canDraw(character.codePointAt(0)!));
    if (drawn) written += segment;
    else if (SPACE.test(segment)) written += " ";
  }
  return written.replace(/ {2,}/g, " ").trim();
}
