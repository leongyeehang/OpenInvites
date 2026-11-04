# Gallery posters

A gallery poster is a ready-made picture a host can have at the top of their invitation instead of a photo of their own. Picking one also applies its look: the title's font and where it sits, the effect, and the RSVP buttons' style, with the poster's own accent. The host may change any of that afterwards.

A poster is three things:

- **Its drawing**, in code, in [`scripts/posters/art.ts`](../../scripts/posters/art.ts).
- **Its entry** in [`src/themes/posters.ts`](../../src/themes/posters.ts): its occasion, accent and look.
- **Its name** in every file in `messages/`.

`pnpm posters` builds the files the page serves from the drawings and measures them. Adding a poster needs no application code.

The gallery's colours (Golden hour, Dusk and the rest) are not posters in this sense. They are CSS gradients, described in [backgrounds.md](backgrounds.md).

## Drawing one

Every poster is an SVG of 1200 by 1500 pixels (4:5), written by a function in `art.ts` with the helpers in [`scripts/posters/svg.ts`](../../scripts/posters/svg.ts): gradients, shapes, groups, a seeded random source and the grain.

```ts
function lanterns() {
  const r = rng("lanterns"); // seeded by the id, so the poster draws the same every time
  const defs = linear("sky", [
    [0, "#0b1433"],
    [1, "#3a1f4f"],
  ]);
  let body = rect("url(#sky)");
  for (let i = 0; i < 9; i++) body += circle(r() * W, r() * H * 0.6, 40 + r() * 30, "#ffb347");
  return poster(defs, body); // adds the grain, and wraps it in the <svg>
}
```

Then list it in `ART`, at the end of `art.ts`, with its id and the name its files take (`file`, named after what it shows):

```ts
{ id: "lanterns", file: "paper-lanterns", draw: lanterns },
```

The rules, which the build and [`posters.test.ts`](../../src/themes/posters.test.ts) check:

- **No text.** The title is the page's, set in the host's chosen font, on the poster or under it.
- **Nothing outside the file.** No images, fonts or links: `url(#…)` to its own definitions only.
- **60 KB at most.** It arrives with the page. A few hundred shapes is plenty; use patterns for repeats.
- **The grain** comes from `poster()`, as an SVG filter. Keep it.

Draw for both places the title can go. With the title **on** the poster, the bottom third sits under a frosted shade, so keep the subject above it. With the title **below**, the whole poster shows.

## Its entry

Add it to `ENTRIES` in `posters.ts`, next to the others of its occasion. The gallery shows them in this order, occasion by occasion:

```ts
{ id: "lanterns", occasion: "holiday", accent: "#ffb347", look: { font: "serif", titlePlacement: "below", effect: "sparkles", buttonStyle: "glass" } },
```

| Field | What it is |
| --- | --- |
| `id` | Stored on every event that shows the poster, so never renamed once shipped: an event whose poster is gone shows Golden hour. It is also the key of the poster's name (below). It must not be a colour's id. |
| `occasion` | One of `OCCASIONS` in `posters.ts`: `birthday`, `dinner`, `wedding`, `kids`, `nightOut`, `outdoors`, `holiday`, or `anyOccasion`. |
| `accent` | `#rrggbb`, lowercase: the buttons and highlights while the host leaves the accent on Auto. Choose a colour from the poster. The legibility tests check that text reads with it. |
| `look.font` | `"serif"`, `"grotesque"`, `"display"` or `"rounded"` (the faces are in [`src/themes/fonts.ts`](../../src/themes/fonts.ts)). |
| `look.titlePlacement` | `"on"`, at the poster's foot over a frosted shade, or `"below"` it. |
| `look.effect` | `"none"`, `"confetti"`, `"sparkles"` or `"doodles"`. Nothing moves for a guest who asks for reduced motion. |
| `look.buttonStyle` | `"glass"`, `"solid"` or `"outline"`. |

A look never sets the layout or the text tone: those stay the host's. Its files and measurements are not written here. `pnpm posters` writes them to [`src/themes/poster-files.ts`](../../src/themes/poster-files.ts), which `posters.ts` reads.

## Its name, in every language

Every file in `messages/` (`en.json`, `zh-Hans.json`, `zh-Hant.json`, and any language added later) names it under `Posters.names`, keyed by its `id`:

```json
"Posters": { "names": { "lanterns": "Lanterns" } }
```

The id must be one English names, or `posters.ts` does not compile. If you cannot write one of the languages, say so in the pull request and ask for help: the translation tests fail until every language has it ([translations.md](translations.md)). A new occasion needs a name under `Posters.occasions` too.

## Building and measuring it

```sh
pnpm posters
```

It needs no app running, only Playwright's browser ([CONTRIBUTING](../../CONTRIBUTING.md#browser-tests)), and takes a couple of minutes for the whole gallery. For each poster it:

1. writes the SVG to `public/posters/`, named after its content (`<file>.<hash>.svg`), since browsers keep it for a year;
2. draws it in Chromium at 1200 by 1500, as a guest's browser does, and writes that drawing as a JPEG (`<file>.<hash>.jpg`) for the link's preview card, since the card's renderer cannot draw SVG backgrounds reliably;
3. measures the drawing with the code that measures a host's upload ([`src/uploads/process.ts`](../../src/uploads/process.ts)), and writes the small copy the page blurs behind the poster (`<file>-copy.<hash>.webp`).

What it measured goes to `poster-files.ts`: the average luminance, which decides the automatic text tone, and the lightest and darkest points of the blurred copy as text on the page meets them, which [`legibility.ts`](../../src/themes/legibility.ts) solves the glass against. Files no poster names any more are removed. Commit everything it changed.

Run it again whenever a drawing changes, or the page's backdrop behind a poster does ([`themed-page.tsx`](../../src/themes/themed-page.tsx)). The drawing's bytes change its file names, so the old ones are removed and the new ones are named in `poster-files.ts`.

## Before you send it

Run `pnpm typecheck` and `pnpm test`:

- **The poster tests** ([`src/themes/posters.test.ts`](../../src/themes/posters.test.ts)): every poster has its drawing, its files, its name, a measured pair and a look the drawer can show; the SVG follows the rules above. Its first test counts the posters that ship: count the new one.
- **The file names** ([`src/themes/public-files.test.ts`](../../src/themes/public-files.test.ts)): each file in `public/posters/` is named after its content.
- **The legibility tests** ([`src/themes/legibility.test.ts`](../../src/themes/legibility.test.ts), "every gallery poster"): every text on the page reads at WCAG AA over the poster's measured copy, in both text tones, with its accent and every swatch.
- **The translation tests** ([`src/locale/translations.test.ts`](../../src/locale/translations.test.ts)): every language names it.

Then look at it (`pnpm dev`, then an event's Poster sheet in the editor) with the title on it and below it, at phone width and on a desktop. The tests prove it is readable, not that it is lovely.

## Licence

The posters are part of OpenInvites and licensed as it is, under the AGPL-3.0 ([`public/posters/README.md`](../../public/posters/README.md)). Only add a drawing you made, or one whose author agrees to that licence.
