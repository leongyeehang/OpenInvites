# Task 14 report: backgrounds from the host's picture

**Status:** DONE_WITH_CONCERNS (all boxes ticked; the concerns are about the ticket's values and a pre-existing exposure, not unfinished work)

**Commit:** `5894497` Design drawer: two backgrounds made from the host's picture, a soft blur and a colour wash

## What I implemented

- **`src/themes/derived.ts`** (new, beside `derived.test.ts`):
  - `DERIVED_BACKGROUND_IDS = ["upload-blur", "upload-wash"] as const`, `DerivedBackgroundId`, and `isDerivedBackground(id)`.
  - `derivedBackground(id, upload)`:
    - Soft blur is `{ id, kind: "photo", src: poster.copySrc, accent, luminance, lightest: poster.lightest, darkest: poster.darkest, blurred: true }`.
    - Colour wash is a gradient, `linear-gradient(135deg, {darkest}, {accent}, {lightest})`. Its luminance is the mean of the stops' WCAG relative luminances (the `luminance` in `legibility.ts`), and its lightest and darkest are the stops with the highest and lowest of them.
  - `derivedUpload(upload, id)`: what a guest is sent (see Decisions).
- **`backgrounds.ts`**: the photo kind of `Background` gains `blurred?: boolean`. `findBackground` is unchanged and returns curated backgrounds only.
- **`resolve.ts`**:
  - A derived id resolves through `derivedBackground` while there is an upload; without one it falls back to the default background.
  - The picture is put aside: `upload` and `poster` are null.
  - `toneTokens` uses `"poster"` whenever the background is blurred, so Soft blur wears the poster scrim its extremes were measured under.
  - `uploadedBackground` sets `blurred: true` for the poster's copy.
- **`changes.ts`**:
  - `parseThemeChange` accepts derived ids only when `upload !== null`.
  - An `uploadId` change while on a derived background keeps `backgroundId` and clears `accentOverride`.
  - Choosing a derived tile goes through the generic background path, which clears the accent.
- **`themed-page.tsx`**: the backdrop paints the blurred branch whenever `background.blurred` is set, the poster case included. The root gains `data-slot="backdrop"`.
- **`thread-card.tsx`**: under Soft blur, the card's 4:3 frame paints the copy at `-inset-32` with `blur-3xl`, clipped to the frame. The Broadsheet title and the Poster card paint only a poster, never the background, so they needed nothing.
- **`design-panel.tsx`**: only when there is an upload, after the gallery grid comes a `role="group"` labelled by a small "From your picture" line, holding two `Choice` tiles in the same `background` radio group:
  - "Soft blur" is the copy under `blur-md`.
  - "Colour wash" is the gradient.

  Both are painted from `derivedBackground`, so each tile matches the page.
- **`page.tsx`**: a guest on a derived background is sent `derivedUpload(...)` instead of nothing. Without it, the guest's page would have fallen back to Golden hour.
- **Preview card**:
  - The wash is a gradient, which the card already draws.
  - Under Soft blur, the route blurs the picture's existing `card` rendition with sharp (sigma 64, matching the page's blur-3xl) through `blurredForCard`, then Satori draws it under the usual shade.
- **Messages** (en, zh-Hans, zh-Hant): `DesignDrawer.fromYourPicture` and `DesignDrawer.derivedNames.{upload-blur, upload-wash}`.
- **Browser tests** (two new tests in `e2e/uploads.spec.ts`):
  - Poster: no tiles without an upload, both after one; each paints the page and its tile matches (computed `background-image` and `filter` compared); a guest sees each and is sent no file of the picture except the blur's copy; a new picture while on the wash keeps it; the preview card answers 200 as PNG for each.
  - Thread then Broadsheet: each derived background is painted, the Thread card included (the copy blurred at `blur(64px)` inside the card).

## Decisions beyond the rulings

1. **Guests under a derived background.** `page.tsx` sent the upload only while `resolved.upload` was set, so a guest's client-side `resolveTheme` would have painted Golden hour. Guests are now sent `derivedUpload`: the sampled colours and, for the blur, the copy's src. The picture's sources, its description and the upload's id are left empty. This keeps the M1 rule ("put aside, it is the host's alone"; `uploads.spec.ts` checks the page names no file of it). It is unit-tested and covered by the browser test.
2. **A new upload under a derived background clears `accentOverride`**, as any picture newly in use does in the existing rule.
3. **No `theme.uploadId === upload.id` check for derived backgrounds.** They are made from the event's upload, whichever it is ("when the upload is present").
4. **Preview card blur by sharp, not Satori.** Satori does render `filter: blur()`, but librsvg blurs only what is on its canvas, so the card's edges faded into its backdrop. I measured this on a stripe picture: the corner kept 28/255 of its colour and the middle of an edge 85/255, even with a 256 px overhang. A sharp blur of the existing card rendition takes about 55 ms and keeps the edges full. No rendition is added or stored. If the reviewer reads "no new image processing" as ruling this out, the fallback is one line: draw the card rendition unblurred (or let Satori blur it, with the faded edges).
5. **The empty Soft blur tile span has no `aria-hidden`.** An existing test finds the drawer's thumbnail with `span[aria-hidden][style*="/uploads/"]`; my tile would have made that ambiguous, and an empty span says nothing to a screen reader anyway.

