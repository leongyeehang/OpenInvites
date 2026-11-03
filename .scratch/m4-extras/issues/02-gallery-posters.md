# 02: The gallery posters

**What to build:** About twenty ready-made posters, drawn as SVG, sorted by occasion, each carrying the look it suits (title font, accent, effect, title placement, button style).

**Blocked by:** 01 The poster model

**Status:** done

- [x] Twenty or so SVG files in `public/posters/`, named after their content (`public-files.test.ts`), 4:5, under 60 KB each, no text in them, no external references, grain as an SVG filter. Occasions: Birthday, Dinner, Wedding, Kids, Night out, Outdoors, Holiday, plus a few general ones. The mockup's canvas drawings (candles, balloons, candlelight, picnic, botanical, rings, playtime, rainbow, disco, sunset drive, sunshine, seaside, string lights) are the starting set, redrawn and polished.
- [x] Colour posters Peach, Lagoon, Lilac and Ink beside the five curated gradients, each measured as the gradients are (`pnpm measure:backgrounds`), with names in all three languages and the legibility sweep (moved here from ticket 01).
- [x] Templates become gallery-poster looks: the six template ids map to their posters, picking a gallery poster applies its look, and the Design drawer's Templates row goes (moved here from ticket 01).
- [x] Each in `posters.ts` with id, occasion, file, measured `lightest`/`darkest` (the measuring `process.ts` does for uploads, run once by a script in `scripts/` and stored), accent, and look.
- [x] Message keys for each name and occasion in all three languages (`Posters.names.*`, `Posters.occasions.*`).
- [x] The preview card (`src/sharing/`) renders a gallery poster: Satori cannot read SVG backgrounds reliably, so the script also writes a JPEG of each at 1200×1500 for the card.
- [x] `docs/contributing/templates.md` becomes `posters.md`: how to draw, measure and add one.
- [x] Unit tests: every registry entry has its file, its messages, a measured pair, and a look whose font, effect and placement are valid knobs; legibility holds over each poster's measured pair in both tones.
- [x] Visual check at 390 px and desktop of every poster with its own look, title below and on.

## Notes for the implementer

- The licence is the project's (AGPL-3.0); say so in `public/posters/README.md`.
- Commit subject, e.g. `Posters: twenty gallery posters for the common occasions`.

## Comments

