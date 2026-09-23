import { describe, expect, it } from "vitest";
import { BACKGROUNDS } from "./backgrounds";
import {
  AA,
  contrast,
  hexToRgb,
  over,
  POSTER_SURFACES,
  SHEET_SURFACES,
  SURFACES,
  TONES as TONE_COLOURS,
  toneTokens,
  worstBackdrop,
  type Backdrop,
  type Rgb,
  type Rgba,
  type Tone,
} from "./legibility";
import { SWATCHES } from "./swatches";

const TONES: Tone[] = ["light", "dark"];

// Every accent a page can wear today: each background's own, and the six swatches.
const ACCENTS = [...new Set([...BACKGROUNDS.map((background) => background.accent), ...SWATCHES.map((swatch) => swatch.hex)])];

const stack = (layers: Rgba[], below: Rgb): Rgb => layers.reduce<Rgb>((colour, layer) => over(layer, colour), below);
const ink = (colour: Rgb | Rgba, on: Rgb): Rgb => (colour.length === 4 ? over(colour, on) : colour);

describe("contrast", () => {
  it("is WCAG 2's ratio", () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([255, 255, 255], [255, 255, 255])).toBe(1);
    // #767676 on white is the classic grey that just reaches AA.
    expect(contrast(hexToRgb("#767676"), [255, 255, 255])).toBeCloseTo(4.54, 2);
  });
});

describe("text on the accent", () => {
  it("is dark plum on a light accent and white on a dark one", () => {
    expect(toneTokens("light", BACKGROUNDS[0], "#ffc36b").onAccent).toEqual(hexToRgb("#2a1540"));
    expect(toneTokens("light", BACKGROUNDS[0], "#3a1b5c").onAccent).toEqual([255, 255, 255]);
  });

  it("falls back to black or white on a mid-tone accent where neither reads", () => {
    const grey = toneTokens("light", BACKGROUNDS[0], "#808080").onAccent;
    expect(contrast(grey, hexToRgb("#808080"))).toBeGreaterThanOrEqual(AA);
  });

  it("reads on a solid accent button for any accent at all, not only the ones offered today", () => {
    // Solid buttons, the chosen answer, the send button and the avatars are all opaque accent.
    for (let value = 0; value <= 255; value += 5) {
      for (const accent of [`#${hex(value)}${hex(255 - value)}80`, `#${hex(value)}${hex(value)}${hex(value)}`, `#${hex(255 - value)}40${hex(value)}`]) {
        const { onAccent } = toneTokens("light", BACKGROUNDS[0], accent);
        expect(contrast(onAccent, hexToRgb(accent)), accent).toBeGreaterThanOrEqual(AA);
      }
    }
    for (const accent of ACCENTS) expect(contrast(toneTokens("dark", BACKGROUNDS[0], accent).onAccent, hexToRgb(accent)), accent).toBeGreaterThanOrEqual(AA);
  });
});