## Tests and results

- **RED** (`pnpm exec vitest run src/themes/derived.test.ts src/themes/resolve.test.ts src/themes/changes.test.ts`):
  ```
  FAIL  src/themes/derived.test.ts
  Error: Cannot find module './derived' imported from /home/leong/rsvp/src/themes/derived.test.ts
  FAIL  changes.test.ts > ... > stays when the picture is replaced, so the new picture's blur or wash shows, with its own accent
  FAIL  changes.test.ts > ... > accepts a background made from the event's upload only when it has one
        AssertionError: expected undefined to deeply equal { knob: 'backgroundId', …(1) }
  FAIL  resolve.test.ts > ... > paints Soft blur ... (received id 'golden')
  FAIL  resolve.test.ts > ... > paints Colour wash ... (received id 'golden')
  FAIL  resolve.test.ts > ... > takes the accent ... expected '#ffc36b' to be '#3aa885'
  Test Files  3 failed (3)   Tests  5 failed | 59 passed (64)
  ```
- **GREEN**, same command: `Test Files 3 passed (3)  Tests 70 passed (70)`. `pnpm exec vitest run src/themes`: 10 files, 159 passed.
- **Final checks:** `pnpm lint` clean, `pnpm typecheck` clean (after `rm -f tsconfig.tsbuildinfo`), `pnpm test` 64 files and 525 passed. Vite's `configLoader` notice about `vitest.config.ts` prints on every run, the RED one before any change included, so it predates this task.
- **Browser, production-build loop** for every run (`pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000, with `public`, `.next/static` and `drizzle/` copied in and the Compose dev profile up), `--workers=2 --grep-invert operator`:
  - The new tests: 5 passed (both widths plus the operator setup).
  - Mutation checks, each on its own build and restored:
    - Guests sent no upload: the Poster test fails, with the guest's backdrop on Golden hour's radial gradient.
    - No `blur-3xl` in the Thread card: the layouts test fails with `filter: none`.
    - The backdrop blurring only behind a poster: both tests fail.
    - The keep-on-new-upload rule disabled: the Poster test fails after the replace, with the backdrop's first layer `none`, not a wash.
  - Full list (design, uploads, poster, theme, sharing, broadsheet, thread, effects): **85 passed in 4.4 min**. No failures, so no `--workers=1` rerun was needed.
  - A throwaway screenshot spec (deleted) confirmed the drawer row, the Thread card and the backdrop under each tile at both widths, and both preview cards.
  - Port 3000 stopped; the copied `drizzle/` removed from `.next/standalone`.

## Files changed

- New: `src/themes/derived.ts`, `src/themes/derived.test.ts`
- Changed:
  - `src/themes/backgrounds.ts`, `resolve.ts`, `resolve.test.ts`, `changes.ts`, `changes.test.ts`, `legibility.ts` (a comment only), `themed-page.tsx`, `thread-card.tsx`
  - `src/app/e/[slug]/design-panel.tsx`, `page.tsx`, `preview.png/route.tsx`
  - `src/sharing/preview-card.tsx`
  - `messages/en.json`, `zh-Hans.json`, `zh-Hant.json`
  - `e2e/uploads.spec.ts`
- Ticket (updated, not staged): `.scratch/m2-social/issues/14-derived-backgrounds.md`

## Self-review findings

- **Fixed:** `Array.prototype.toSorted` became `[...stops].sort(...)`, since the target is ES2017.
- **Fixed:** the Soft blur tile's span would have matched the existing thumbnail locator. I dropped its `aria-hidden` rather than change that test.
- **Fixed:** the ticket comment no longer claims an untested duplicate behaviour.
- **Checked:** no mutation was left in the tree; staging was by path only; `CONTEXT.md` and `.scratch/` were not staged.
- **Considered and kept:** `derivedUpload` blanks the upload's id although the theme sent to guests already carries `uploadId` (see Concerns). It keeps the object down to what is painted and costs nothing.

## Concerns

1. **The wash's luminance scale.** The ruling's value is the mean of WCAG relative luminances, while the automatic text tone's 0.6 line was set on a gamma-weighted brightness (curated and sampled luminance). So the wash leans to light text. The tests' pale garden photo gets dark text as the picture and as Soft blur, but light text over smoked glass on its wash. It is legible, because `toneTokens` solves against the stops, but it is unlike Auto on the picture itself.
2. **The wash's direction on light pictures.** The sample's `lightest` and `darkest` are measured under opposite scrims, so on a light picture the stop named "darkest" is the lighter one. The wash runs light, through the accent, to grey. The extremes are chosen by luminance, so legibility holds.
3. **Pre-existing exposure.** The theme every guest is sent carries `uploadId`, and upload files are served by id, so a put-aside picture's files can be reached by anyone who knows the URL pattern. Soft blur's copy URL holds the same id. The page names no other file, as before.
4. **The preview card's sharp blur** (Decision 4) may be read against "no new image processing". It is easy to swap if so.
5. **Glossary:** `CONTEXT.md` says a Background is "chosen from the curated gallery or uploaded by the host". The maintainer may want "or made from the host's upload". I did not edit it.

---

## Fix report, round 1 (2026-10-08)

**Status:** DONE (with one observation, below)

**Commit:** `ff39611` Design drawer: a pale picture's colour wash wears dark text, measured as every background is (a new commit; `5894497` was not amended)

### What changed

- **`src/themes/legibility.ts`**: new `luma([r, g, b])`, the encoded-channel luma `(0.2126 R + 0.7152 G + 0.0722 B) / 255`, beside `luminance`. It is the one copy of the formula the app uses.
- **`src/uploads/sample.ts`**: `sampleColours` now calls `luma` rather than holding the formula inline. The value is unchanged, and `sample.test.ts` passes.
- **`src/themes/derived.ts`**: the wash's stops are measured with `luma`, both for the mean (`luminance`) and to pick `lightest` and `darkest`. The comment says it is measured as every background is.
- **`src/themes/derived.test.ts`**:
  - The fixture is now a sample the sampler can produce: the lantern and night-blue ground under the 25% scrims (`lightest` `#b89151` ≤ 0xbf, `darkest` `#565a70` ≥ 0x40), and the poster copy under the 45% ones (`#6e583e` ≤ 0x8c, `#838696` ≥ 0x73). The comment now says how the values arise.
  - The known-sample test expects `linear-gradient(135deg, #565a70, #f6c571, #b89151)`, luminance 0.58, lightest the accent, darkest the ground.
  - The extremes test now expects 0.36.
- **`src/themes/resolve.test.ts`**: the reviewer's two cases, a white picture (`#ffffff` / `#737373` / `#bfbfbf`, 0.73) and near-white with a coloured accent (`#e1dcd6` / `#b8653a` / `#bfbfbf`, 0.69). Each wash gets dark text under Auto, as each picture does. They replace my earlier unrealistic sample (`lightest: "#ffffff"`).
- **`e2e/uploads.spec.ts`**: after the pale garden replaces the dark photo on Colour wash, the host's page and the guest's page both have `data-tone="dark"`. Before the fix, the first round's screenshot run recorded `light` for that wash.

### Covering tests

- **RED:** `pnpm exec vitest run src/themes/derived.test.ts src/themes/resolve.test.ts`
  ```
  FAIL derived.test.ts > ... > paints Colour wash ...  expected 0.34071143307283336 to be close to 0.58
  FAIL derived.test.ts > ... > takes the wash's extremes ...  expected 0.14437559186542737 to be close to 0.36
  FAIL resolve.test.ts > ... > gives a pale picture's wash dark text ...  expected 'light' to be 'dark'
  Test Files 2 failed (2)   Tests 3 failed | 29 passed (32)
  ```
- **GREEN:** `pnpm exec vitest run src/themes/derived.test.ts src/themes/resolve.test.ts src/uploads/sample.test.ts` → `Test Files 3 passed (3)  Tests 44 passed (44)`.
- `pnpm lint` clean; `pnpm typecheck` clean (after `rm -f tsconfig.tsbuildinfo`); `pnpm test` → `Test Files 64 passed (64)  Tests 526 passed (526)`.
- **Browser, production-build loop** (`pnpm build`; `node --env-file=.env.development .next/standalone/server.js` on :3000, with `public`, `.next/static` and `drizzle/` copied in, Compose dev profile up): `pnpm exec playwright test e2e/uploads.spec.ts e2e/theme.spec.ts --workers=2 --grep-invert operator` → `25 passed (1.1m)`. Port 3000 was stopped and the copied `drizzle/` removed.

### By hand, with a pale picture (what I saw)

I used a throwaway spec (deleted) on mobile against the same build: a near-white linen picture (`#f4f1ec`) with one small terracotta circle (`#c0663a`).
- The picture as the background: dark text.
- Soft blur: dark text.
- **Colour wash: light text.** The wash's stops are `#d18c6b` (the darkest point is the circle, under the white scrim), the accent deepened to `#ae5e37`, and `#b7b5b1` (the linen under the black scrim). Their luma is 0.597, 0.424 and 0.710, a mean of 0.577, just under 0.6.
- The wash painted is visibly a mid-to-deep terracotta gradient, and light text over the smoked glass reads naturally on it.

So on the corrected scale, Auto follows what the wash looks like. A pale picture with a gentle accent (white, near-white, the tests' pale garden) gets dark text. A pale picture whose darkest point is a small saturated subject makes a wash that is not pale, and gets light text. I report this rather than change anything: the formula is the ruled one, and the result is legible either way.

### Noted, not changed

- `scripts/measure-backgrounds.ts:84` keeps its own pre-existing inline luma over a raw buffer.
- `resolve.test.ts`'s pre-existing `POSTER.darkest` `#707070` is just below the 45% white scrim's floor (`#737373`). No test depends on the gap.
- The ticket comment's luminance concern is marked resolved, with a dated entry for this round.