**2026-11-03, implementing agent (Opus, in the maintainer's session).** Done. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 786 passed (73 files; `templates.test.ts` gone with the templates, `posters.test.ts` new).

How it landed:
- **Twenty posters**, drawn as code in `scripts/posters/art.ts` with the helpers in `svg.ts` (gradients, shapes, a seeded random source, the grain filter): Birthday (Candles, Balloons, Cake), Dinner (Candlelight, Picnic), Wedding (Botanical, Rings, Rose garden), Kids (Playtime, Rainbow), Night out (Disco, Sunset drive, Cocktails), Outdoors (Sunshine, Seaside, Sunset sea), Holiday (String lights, Aurora), Any occasion (Bokeh, Streamers). The mockup's thirteen are redrawn at 1200×1500; the four 0.4 scenes are redrawn at 4:5 under their old ids (stored themes name them); Cake, Cocktails and Streamers are new. 2 to 54 KB each.
- **`pnpm posters`** (`scripts/posters/build.ts`, a Playwright project of `playwright.scripts.config.ts` that needs no app): writes each SVG named after its content, draws it in Chromium, writes that drawing as the card JPEG (1200×1500), runs it through `processUpload` (uploads/process.ts) and writes the poster-copy rendition as the blurred copy; the luminance and the copy's lightest/darkest go to the generated `src/themes/poster-files.ts`, which `posters.ts` joins to its hand-written entries (id, occasion, accent, look). Stale files are removed.
- **A gallery poster paints as an upload does** (amended, see below): `resolveTheme` makes it the poster card (its SVG at 4:5, `alt=""`, decoration) with its copy blurred behind, solved under the poster scrim against its measured pair. `ResolvedTheme.gallery` carries it; the preview card route draws it from its JPEG cut to 1200×630.
- **Colours**: `BACKGROUNDS` is the nine gradients (Golden hour, Dusk, Forest, Midnight, Peach, Lagoon, Lilac, Slate, Ink), measured with `pnpm measure:backgrounds` (Peach 0.66 / `#ffdabc` / `#f07176`, Lagoon 0.5 / `#97eede` / `#47609b`, Lilac 0.55 / `#efd3fc` / `#7658c6`, Ink 0.12 / `#535157` / `#16141b`). The `photo` kind of `Background` is now only the blurred copy; `public/backgrounds/` and the scene branch of the backdrop are gone. Messages: `DesignDrawer.backgroundNames` became `colourNames` (the four scenes moved to `Posters.names`).
- **Looks**: picking a gallery poster applies its look (`applyPosterLook`: font, title placement, effect, button style, accent back to Auto) and records `template: { posterId, dirty: false }`; any other knob makes it dirty; picking the shown poster again restores the look. The drawer shows "Restore the {poster} look" while it is dirty (focus goes back to the panel when the button goes). A look never sets the layout, text tone or RSVP style: those stay the host's.
- **Templates**: `src/themes/templates/` is deleted. `LEGACY_TEMPLATES` maps the six ids to posters (birthday→candles, vows→rose, supper→candlelight, kids→balloons, festival→aurora, quiet→bokeh); `parseTemplate` reads a 0.4 `{ id, dirty }` into `{ posterId, dirty }`, dirty unless that poster is the one shown. `DEFAULT_THEME` keeps the Birthday look on Golden hour, with `template: null`.
- **Drawer**: the Templates row and the Background group are one Poster group: a labelled row per occasion (4 columns of 4:5 tiles), then Colours and the host's picture. Nothing in the drawer scrolls sideways any more. Ticket 06 replaces this with the sheets.
- Docs: `templates.md` became `posters.md` (draw, entry, names, build and measure, tests, licence); `backgrounds.md` covers the colours only; `public/posters/README.md` states the AGPL-3.0; CONTRIBUTING and README updated. `next.config.ts` caches `/posters/*.{svg,jpg,webp}` for a year.

Amended from the ticket (and the spec):
- **Gallery posters are painted as picture posters now**, not as page backgrounds until ticket 03: a 4:5 poster stretched over a desktop screen would not have read as a poster, and the visual check of title on and below needs the poster card. Colours stay page backgrounds until ticket 03.
- The mockup's Confetti poster is **Streamers**: "Confetti" is the effect's name in the same drawer.
- Messages `Posters.names.*` and `Posters.occasions.*` as asked; the colour names stay in `DesignDrawer.colourNames` until ticket 06 moves the drawer.

Visual check: every poster with its own look, title on and below, at 390×844 and 1280×800 (80 screenshots, read as contact sheets), and the drawer at both widths. All twenty read as posters; light ones (Picnic, Cake, Botanical, Rings, Playtime, Rainbow, Sunshine, Seaside) take dark text from their measured luminance.

Browser (against `next dev` from the working tree, desktop): the rewritten and touched rows of `design`, `sharing` (new: the card of a gallery poster is drawn from it), `keyboard` (the drawer row, and the focus rings), `broadsheet` and `thread` (a poster's look keeps the layout), `theme` (a gallery poster and its copy are served and kept a year), `duplicate`, `poster`, `uploads`, `effects` and `reduced-motion` pass; `reduced-motion.spec.ts:227` (unchanged here) ran out of its 240 s on the dev server in its last section, the report form. The definitive run on the Docker test profile follows below.

Ticket 01's browser run, which it could not do: the suite on the test profile built from c1d761f was stopped at 174 of 535 (mobile, accessibility to keyboard) to spare two hours on this two-core machine, since this ticket's run covers ticket 01 too. Of those, 172 passed; two failed. `duplicate.spec.ts` looked for the upload's `background.webp` on the page, which ticket 01 had stopped showing: it now looks for `poster.webp`. `effects.spec.ts:48` saw the confetti still there 5 s after a Going, under a load average of 11; it is in the run below. Running `poster.spec.ts` here also found the guest's page still carrying the unused `background.webp` and `background-portrait.webp` addresses in its theme data (`ThemeUpload.src`, `portraitSrc`): both are gone from `ThemeUpload` now.

**2026-11-03, the definitive run.** `docker compose --profile test up -d --build --wait` (built from `d8aefbe`), then `CI=1 pnpm exec playwright test --workers=2`, every project: **537 passed, 0 failed, 0 flaky**, in 54.9 min (operator, mobile, desktop, fresh-instance, limits-instance, retention-instance). This covers ticket 01's browser box as well: `effects.spec.ts:48`, which failed under load in the stopped run, passed at both widths, and so did `reduced-motion.spec.ts:227`. The test profile's containers are stopped afterwards.