// All text on every surface of the Poster layout, the RSVP sheet and the title on a poster reads
// at AA, on this backdrop in this tone with this accent.
function expectEveryTextReads(tone: Tone, backdrop: Backdrop, accent: string, use: "background" | "poster" = "background") {
  const tokens = toneTokens(tone, backdrop, accent, use);
  const behind = worstBackdrop(tone, backdrop);
  // Body text in its three strengths, the label of a glass button (strong glass) or an
  // outline button (the page's veil), which is the tone's own text, and the accent as text.
  for (const [surface, { layers, carries }] of Object.entries(SURFACES(tokens))) {
    const colour = stack(layers, behind);
    const label = `${accent} accent, on ${surface}`;
    if (carries === "accent") {
      expect(contrast(tokens.accentInk, colour), `accent ink, ${label}`).toBeGreaterThanOrEqual(AA);
      continue;
    }
    expect(contrast(tokens.text, colour), `text, ${label}`).toBeGreaterThanOrEqual(AA);
    if (carries === "full strength") continue;
    expect(contrast(ink(tokens.textMuted, colour), colour), `muted, ${label}`).toBeGreaterThanOrEqual(AA);
    expect(contrast(ink(tokens.textFaint, colour), colour), `faint, ${label}`).toBeGreaterThanOrEqual(AA);
  }
  // The RSVP sheet, which carries its own secondary strengths and accent ink.
  const { sheet } = tokens;
  for (const [surface, { layers, carries }] of Object.entries(SHEET_SURFACES(tone, tokens))) {
    const colour = stack(layers, behind);
    const label = `${accent} accent, on ${surface}`;
    if (carries === "accent") {
      expect(contrast(sheet.accentInk, colour), `accent ink, ${label}`).toBeGreaterThanOrEqual(AA);
      continue;
    }
    expect(contrast(tokens.text, colour), `text, ${label}`).toBeGreaterThanOrEqual(AA);
    if (carries === "full strength") continue;
    expect(contrast(ink(sheet.textMuted, colour), colour), `muted, ${label}`).toBeGreaterThanOrEqual(AA);
    expect(contrast(ink(sheet.textFaint, colour), colour), `faint, ${label}`).toBeGreaterThanOrEqual(AA);
  }
  // The title on the poster, over its scrim, which carries its own secondary strengths.
  const { titleOnPoster } = tokens;
  for (const [surface, { layers }] of Object.entries(POSTER_SURFACES(tone, tokens))) {
    const colour = stack(layers, behind);
    const label = `${accent} accent, on ${surface}`;
    expect(contrast(tokens.text, colour), `text, ${label}`).toBeGreaterThanOrEqual(AA);
    expect(contrast(ink(titleOnPoster.textMuted, colour), colour), `muted, ${label}`).toBeGreaterThanOrEqual(AA);
    expect(contrast(ink(titleOnPoster.textFaint, colour), colour), `faint, ${label}`).toBeGreaterThanOrEqual(AA);
  }
}

// Nothing the Design drawer offers can make the page unreadable (spec, story 44): every
// background, in both text tones, with every accent, and so every button style.
describe("every combination the drawer offers", () => {
  for (const background of BACKGROUNDS) {
    for (const tone of TONES) {
      it(`reads at AA on ${background.name} in the ${tone} tone`, () => {
        for (const accent of ACCENTS) expectEveryTextReads(tone, background, accent);
      });
    }
  }
});

// A host's upload can be any picture, measured by the server (uploads/sample.ts), with any
// accent sampled from it: from a black picture to a white one, under each tone's scrim.
describe("an upload", () => {
  const grey = (value: number) => `#${value.toString(16).padStart(2, "0").repeat(3)}`;
  const UPLOAD_ACCENTS = [...ACCENTS, "#b3b3b3", "#4d6b8a", "#c97a2e", "#1f3a1f", "#e8d0ff"];
  for (const tone of TONES) {
    it(`reads at AA in the ${tone} tone however bright or dark the picture is`, () => {
      for (let value = 0; value <= 255; value += 15) {
        // The light tone meets the picture's brightest point under its 25% black scrim, and the
        // dark tone its darkest under 25% white.
        const backdrop = { lightest: grey(Math.round(value * 0.75)), darkest: grey(Math.round(value * 0.75 + 63.75)) };
        for (const accent of UPLOAD_ACCENTS) expectEveryTextReads(tone, backdrop, accent);
      }
    });
  }
});

// In poster mode the host's picture is the invitation itself, and the page behind it is a
// blurred copy of it under a stronger scrim, measured by the server as the picture is
// (uploads/sample.ts), so it too can be anything from black to white.
describe("a poster", () => {
  const grey = (value: number) => `#${value.toString(16).padStart(2, "0").repeat(3)}`;
  const UPLOAD_ACCENTS = [...ACCENTS, "#b3b3b3", "#4d6b8a", "#c97a2e", "#1f3a1f", "#e8d0ff"];
  for (const tone of TONES) {
    it(`reads at AA in the ${tone} tone on the page behind it however bright or dark the poster is`, () => {
      for (let value = 0; value <= 255; value += 15) {
        // The light tone meets the blurred copy's brightest point under its 45% black scrim, and
        // the dark tone its darkest under 45% white.
        const backdrop = { lightest: grey(Math.round(value * 0.55)), darkest: grey(Math.round(value * 0.55 + 114.75)) };
        for (const accent of UPLOAD_ACCENTS) expectEveryTextReads(tone, backdrop, accent, "poster");
      }
    });
  }

  it("darkens the copy behind a poster under light text and lightens it under dark, more than a background's", () => {
    for (const tone of TONES) {
      const { scrim, posterScrim } = TONE_COLOURS[tone];
      expect(toneTokens(tone, BACKGROUNDS[0], "#ffc36b", "poster").scrim, tone).toEqual(posterScrim);
      expect(toneTokens(tone, BACKGROUNDS[0], "#ffc36b").scrim, tone).toEqual(scrim);
      expect(posterScrim.slice(0, 3), tone).toEqual(scrim.slice(0, 3));
      expect(posterScrim[3], tone).toBeGreaterThan(scrim[3]);
    }
  });
});

