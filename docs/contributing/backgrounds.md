# Curated backgrounds

The backgrounds a host picks from in the Design drawer are data: one entry each in `BACKGROUNDS` in [`src/themes/backgrounds.ts`](../../src/themes/backgrounds.ts), a name for each in the translation files, and, for a scene, a picture in [`public/backgrounds/`](../../public/backgrounds/). Adding one needs no application code.

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
{ id: "bokeh", kind: "photo", src: "/backgrounds/bokeh.1de98ced.svg", accent: "#ffb26b", luminance: 0.11, lightest: "#9b7c42", darkest: "#474151" },
```

| Field | What it is |
| --- | --- |
| `id` | Stored on every event that wears the background, and named by the templates that use it. Lowercase, and never renamed once shipped: an event whose background is gone falls back to the first in the list, Golden hour. It is also the key of the background's name (below). |
| `kind` | `"gradient"` for a CSS gradient, or `"photo"` for a picture, which the drawer calls a scene. |
| `css` | A gradient only: the CSS gradient, painted on a box the size of the screen. |
| `src` | A scene only: its path under `public/`, `/backgrounds/<name>.<hash>.svg` (below). |
| `accent` | `#rrggbb`, lowercase: the colour of the buttons and highlights when the host leaves the accent on Auto. Choose one that belongs to the picture; the legibility tests check that text reads with it. |
| `luminance` | Measured (below): the average lightness, 0 dark to 1 light, to two places. Above 0.6 the automatic text tone is dark, otherwise light. |
| `lightest`, `darkest` | Measured (below), `#rrggbb`: the brightest point light text can meet on the page, and the darkest point dark text can meet. [`legibility.ts`](../../src/themes/legibility.ts) works out from them how much to tint the glass and how far secondary text may fade, so they must be measured, never guessed. |

Add a new background at the end of the list: the drawer shows them in this order, and the first is the one a theme falls back to.

## Its name, in every language

What the drawer calls a background is shown in the host's language, so it lives in every file in `messages/`, under `DesignDrawer.backgroundNames`, keyed by the `id`:

```json
"backgroundNames": { "dusk": "Dusk" }
```

A background's `id` must be one English names, or `backgrounds.ts` does not compile; the translation tests check the other languages ([translations.md](translations.md)).

## A scene's file

Scenes are SVG files in `public/backgrounds/`, a kilobyte or two each. A browser keeps them for a year without asking again ([`next.config.ts`](../../next.config.ts)), so each file is named after its content: its name, a dot, the first eight hex digits of the SHA-256 of its bytes, and `.svg`.

```sh
f=public/backgrounds/lanterns.svg   # the new scene
mv "$f" "public/backgrounds/lanterns.$(sha256sum "$f" | cut -c1-8).svg"   # macOS: shasum -a 256
```

[`src/themes/public-files.test.ts`](../../src/themes/public-files.test.ts) fails on a file whose name does not match its bytes, and says the name it should have. A scene whose bytes change takes a new name, and its `src` changes with it.

## Measuring `luminance`, `lightest` and `darkest`

The three are measured on the event page itself, as a guest's browser draws it, by [`scripts/measure-backgrounds.ts`](../../scripts/measure-backgrounds.ts). The comment at the top of `backgrounds.ts` is the definition; the script follows it.

1. Add the entry with its accent and placeholder measurements, `luminance: 0.5, lightest: "#ffffff", darkest: "#000000"`, and its name in every file in `messages/`.
2. Start the app with `pnpm dev` ([README](../../README.md#run-it-locally)), and install Playwright's browser if you have not ([CONTRIBUTING](../../CONTRIBUTING.md#browser-tests)). The script signs up hosts through the product as the browser tests do, so it first opens your development instance to sign-ups, as the browser tests' operator does ([`e2e/operator.setup.ts`](../../e2e/operator.setup.ts)).
3. Measure it, by its `id`, which takes about a minute:

   ```sh
   pnpm measure:backgrounds -g lanterns
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

What it does: a host publishes an event and wears the background in the Design drawer, and the page a guest is sent is photographed with everything but the backdrop hidden.

- `luminance`: the gradient or scene alone, without the blobs, scrim, fade or grain, on a 390x844 phone: the mean of (0.2126 R + 0.7152 G + 0.0722 B) / 255.
- `lightest`: the backdrop in the light text tone with the White accent (the brightest blob there can be), under a pane with the glass's 24px blur, at 360x740, 390x844, 768x1024, 1280x800 and 1920x1080, with the blobs at rest and at the far end of their drift: the pixel of highest WCAG relative luminance.
- `darkest`: the same in the dark text tone, with each accent a host may pick: the pixel of lowest.

A measurement no more than one step of a channel away from what is stored (or 0.01 of luminance) reads as the same: `legibility.ts` solves a hair above AA to allow for rounding that small.

## When the backdrop changes

A change to what the page paints behind the invitation changes every background's measurements: the `Backdrop` in [`src/themes/themed-page.tsx`](../../src/themes/themed-page.tsx) (the blobs, the scrim over scenes, the fade at the foot, the grain), the tones' base colours and scrims in `legibility.ts` (`TONES`), or the glass's blur. Run `pnpm measure:backgrounds` with no `-g` (under twenty minutes for all nine) and put in every value it calls different.

## Before you send it

Run `pnpm typecheck` and `pnpm test`:

- [`src/themes/backgrounds.test.ts`](../../src/themes/backgrounds.test.ts) checks every field is well formed, that English names exactly the backgrounds that ship, and that every scene's file is there. Its first test counts the backgrounds that ship: count the new one.
- `src/themes/public-files.test.ts` checks each scene is named after its content.
- [`src/themes/legibility.test.ts`](../../src/themes/legibility.test.ts) checks that every text on the page reads at WCAG AA on every background, in both text tones, with every accent.
- [`src/locale/translations.test.ts`](../../src/locale/translations.test.ts) checks every language names it.

Then look at it in the drawer, in both text tones and under a template or two.
