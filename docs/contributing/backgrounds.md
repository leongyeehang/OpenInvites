# The gallery's colours

The colours a host can have as the poster (Golden hour, Dusk, Peach, Ink and the rest) are data: one entry each in `BACKGROUNDS` in [`src/themes/backgrounds.ts`](../../src/themes/backgrounds.ts), and a name for each in the translation files. Each is a CSS gradient the page is painted with. Adding one needs no application code.

The gallery's pictures are posters, not colours, and have a guide of their own: [posters.md](posters.md).

## The shape

```ts
{
  id: "dusk",
  kind: "gradient",
  css: "linear-gradient(160deg, #0f1c4d 0%, #4a2b8c 45%, #d9488a 100%)",
  accent: "#ff8fc0",
  luminance: 0.25,
  lightest: "#795ba1",
  darkest: "#101b49",
},
```

| Field | What it is |
| --- | --- |
| `id` | Stored on every event that shows the colour. Lowercase, and never renamed once shipped: an event whose colour is gone falls back to the first in the list, Golden hour. It is also the key of the colour's name (below), and must not be a gallery poster's id. |
| `kind` | `"gradient"`. |
| `css` | The CSS gradient, painted on a box the size of the screen. |
| `accent` | `#rrggbb`, lowercase: the colour of the buttons and highlights when the host leaves the accent on Auto. Choose one that belongs to the gradient; the legibility tests check that text reads with it. |
| `luminance` | Measured (below): the average lightness, 0 dark to 1 light, to two places. Above 0.6 the automatic text tone is dark, otherwise light. |
| `lightest`, `darkest` | Measured (below), `#rrggbb`: the brightest point light text can meet on the page, and the darkest point dark text can meet. [`legibility.ts`](../../src/themes/legibility.ts) works out from them how much to tint the glass and how far secondary text may fade, so they must be measured, never guessed. |

Add a new colour at the end of the list: the drawer shows them in this order, and the first is the one a theme falls back to.

## Its name, in every language

What the Poster sheet calls a colour is shown in the host's language, so it lives in every file in `messages/`, under `Design.colourNames`, keyed by the `id`:

```json
"colourNames": { "dusk": "Dusk" }
```

A colour's `id` must be one English names, or `backgrounds.ts` does not compile; the translation tests check the other languages ([translations.md](translations.md)).

## Measuring `luminance`, `lightest` and `darkest`

The three are measured on the event page itself, as a guest's browser draws it, by [`scripts/measure-backgrounds.ts`](../../scripts/measure-backgrounds.ts). The comment at the top of `backgrounds.ts` is the definition; the script follows it.

1. Add the entry with its accent and placeholder measurements, `luminance: 0.5, lightest: "#ffffff", darkest: "#000000"`, and its name in every file in `messages/`.
2. Start the app with `pnpm dev` ([README](../../README.md#run-it-locally)), and install Playwright's browser if you have not ([CONTRIBUTING](../../CONTRIBUTING.md#browser-tests)). The script signs up hosts through the product as the browser tests do, so it first opens your development instance to sign-ups, as the browser tests' operator does ([`e2e/operator.setup.ts`](../../e2e/operator.setup.ts)).
3. Measure it, by its `id`, which takes about a minute:

   ```sh
   pnpm measure:backgrounds -g sorbet
   ```

   It prints what it measured above what is stored. For Golden hour, that reads:

   ```
   golden
     measured luminance: 0.3, lightest: "#ffab5f", darkest: "#3b1c55"
     stored   luminance: 0.3, lightest: "#ffab5f", darkest: "#3c1c55"
     the same, to within rounding
   ```

   With the placeholders, the last line says `different: put the measured values in src/themes/backgrounds.ts`.

4. Put the measured values in `backgrounds.ts`, and run `pnpm test`.

What it does: a host publishes an event and picks the colour as the poster in the editor's Poster sheet, and the page a guest is sent is photographed with everything but the backdrop hidden.

- `luminance`: the gradient alone, without the blobs, scrim, fade or grain, on a 390x844 phone: the mean of (0.2126 R + 0.7152 G + 0.0722 B) / 255.
- `lightest`: the backdrop in the light text tone with the White accent (the brightest blob there can be), under a pane with the glass's 24px blur, at 360x740, 390x844, 768x1024, 1280x800 and 1920x1080, with the blobs at rest and at the far end of their drift: the pixel of highest WCAG relative luminance.
- `darkest`: the same in the dark text tone, with each accent a host may pick: the pixel of lowest.

A measurement no more than one step of a channel away from what is stored (or 0.01 of luminance) reads as the same: `legibility.ts` solves a hair above AA to allow for rounding that small.

## When the backdrop changes

A change to what the page paints behind the invitation changes every colour's measurements: the `Backdrop` in [`src/themes/themed-page.tsx`](../../src/themes/themed-page.tsx) (the blobs, the fade at the foot, the grain), the tones' base colours and scrims in `legibility.ts` (`TONES`), or the glass's blur. Run `pnpm measure:backgrounds` with no `-g` (under twenty minutes for all nine) and put in every value it calls different. A change to what is painted behind a picture poster needs `pnpm posters` too ([posters.md](posters.md)).

## Before you send it

Run `pnpm typecheck` and `pnpm test`:

- [`src/themes/backgrounds.test.ts`](../../src/themes/backgrounds.test.ts) checks every field is well formed and that English names exactly the colours that ship. Its first test lists the colours that ship, in order: add the new one.
- [`src/themes/legibility.test.ts`](../../src/themes/legibility.test.ts) checks that every text on the page reads at WCAG AA on every colour, in both text tones, with every accent.
- [`src/locale/translations.test.ts`](../../src/locale/translations.test.ts) checks every language names it.

Then look at it in the drawer, in both text tones and with a few title fonts.