// With the title on the poster, what is under it is whatever the host's poster holds there: any
// colour at all. The scrim is solved against all of them, not sampled from the picture.
describe("the title on the poster", () => {
  const LEVELS = [0, 64, 128, 192, 255];
  const UNDER: Rgb[] = LEVELS.flatMap((r) => LEVELS.flatMap((g) => LEVELS.map((b): Rgb => [r, g, b])));

  for (const tone of TONES) {
    it(`reads at AA in the ${tone} tone over any colour the poster holds under it`, () => {
      for (const background of BACKGROUNDS) {
        const { text, titleOnPoster } = toneTokens(tone, background, background.accent, "poster");
        for (const under of UNDER) {
          const colour = over(titleOnPoster.scrim, under);
          const label = `${background.name}, over ${under}`;
          expect(contrast(text, colour), `title, ${label}`).toBeGreaterThanOrEqual(AA);
          expect(contrast(ink(titleOnPoster.textMuted, colour), colour), `muted, ${label}`).toBeGreaterThanOrEqual(AA);
          expect(contrast(ink(titleOnPoster.textFaint, colour), colour), `faint, ${label}`).toBeGreaterThanOrEqual(AA);
        }
      }
    });
  }

  it("is a shade of the tone over the poster, never a solid bar, whatever the page behind it", () => {
    for (const tone of TONES) {
      const scrims = BACKGROUNDS.map((background) => toneTokens(tone, background, background.accent, "poster").titleOnPoster.scrim);
      for (const scrim of scrims) expect(scrim).toEqual(scrims[0]);
      expect(scrims[0].slice(0, 3), tone).toEqual([...TONE_COLOURS[tone].shade]);
      expect(scrims[0][3], tone).toBeGreaterThan(0);
      expect(scrims[0][3], tone).toBeLessThanOrEqual(0.9);
    }
  });

  it("keeps a hierarchy: secondary text on it is never closer than 80% to full strength", () => {
    for (const tone of TONES) {
      const { titleOnPoster } = toneTokens(tone, BACKGROUNDS[0], BACKGROUNDS[0].accent, "poster");
      expect(titleOnPoster.textMuted[3], tone).toBeLessThanOrEqual(0.8);
      expect(titleOnPoster.textFaint[3], tone).toBeLessThanOrEqual(0.8);
    }
  });
});

