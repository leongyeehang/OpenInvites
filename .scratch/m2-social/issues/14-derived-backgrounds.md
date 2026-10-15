# 14: Backgrounds from the host's picture

**What to build:** When the event has an upload, the background gallery offers two more tiles: a soft blur of the picture and a colour wash from its colours. Neither needs new image processing.

**Blocked by:** none

**Status:** done

- [x] `src/themes/derived.ts`: `DERIVED_BACKGROUND_IDS = ["upload-blur", "upload-wash"]`; `derivedBackground(id, upload)` returns a `Background`: for `upload-blur`, kind `photo` with `src` the upload's `poster.copySrc`, `accent` and `luminance` the upload's, `lightest`/`darkest` the upload's `poster.lightest`/`poster.darkest`; for `upload-wash`, kind `gradient` with CSS `linear-gradient(135deg, {darkest}, {accent}, {lightest})` from the upload's sample, `accent` the upload's, `luminance` the mean of the three stops' luminance **on the sampler's scale** (the luma of the encoded values that `uploads/sample.ts` stores for every upload and that the 0.6 text-tone line was set on; ruled 2026-10-08, replacing "relative luminances", which sit lower and gave a white picture's wash light text), `lightest` and `darkest` the stops with the highest and lowest of that luminance. Pure, unit tested (a known sample → known CSS, luminance to two decimals, extremes).
- [x] `resolveTheme`: a `backgroundId` in `DERIVED_BACKGROUND_IDS` resolves through `derivedBackground` when the upload is present; without an upload it falls back to the default background. Unit tests for both.
- [x] `parseThemeChange` accepts a derived id for `backgroundId` only when `upload` is not null. Unit tests.
- [x] `applyChange`: a derived background behaves as any background tile: choosing it sets `backgroundId` and clears `accentOverride`; the picture is put aside (not shown as background or poster) and stays in the gallery. A new upload (`uploadId` change) keeps a derived `backgroundId` rather than switching to the picture: the new picture's blur or wash shows. Unit tests.
- [x] The drawer's background gallery, after the host's picture tile and only when there is an upload, shows two tiles under a small label "From your picture": "Soft blur" (the tile painted with the blurred copy) and "Colour wash" (the tile painted with the gradient). Names under `DesignDrawer.derivedNames.*`.
- [x] The blur is painted as the page already paints the blurred copy behind a poster (the same CSS blur, same layer), so legibility is as measured for that copy. Today that blur is applied because the theme resolved to a poster; here there is no poster, so the resolved `Background` (or `ResolvedTheme`) carries a `blurred: true` flag for `upload-blur` and `themed-page.tsx` paints a blurred backdrop whenever the flag is set, the poster case included. The wash is a gradient like the curated ones.
- [x] Browser tests (extend `e2e/design.spec.ts` or `e2e/uploads.spec.ts`): without an upload the tiles are absent; after an upload both appear; choosing each paints the page (by the root's background or a test id) and the thumbnail in the drawer matches; uploading a new picture while on Colour wash keeps the wash; the preview card renders for each (the card endpoint answers 200).

## Notes for the implementer

- Relative luminance: `legibility.ts` or `uploads/sample.ts` already has the WCAG formula; reuse it, do not write another.
- `findBackground` must not return derived ids (they are not curated); check where it is used as "is this a known background" and route derived ids through `derivedBackground`.
- Commit subject, e.g. `Design drawer: two backgrounds made from the host's picture, a soft blur and a colour wash`.

## Comments

**2026-10-08, implementing agent.** Done, every box ticked. Commit `5894497`. Lint, type check, `pnpm test` (64 files, 525 tests), and the design, uploads, poster, theme, sharing, broadsheet, thread and effects specs (85 passed, production-build loop) pass.

How it landed:
- **`src/themes/derived.ts`** (beside `derived.test.ts`): `DERIVED_BACKGROUND_IDS`, `DerivedBackgroundId`, `isDerivedBackground(id)`, and `derivedBackground(id, upload)` with the ticket's values. Soft blur is `{ id: "upload-blur", kind: "photo", src: poster.copySrc, accent, luminance, lightest: poster.lightest, darkest: poster.darkest, blurred: true }`. Colour wash is `linear-gradient(135deg, {darkest}, {accent}, {lightest})` from the upload's sample. Its luminance is the mean of the three stops' luma, the sampler's scale (`legibility.ts`'s `luma`; first landed as WCAG relative luminance, fixed in `ff39611`, below), and its `lightest` and `darkest` are the stops with the highest and lowest of them. `findBackground` is unchanged and still returns only curated backgrounds.
- **`Background`** (`backgrounds.ts`): the photo kind gains an optional `blurred` flag. `uploadedBackground` sets it for the poster's copy too.
- **`resolveTheme`**: a derived id resolves through `derivedBackground` while there is an upload, and otherwise falls back like an unknown id, to Golden hour. The picture itself is not in use (`resolved.upload` and `resolved.poster` are null), so the picture is put aside and nothing describes it. `toneTokens` gets `use: "poster"` whenever the background is blurred. Soft blur therefore wears the poster scrim its extremes were measured under (`uploads/sample.ts`, `measureBackdrop`), and the poster case is unchanged.
- **`changes.ts`**: `parseThemeChange` accepts a derived id only when `upload` is not null. In `changeKnob`, an `uploadId` change while a derived background is on keeps `backgroundId`, takes the new id and clears `accentOverride`. Choosing a derived tile goes through the generic `backgroundId` path, which sets it and clears the accent. Choosing the picture's tile or "Use it as" brings the picture back, as from a curated background.
- **Backdrop** (`themed-page.tsx`): the `poster && kind === "photo"` branch is now `kind === "photo" && blurred`, with the same blur-3xl layer and scrim. The root now carries `data-slot="backdrop"` for the browser tests.
- **Thread card** (`thread-card.tsx`): under Soft blur the 4:3 frame holds the copy at `-inset-32` with `blur-3xl`, as the backdrop paints it, clipped to the frame. The Broadsheet title and the Poster card paint only a poster, never the background, so they needed nothing.
- **Drawer** (`design-panel.tsx`): after the gallery grid, and only with an upload, a `role="group"` labelled by a small "From your picture" line holds a five-column row of two `Choice` tiles in the same `background` radio group. "Soft blur" is painted with the copy under `blur-md` and "Colour wash" with the gradient, both from `derivedBackground`, so each tile matches the page. Templates still cannot carry a derived id: `templates.test.ts` already requires `findBackground(theme.backgroundId)` to be defined.
- **Preview card**: the wash is a gradient, which `backdrop()` already draws. Under Soft blur the route reads the picture's `card` rendition and blurs it with sharp, sigma 64, before Satori draws it under the usual shade (`blurredForCard` in `preview-card.tsx`; about 55 ms, and versioned cards are cached for a year). Satori does blur (`filter: blur()`), but librsvg blurs only what is on its canvas, so the card's edges faded towards its backdrop. In a measured stripe test the corner kept 28/255 of its colour and the middle of an edge 85/255, even with the image overhanging by 256 px. sharp extends the edges, so the colour carries out to them. No rendition is added or stored.

Decisions and things to know:
- **A guest's page under a derived background (not in the rulings, needed).** `page.tsx` sent guests the upload only while `resolved.upload` was set. A guest's ThemedPage would then have re-resolved with no upload and painted Golden hour instead of the wash or the blur. Guests are now sent `derivedUpload(picture, id)`: the sampled colours and, for Soft blur, the copy's src. The picture's sources, its description and the upload's id are left empty. Unit-tested (it paints the same theme; under the wash it holds no part of the upload's id, under the blur only the copy's path), and the browser test checks that a guest's HTML has no `/uploads/<id>/` file under the wash and only `poster-copy.webp` under the blur.
- **A new picture under a derived background clears the accent override**, as any picture newly in use does. The ruling was silent on this, and an override picked against the old picture may not suit the new one.
- **`resolveTheme` does not require `theme.uploadId === upload.id` for a derived background.** It is made from the event's upload, whichever that is, as the ticket says ("when the upload is present"). `replaceUpload` and `attachUploadCopy` keep the two in step anyway. By reading `attachUploadCopy`, a duplicate on a derived background should show its copy's blur or wash; that is not tested.
- Translations, three files: `DesignDrawer.fromYourPicture` and `DesignDrawer.derivedNames.upload-blur` / `upload-wash`, keyed by id as `backgroundNames` is.

Left for later tickets or noted:
- **Ticket 15:**
  - `docs/contributing/backgrounds.md` may want a line saying that the two tiles after the host's picture, Soft blur and Colour wash, are not curated data (`src/themes/derived.ts`). Nothing goes into `BACKGROUNDS` for them, and their names live under `DesignDrawer.derivedNames`, not `backgroundNames`.
  - Translations I am least sure of (Simplified / Traditional):
    - `derivedNames.upload-wash` ("Colour wash"): 色彩晕染 / 色彩暈染, a watercolour wash. 色彩渐变 / 色彩漸變 is plainer if 晕染 reads too literary.
    - `derivedNames.upload-blur` ("Soft blur"): 柔和模糊 / 柔和模糊 (柔焦, soft focus, is the photographer's word).
    - `fromYourPicture`: 取自你的图片 / 取自你的圖片.
  - `CONTEXT.md`'s **Background** says "chosen from the curated gallery or uploaded by the host". The maintainer may want "or made from the host's upload" (not edited: the maintainer's file).
- **For the maintainer, on the ticket's values (implemented as given):**
  - ~~The wash's luminance is a mean of WCAG relative luminances, on a different scale from the 0.6 text-tone line.~~ **Resolved in `ff39611`:** the wash is measured in luma, the sampler's scale; see the entry below.
  - The sample's `lightest` is measured under the light tone's black scrim and its `darkest` under the dark tone's white one. On a light picture the stop named darkest is therefore the lighter of the two, so the wash runs light, through the accent, to grey. The extremes are chosen by luminance, so legibility holds.
- **Pre-existing, not changed:** the theme every guest is sent carries `uploadId`, and upload files are served by id, so a put-aside picture's files can be reached by anyone who reads the theme and knows the URL pattern. Soft blur's copy URL holds the same id. The page itself names no other file of the picture, as before.

Evidence:
- **RED:** `pnpm exec vitest run src/themes/derived.test.ts src/themes/resolve.test.ts src/themes/changes.test.ts`. `derived.test.ts` failed to load with `Cannot find module './derived'`, and 5 failed, 59 passed in the others: Soft blur and Colour wash resolved to Golden hour (`id: 'golden'`), the accent was `#ffc36b` not `#3aa885`, `parseThemeChange` returned `undefined` for `upload-blur` with an upload, and a new upload under the wash switched to the picture.
- **GREEN:** the same command, 3 files and 70 tests passed. `pnpm exec vitest run src/themes`: 10 files, 159 passed. `pnpm test`: 64 files, 525 passed. Vite prints its `configLoader` notice about `vitest.config.ts` on every run, the RED one before any change included, so it is not from this ticket.
- **Browser, production-build loop** (`pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000, with `public`, `.next/static` and `drizzle/` copied in and the Compose dev profile up), `--workers=2 --grep-invert operator`:
  - The two new tests (`uploads.spec.ts`, ticket 14): 5 passed at both widths, including the operator setup.
  - Mutations, each on its own build, restored afterwards:
    - Guests sent no upload under a derived background: the Poster test fails, with the guest's backdrop on Golden hour's radial gradient, not the wash.
    - The Thread card without `blur-3xl`: the layouts test fails with `filter` `none`, not `blur(64px)`.
    - The backdrop's blur only behind a poster: both tests fail at the blurred backdrop.
    - The keep-on-new-upload rule disabled: the Poster test fails after the replace, with the backdrop's first layer `none` rather than a wash.
  - Full list (design, uploads, poster, theme, sharing, broadsheet, thread, effects): **85 passed** (4.4 min). No failures, so no `--workers=1` rerun was needed.
  - A throwaway screenshot spec, deleted afterwards, checked the drawer row, the Thread card and backdrop under each tile at both widths, and both preview cards (the wash, and the blurred picture with its edges full).
  - Port 3000 was stopped afterwards and the copied `drizzle/` removed from `.next/standalone`.

**2026-10-08, implementing agent (review fix, round 1).** Done. Commit `ff39611`. Lint, type check, `pnpm test` (64 files, 526 tests), and the uploads and theme specs (25 passed, production-build loop) pass.

How it landed:
- **One measure for every background's luminance.** `luma(rgb)` now lives in `legibility.ts`, beside `luminance`: `(0.2126 R + 0.7152 G + 0.0722 B) / 255` over the encoded channels. `uploads/sample.ts` now calls it rather than holding the formula inline, so the sampler's average and the wash share one function. `derivedBackground` measures the wash's stops with it, both for the mean and for picking `lightest` and `darkest`. A white picture's wash (`#ffffff`, `#737373`, `#bfbfbf`) is 0.73 and gets dark text under Auto, as the picture and Soft blur do; on the old scale it was 0.56, light.
- **Unit samples the sampler can produce.** `derived.test.ts`'s garden is now a night-blue ground with a marigold lantern. Its `lightest` (`#b89151`) and `darkest` (`#565a70`) are the lantern and the ground under the 25% scrims, and its poster copy's (`#6e583e`, `#838696`) are under the 45% ones. Its comment says how they are made. Known sample: CSS `linear-gradient(135deg, #565a70, #f6c571, #b89151)`, luminance 0.58 (luma 0.3558, 0.7896, 0.5830), lightest the accent, darkest the ground. The extremes test is 0.36 on the new scale.
- **The reviewer's two cases** are in `resolve.test.ts`: a white picture (`#ffffff` / `#737373` / `#bfbfbf`, 0.73) and near-white with a coloured accent (`#e1dcd6` / `#b8653a` / `#bfbfbf`, 0.69). Each wash gets dark text under Auto, as each picture does. They replace my earlier sample, whose `lightest` of `#ffffff` the sampler could never produce.
- **The uploads spec** now also checks that the pale garden photo's wash wears dark text, for the host and for a guest. The earlier screenshot run, before the fix, showed `light` there.

Seen by hand (throwaway spec, deleted, mobile, production build): a near-white linen picture (`#f4f1ec`) with one small terracotta circle (`#c0663a`).
- The picture as the background, and Soft blur, give dark text.
- **Its wash gives light text.** Its darkest point is the circle (`#d18c6b` under the white scrim), the accent is deepened to `#ae5e37`, and the linen under the black scrim is `#b7b5b1`. That is luma 0.597, 0.424 and 0.710, a mean of 0.577.
- The wash painted is a mid-to-deep terracotta, and light text over the smoked glass reads naturally on it.
- So on the right scale Auto follows what the wash looks like, which for a pale picture with a small saturated subject is not pale. White and near-white pictures with a gentle accent get dark text.

Left for later tickets or noted:
- `scripts/measure-backgrounds.ts:84` still has its own inline copy of the luma formula over a raw buffer (pre-existing, measures the curated backgrounds). Left as it was.
- `resolve.test.ts`'s pre-existing `POSTER` fixture has `darkest: "#707070"`, just below what the poster's 45% white scrim allows (`#737373`). It is not mine, and no test depends on the gap, so I left it.

Evidence:
- **RED:** `pnpm exec vitest run src/themes/derived.test.ts src/themes/resolve.test.ts` → 3 failed, 29 passed:
  - `expected 0.34071143307283336 to be close to 0.58`
  - `expected 0.14437559186542737 to be close to 0.36`
  - the white picture's wash `expected 'light' to be 'dark'`
- **GREEN:** `pnpm exec vitest run src/themes/derived.test.ts src/themes/resolve.test.ts src/uploads/sample.test.ts` → 3 files, 44 passed. `pnpm test` → 64 files, 526 passed. `pnpm lint` and `pnpm typecheck` clean.
- **Browser, production-build loop** (`pnpm build`, `node --env-file=.env.development .next/standalone/server.js` on :3000, with `public`, `.next/static` and `drizzle/` copied in, Compose dev profile up), `--workers=2 --grep-invert operator`: `e2e/uploads.spec.ts` and `e2e/theme.spec.ts`, **25 passed** (1.1 min). Port 3000 was stopped afterwards and the copied `drizzle/` removed.
