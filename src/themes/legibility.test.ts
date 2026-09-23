import { describe, expect, it } from "vitest";
import { BACKGROUNDS } from "./backgrounds";
import { AA, contrast, hexToRgb, over, SURFACES, toneTokens, worstBackdrop, type Rgb, type Rgba, type Tone } from "./legibility";
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

// Nothing the Design drawer offers can make the page unreadable (spec, story 44): every
// background, in both text tones, with every accent, and so every button style.
describe("every combination the drawer offers", () => {
  for (const background of BACKGROUNDS) {
    for (const tone of TONES) {
      it(`reads at AA on ${background.name} in the ${tone} tone`, () => {
        for (const accent of ACCENTS) {
          const tokens = toneTokens(tone, background, accent);
          const behind = worstBackdrop(tone, background);
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
        }
      });
    }
  }
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