// The RSVP sheet rises over the page itself, so what is behind it is not the backdrop but
// whatever part of the invitation it covers: cards, text, a button filled with the accent.
describe("the RSVP sheet", () => {
  const WHITE: Rgb = [255, 255, 255];
  const BLACK: Rgb = [0, 0, 0];

  it("reads over anything it rises over, from white to black, on every background in both tones", () => {
    for (const background of BACKGROUNDS) {
      for (const tone of TONES) {
        for (const accent of ACCENTS) {
          const { text, glass, glassStrong, sheet } = toneTokens(tone, background, accent);
          for (const behind of [WHITE, BLACK, worstBackdrop(tone, background)]) {
            const label = `${background.name}, ${tone} tone, ${accent} accent, over ${behind}`;
            // The sheet itself, a field or chip on it, and the copy button on the edit link's pill.
            const [bare, inset, insetButton] = [[sheet.tint], [sheet.tint, glassStrong], [sheet.tint, glassStrong, glass]].map((layers) => stack(layers, behind));
            for (const colour of [bare, inset]) {
              expect(contrast(text, colour), `text, ${label}`).toBeGreaterThanOrEqual(AA);
              expect(contrast(ink(sheet.textMuted, colour), colour), `muted, ${label}`).toBeGreaterThanOrEqual(AA);
              expect(contrast(ink(sheet.textFaint, colour), colour), `faint, ${label}`).toBeGreaterThanOrEqual(AA);
            }
            expect(contrast(text, insetButton), `button label, ${label}`).toBeGreaterThanOrEqual(AA);
            expect(contrast(sheet.accentInk, bare), `accent ink, ${label}`).toBeGreaterThanOrEqual(AA);
          }
        }
      }
    }
  });

  it("is frosted, not solid: some of the invitation always shows through it", () => {
    for (const background of BACKGROUNDS) {
      for (const tone of TONES) {
        for (const accent of ACCENTS) {
          const alpha = toneTokens(tone, background, accent).sheet.tint[3];
          expect(alpha, `${background.name}, ${tone} tone, ${accent} accent`).toBeGreaterThan(0);
          expect(alpha, `${background.name}, ${tone} tone, ${accent} accent`).toBeLessThanOrEqual(0.9);
        }
      }
    }
  });

  it("keeps a hierarchy: secondary text on it is never closer than 80% to full strength", () => {
    for (const background of BACKGROUNDS) {
      for (const tone of TONES) {
        for (const accent of ACCENTS) {
          const { sheet } = toneTokens(tone, background, accent);
          expect(sheet.textMuted[3], `${background.name}, ${tone} tone, ${accent} accent`).toBeLessThanOrEqual(0.8);
          expect(sheet.textFaint[3], `${background.name}, ${tone} tone, ${accent} accent`).toBeLessThanOrEqual(0.8);
        }
      }
    }
  });

  it("keeps its own text strengths and accent ink, and leaves the page's alone", () => {
    // On a page dark enough that secondary text keeps its lightest strength, the sheet, which
    // must also read over white, needs its secondary text stronger; the page's stays as it was.
    const tokens = toneTokens("light", { lightest: "#101014", darkest: "#000000" }, "#ffc36b");
    expect(tokens.textMuted[3]).toBe(0.75);
    expect(tokens.accentInk).toEqual(hexToRgb("#ffc36b"));
    expect(tokens.sheet.textMuted[3]).toBeGreaterThan(tokens.textMuted[3]);
  });
});

describe("the settled look", () => {
  it("is left alone where it already reads: on a dark enough page the frost stays a light 10% white", () => {
    const tokens = toneTokens("light", { lightest: "#101014", darkest: "#000000" }, "#ffc36b");
    expect(tokens.glass).toEqual([255, 255, 255, 0.1]);
    expect(tokens.glassStrong).toEqual([255, 255, 255, 0.14]);
    expect(tokens.veil[3]).toBe(0);
    expect(tokens.textMuted[3]).toBe(0.75);
  });

  it("darkens the frost on Golden hour only as far as its brightest point needs", () => {
    const golden = BACKGROUNDS.find((background) => background.id === "golden")!;
    const tokens = toneTokens("light", golden, golden.accent);
    expect(tokens.glass[3]).toBeGreaterThan(0.1);
    // What decides the tint is secondary text at its strongest (80%) on the lightest glass: it
    // reads, and only just.
    const closest = Math.min(
      ...[[tokens.glass], [tokens.glassStrong], [tokens.glass, tokens.glassStrong]].map((layers) => {
        const colour = stack(layers, worstBackdrop("light", golden));
        return contrast(ink([...tokens.text, 0.8], colour), colour);
      }),
    );
    expect(closest).toBeGreaterThanOrEqual(AA);
    expect(closest).toBeLessThan(AA + 0.3);
  });

  it("keeps the accent's own colour as text where it already reads", () => {
    const slate = BACKGROUNDS.find((background) => background.id === "slate")!;
    expect(toneTokens("light", slate, "#ffc36b").accentInk).toEqual(hexToRgb("#ffc36b"));
  });
});

function hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}
