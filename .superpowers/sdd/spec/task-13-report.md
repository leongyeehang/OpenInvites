# Task 13 report: Poster mode

**Status:** DONE_WITH_CONCERNS (the concerns are decisions for the maintainer; nothing is unfinished)

**Commit:** `a115b6f` Poster mode: a host's picture becomes the invitation itself, with the title on it or below it

## What I implemented

Every checkbox in `.scratch/openinvites/issues/13-poster-mode.md` is ticked. The ticket file's `## Comments` entry dated 2026-09-24 has the full hand-off.

1. **The Background or Poster choice sets the upload mode.** The "Use it as" row offers Poster. In poster mode:
   - The picture is the poster card at its own proportions, as a `next/image` with `unoptimized`, `fetchPriority="high"`, and its stored size as `width`/`height`.
   - A copy of the same file fills the page behind it: blurred 64px (`blur-3xl`), over a box 8rem past every screen edge, under the poster scrim.
   - The poster scrim is 45% black under light text and 45% white under dark (`TONES.*.posterScrim`, the prototype's `scrimPoster`). The ticket's "darkened" is the light tone; under dark text the copy is lightened, which is what lets text read on it in both tones.
   - A poster taller than the screen is drawn at the screen's height less 6rem and narrower, never under 20rem wide.
2. **Title placement row.** It sits in Details after RSVP style, only while a poster is shown. It uses `KnobChange { knob: "titlePlacement" }` and `parseThemeChange`, and marks the template dirty like any knob.
   - **Below the poster:** the poster, then a glass card with the eyebrow, the title, the date sticker and who is hosting.
   - **On the poster:** the eyebrow and title at the poster's foot on a frosted scrim (24px blur, like the glass, plus the solved shade), with who is hosting in a glass pill beneath. No date sticker.
   - Beside a poster the title uses a new `compact` size, set in container query units so it follows the card's width. That lets it fit a narrow poster.
3. **Poster rendition.** `poster.webp` is added to `RENDITIONS`, so it is stored, served and removed with the others. It is fit inside 1200x2400, never enlarged, WebP at quality 85. Its size is stored (`poster_width`, `poster_height`). No fallback or backfill for older uploads, as ruled.
4. **Alternative text.** The host's description is the poster's `<img alt>`, and `BackgroundDescription` is not rendered in poster mode, so the description is heard once. A browser test checks it.
5. **Switching modes round-trips.** Background, Poster, Background returns the identical theme. The rule is in `changes.ts`: the same picture used the other way keeps the host's accent; a picture newly in use resets it to auto, as a new background does. A replaced picture keeps the mode the host chose, so a replaced poster stays the poster.
   - The drawer now sends `uploadMode` for the "Use it as" row and the "Your picture" tile, and `parseThemeChange` no longer accepts `uploadId` from the browser. Only the server applies `uploadId`, on upload.
   - A side effect: ticket 12's noted race, a theme change naming an old upload, can no longer happen.
6. **Legibility, the two new surfaces, in `src/themes/legibility.ts`.**
   - **Text straight on the blurred copy.** Its extremes come from `measureBackdrop(raster, "poster")` in `process.ts`: the picture scaled to cover the copy's box on a 1920x1080 screen, blurred 64px, at quarter size. They are stored as `poster_lightest` and `poster_darkest`. `toneTokens(tone, backdrop, accent, "poster")` solves every surface against them and returns the poster scrim for the backdrop.
   - **The title "On the poster".** I chose **solving over anything, not sampling**, via `POSTER_SURFACES`: white under light text and black under dark, as the sheet is. The region the title covers changes with the title's length, the font and the screen width, so a sampled region would be a guess. It solves to 67% of the plum shade (light tone) and 60% white (dark tone), with secondary text at 80%.

The drawer also gains a hint under "Use it as" in poster mode. Migration `0012_poster_uploads` adds the four columns and first deletes existing upload rows; see Concerns.

## TDD evidence (pure rules)

Every rule was test-first. Commands were run from `/home/leong/rsvp`, and the full outputs are saved in the scratchpad (`tdd/*-red.txt`, `tdd/*-green.txt`).

**`pnpm exec vitest run src/themes/legibility.test.ts`**
- RED: `Tests 27 failed | 11 passed (38)`, with `TypeError: POSTER_SURFACES is not a function`, `TypeError: Cannot read properties of undefined (reading 'scrim')`, and `AssertionError: light: expected [ +0, +0, +0, 0.25 ] to deeply equal undefined` (no `posterScrim`). The existing combination tests failed too, because the shared checker now also reads `titleOnPoster`.
- GREEN: `Tests 38 passed (38)`.

**`pnpm exec vitest run src/uploads/sample.test.ts`**
- RED: `Tests 1 failed | 11 passed (12)`, `AssertionError: expected { lightest: '#bfbfbf', …(1) } to deeply equal { lightest: '#8c8c8c', …(1) }`.
- GREEN: `Tests 12 passed (12)`.
- One of my expected values was an arithmetic slip: I had `#474747` for 128 × 0.55 = 70.4, which is `#464646`. I corrected the test before implementing.

**`pnpm exec vitest run src/uploads/process.test.ts`**
- RED: `Tests 2 failed | 7 passed (9)`, with `Error: Invalid input` (no poster rendition) and `AssertionError: expected { luminance: 0.4999999999999999, …(3) } to match object { posterLightest: '#8c8c8c', …(1) }`.
- GREEN: `Tests 9 passed (9)`.
- Later I widened the copy's bleed to 8rem to match the backdrop. That drew the picture larger, and the white-patch measurement rose from under 80 to 94, which is correct. I restated that threshold as "well under the 140 a wide white area measures" (< 110).

**`pnpm exec vitest run src/themes/resolve.test.ts`**
- RED: `Tests 4 failed | 16 passed (20)`, with `TypeError: posterTitleVariables is not a function`, `expected undefined to be null`, and `expected [ +0, +0, +0, 0.25 ] to deeply equal [ +0, +0, +0, 0.45 ]`.
- GREEN: `Tests 20 passed (20)`.

**`pnpm exec vitest run src/themes/changes.test.ts`**
- RED: `Tests 8 failed | 22 passed (30)`, with `expected undefined to deeply equal { knob: 'uploadMode', value: 'poster' }`, `expected { knob: 'uploadId', …(1) } to be undefined`, and Object.is failures for the no-op cases.
- GREEN: `Tests 30 passed (30)`.

**Mutation checks** (each broken, seen failing, then restored and green again):
- `changes.ts`: always resetting the accent on a mode switch fails "shows it as the poster, and back as the background, with nothing else changed either way".
- `legibility.ts`: dropping the "anything" layer from `POSTER_SURFACES` fails 3 tests (both tones' "over any colour", and "never a solid bar").
- Browser: swapping the two placements in `poster-card.tsx` fails `poster.spec.ts` at the title-below-the-poster assertion.

**Full unit suite:** `pnpm test` gives `Test Files 31 passed (31)`, `Tests 247 passed (247)` (225 before this ticket). The only warning is the pre-existing Vite `configLoader` one from `vitest.config.ts` (ticket 11).

## Definitive browser run (Compose test profile)

1. `fuser -k 3000/tcp` stopped my dev server.
2. `docker compose --profile test up -d --build --wait` exited 0 with `openinvites-app-1 Healthy`.
3. `pnpm exec playwright test` exited 0: **`158 passed (2.4m)`**, 79 scenarios at 390px and desktop (152 before, plus the 6 new).
   - `e2e/poster.spec.ts`: 3 tests × 2 projects, all passed: both placements, switching back to background mode, and a replaced poster.
   - Nothing was flaky and there were no retries.
4. The app log over the run holds only pre-existing noise ticket 12 recorded ("The destination stream closed early", the `/events/x` uuid 500 from the description spec) and the auth tests' deliberate bad passwords.
5. Afterwards, `docker compose --profile test stop app`. Port 3000 is free; db and mail are left running, as they were when I started.

Also run: `pnpm lint` clean, and `pnpm typecheck` clean (after `rm -f tsconfig.tsbuildinfo`). In dev, the poster pages log no console warnings or errors in poster mode, including with the RSVP sheet open over a poster.

## Visual check

**Screenshots:** made with a scratch Playwright script, not committed (`scratchpad/visual/`).
- Two generated posters: a light portrait 1080x1528 with lettering top and bottom, and a dark landscape 1600x900 with lettering in its lower half.
- Each in both text tones and both placements, at 390x844 and 1280x800, top of page and scrolled to the foot. I looked at each.
- Also: the host's drawer in poster mode at desktop and phone, the preview card, the sheet over a poster, and edge cases (1:2.5 and 3:1 posters with a long title in Syne).

**Fixed after looking:**
1. *The desktop portrait poster ran off the first screen* (816px tall in an 800px window, its own date line below the fold). It is now held to the screen's height less 6rem, with its proportions kept.
2. *On the poster, the poster's own lettering ghosted through the scrim under our title* (legible by the rule, but cluttered). The scrim is now frosted as the glass is, masked to fade out at the top, so the lettering underneath turns to soft colour. A blur only averages colours already there, so the "over anything" solution still holds.
3. *A wide poster's title block was taller than the poster at 390px,* which grew a pale band under the poster in the dark tone. Moving who-is-hosting out to a glass pill (the prototype's arrangement) shortened the block.
4. *A narrow tall poster overflowed with the title on it* (desktop, 1:2.5). The grid's auto column grew to the title's longest word, clipping both title and picture. Fixed with a `minmax(0,1fr)` column, a 20rem floor on the fitted width, and the `compact` title size in container query units. Without that size, Syne at 44px broke "thirtieth" mid-word.
5. *Scratch-tool bugs, not page bugs.* Full-page captures showed the fixed backdrop only over the first viewport, so I switched to viewport captures. The first audit read colours mid-transition, so it now reloads between passes.

**Pixel contrast audit** (scratch). For every visible text run: its box and computed colour, then text hidden and the real pixels behind the box read back.
- Run on the production image: **952 text runs, all ≥ 4.5:1; closest 5.64:1.** Coverage: portrait and landscape; light and dark; glass and outline buttons (outline sits on the page's veil); on and below; 390 and 1280; top and foot.
- The dev-server run's only failures were the countdown chip under Next's dev indicator (1.01), which is absent on the production image.

**Left as they are, and noted in the ticket:**
- A 3:1 poster with a long title on it at 390px is essentially covered by the title block (the card grows on the base colour rather than lose any of the title).
- A 1:2.5 poster held at 20rem runs past the first screen on a 1280x800 desktop.
- Both are choices the host sees live; Below the poster suits them.

**Preview card: it plainly misrepresents a portrait poster.** `card.jpg` is a 1200x630 cover crop, so the portrait poster unfurled as its middle band: "SUMMER" gone, "FAIR" cut in half, the date line lost. Per the ruling I left it on the card rendition and wrote it up in the ticket comment for a later ticket. The fix would be a contained rendition in JPEG or PNG, which Satori reads, drawn whole beside the title.

## Files changed

- Added:
  - `src/themes/poster-card.tsx`
  - `e2e/poster.spec.ts`
  - `drizzle/0012_poster_uploads.sql`
  - `drizzle/meta/0012_snapshot.json`
- Modified:
  - `drizzle/meta/_journal.json`
  - `src/db/schema.ts`
  - `src/uploads/renditions.ts`, `process.ts`, `process.test.ts`, `sample.ts`, `sample.test.ts`, `uploads.ts`, `repository.ts` (comment only)
  - `src/themes/legibility.ts`, `legibility.test.ts`, `resolve.ts`, `resolve.test.ts`, `changes.ts`, `changes.test.ts`, `theme.ts`, `themed-page.tsx`, `poster-layout.tsx`, `poster-title.tsx`, `fonts.ts`, `background-description.tsx` (comment only)
  - `src/app/e/[slug]/design-panel.tsx`
  - `src/app/globals.css`
  - `messages/en.json`
  - `e2e/uploads.spec.ts`
- Ticket file updated but not staged, as instructed: `.scratch/openinvites/issues/13-poster-mode.md`. Not touched: `CONTEXT.md`, `.scratch/openinvites/decisions.md`.

## Self-review

- **Ruling compliance:**
  - The poster rendition is in `RENDITIONS`, natural aspect ratio, sized for a high-density phone and desktop.
  - No fallback or backfill for older uploads.
  - Both new surfaces are solved and unit-tested in `legibility.ts`, in both tones.
  - Title placement sits in Details after RSVP style, poster mode only, through `KnobChange`/`parseThemeChange`, and marks the template dirty.
  - The round trip is unit-tested (identical theme) and browser-tested (same upload URL, description, text tone).
  - The preview card is left on the card rendition, with the misrepresentation noted.
- **Glossary:** "poster", "background", "host", "guest", "event page", "theme". The UI copy avoids "cover", "flyer" and "site".
- **Tests observe only what a host or guest can observe:** positions, `img` alt/src, the guest's HTML, the served file's size, and 404s. No database assertions.
- **Scope:** everything traces to the ticket, except the `uploadId` semantics change (a replaced picture keeps its mode). Poster mode makes that necessary: without it a host replacing their poster silently got a background.
- **What I would still question:**
  - Container query units on the compact title are new to this codebase.
  - The mask/backdrop-filter pairing on the title scrim renders in Chromium (tested). Safari was not run. Safari 15.4+ supports both unprefixed mask-image and backdrop-filter (the latter via the prefix Tailwind emits), so I expect it to work but have not seen it.

## Concerns

1. **Migration `0012_poster_uploads` begins with `DELETE FROM "upload"`.**
   - The new columns are NOT NULL, and an older upload can't be kept whole (no poster rendition, no measurements). That rules out a plain `ADD COLUMN … NOT NULL`, which fails on any development database holding uploads: this one held 46. Backfilling or defaulting was ruled out.
   - On any real instance the table is empty, so the line does nothing. On development databases the old uploads' events fall back to the default background, and their files stay orphaned in dev storage.
   - I could only confirm about half of those 46 belonged to browser-test hosts: a query listing their owners was refused as personal-data handling, so I stopped there.
   - If the maintainer prefers to reset development databases by hand, remove that one line.
2. **The preview card misrepresents portrait posters** (above). Left for a later ticket, per the ruling.
3. **Unchecked:** a low-end phone's paint cost for the 64px CSS blur, a screen reader pass over the poster's alt text, and Safari.

No glossary or decisions-log change seems needed. One note for the decisions log, if the maintainer wants it: "title and date beneath" in poster mode now means the date sticker goes with the title below the poster, and is left off when the title is on the poster.
