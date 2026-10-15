# Task 11 report: Effects

**Status:** DONE_WITH_CONCERNS (all boxes ticked; the concerns are judgement calls for the reviewer, listed at the end)

**Commit:** `69ea574` Design drawer: a host picks an effect, and confetti falls when a guest says Going

The session was interrupted once, before the mutation checks. The work picked up from the tree as it stood. One temporary mutation was still in `rsvp-flow.tsx` (`confettiFor(null, …)`); I found it, used it for its check and restored it before committing.

## What was implemented

- **The knob.** `KnobChange` and `parseThemeChange` accept `{ knob: "effect", value }` for `none | confetti | sparkles | doodles` (`src/themes/changes.ts`). `theme.ts` exports `type Effect`. Templates are untouched, so they keep their effects: Birthday and Vows sparkles, Kids' party confetti, Festival doodles, the rest none.
- **Drawer.** The Details group ends with an "Effect" row (`src/app/e/[slug]/design-panel.tsx`): four `Choice` tiles in a 2x2 grid, each with a name and a one-line note, like the layout row. Keys: `DesignDrawer.effect`, `effectHint`, `effects.<id>.name` and `.note`, in en, zh-Hans and zh-Hant. `effectHint` is the prototype's own section hint, "Motion stops for guests who prefer reduced motion." It is one key more than the dispatch listed; it tells a host whose device asks for less motion why the page shows nothing.
- **Sparkles** (`src/themes/effects/sparkles.tsx`): 26 points at positions from a small integer hash of the index, so the server and the browser render the same ones. One in three is in the accent and the rest are white. Each point is 2 to 5 px with a glow in its own colour and twinkles (opacity 0.05 to 0.9, scale 0.6 to 1.25) over 2.4 to 5 s. Negative delays stagger them. The animation is the CSS keyframe `theme-twinkle`, applied only by `motion-safe:animate-theme-twinkle`. Each point's pace is held in custom properties.
- **Doodles** (`src/themes/effects/doodles.tsx`): seven accent shapes at opacity 0.3 to 0.5, near the screen's edges: two rings, two dots, a rounded tile, a stroke, and the prototype's squiggle. Each floats 8 to 14 px up and turns 8 degrees over 7 to 12 s (`theme-float`, on `transform`, so it composes with a shape's own `rotate`).
- **Backdrop** (`src/themes/themed-page.tsx`): sparkles or doodles are drawn inside the shared `aria-hidden` fixed backdrop, after the foot fade. Every layout gets them. The legibility comment the ticket asks for is above `Backdrop`. Both layers are `pointer-events-none` and `motion-reduce:hidden` and carry `data-effect="sparkles|doodles"`.
- **Sticker** (`src/themes/poster-card.tsx`): `StickerHolder` (`data-slot="date-sticker"`) wraps the sticker the layout drew. Under doodles it is `-rotate-6`, plays `motion-safe:animate-theme-sticker-in` once (0.6 s after a 0.25 s delay: from -20 degrees, scale 0.6 and transparent, overshooting to -3 degrees and scale 1.08, settling at -6 degrees), and fills the sticker with the accent. It fills it by setting the glass and text tokens on itself, in the manner of `sheetVariables` and `posterTitleVariables`; the text is `--theme-on-accent`.
- **Confetti** (`src/themes/effects/confetti.tsx`, client): 56 pieces in `var(--theme-accent)`, `var(--theme-text)` and `color-mix(in oklab, var(--theme-accent), white 50%)`. They fall once from 6 % above the top of the viewport to 115 vh over 2.0 to 3.4 s (plus up to 0.5 s of delay), drifting sideways and rotating, through `element.animate`. Random sizes and paths are set in the effect, not in render. The layer is removed once every animation's `finished` resolves. It is portalled into the theme root (`useTheme().root`): there it wears the theme variables, and no backdrop-filter ancestor (the sheet) can contain the fixed layer. It is `aria-hidden`, `pointer-events-none`, `fixed inset-0 z-70` and carries `data-effect="confetti"`. Under reduced motion it renders nothing (`useSyncExternalStore` over `matchMedia`, server snapshot "reduce").
- **Trigger** (`src/themes/effects/trigger.ts`): `confettiFor(before, after)` returns `after === "going" && before !== "going"`, with `null` meaning no RSVP.
- **Flow** (`src/app/e/[slug]/rsvp-flow.tsx`): in `send`, after a save, `if (effect === "confetti" && confettiFor(answer?.status ?? null, saved.status))` bumps a counter. `<Confetti key={falls} />` sits first in a fragment in each of the three return branches. The fall therefore mounts with the done step, and leaving or re-entering the done step neither stops it nor replays it. Wrapping the sheet branch in a fragment re-indented that block; there is no other change.
- **CSS** (`src/app/globals.css`, in the `@theme inline` block beside `theme-drift`): `--animate-theme-twinkle`, `--animate-theme-float` and `--animate-theme-sticker-in`, each with its keyframes. I checked the built CSS: each `motion-safe:animate-theme-*` sits under the no-preference media query, and `motion-reduce:hidden` is `display: none`.
- **Preview card**: unchanged. `ResolvedTheme` carries no effect, and a browser test shows the PNG bytes are identical across all four effects.
- **Legibility**: no change to `legibility.ts`. The effects are behind the glass, as the comment above `Backdrop` says.

## Tests and results

TDD (pure rules):
- RED: `pnpm exec vitest run src/themes/changes.test.ts src/themes/effects/trigger.test.ts` before the implementation failed with:
  - `FAIL src/themes/effects/trigger.test.ts`: `Error: Cannot find module './trigger' imported from …/trigger.test.ts`
  - `FAIL src/themes/changes.test.ts > reading a change the drawer sent > accepts every change the drawer offers`: `AssertionError: expected undefined to deeply equal { knob: 'effect', value: 'none' }`
  - `Test Files 2 failed (2)`, `Tests 1 failed | 30 passed (31)`
- GREEN: the same command, `Test Files 2 passed (2)`, `Tests 45 passed (45)`.
- Unit mutation: with `return after === "going"`, the test `from going to going: false` fails.
- Unit tests added: a 14-row table for `confettiFor` (first reply, changes, edits that keep the status, removal). In `changes.test.ts`, the effect knob joins "changing a knob" (sets it, marks dirty), the four values are accepted, and `"fireworks"` and `null` are refused.

Checks: `pnpm lint` clean, `pnpm typecheck` clean (after `rm tsconfig.tsbuildinfo`), `pnpm test` 62 files and 488 tests passed. The only output beyond the results is Vite's existing `configLoader` notice about `vitest.config.ts`, which was there before this task.

Browser, new `e2e/effects.spec.ts` (each test runs at 390 and desktop):
1. A host picks each effect and guests see it (Inline page). Birthday's sparkles show for the host and a guest. Doodles: the shapes show, the sparkles go, and the sticker's computed `rotate` is `-6deg` for host and guest. None: neither layer, and the sticker is straight. Confetti: nothing in the backdrop. After a Going reply the confetti is visible, the guest can tap Edit details through it while it falls, and it is gone within 5 s. An edit that stays Going brings none, Maybe brings none, and a change back to Going brings it again. Another guest's first reply of Maybe brings none, and reloading a page that shows an existing RSVP brings none. Every "none" is an immediate count taken once the confirmation shows, because confetti arrives in the same commit as the confirmation.
2. Under reduced motion (Sheet page, the default): the sparkles and doodles layers are hidden for host and guest; the sticker is `-6deg` from the first and has no animations; after a Going reply there is no confetti.
3. The link's preview card PNG is byte-identical across Sparkles, Doodles, Confetti and None.

`e2e/reduced-motion.spec.ts` now covers each effect: Vows' sparkles are hidden, and `expectStill` runs on the drawer and on the page with them. With Confetti chosen, an Inline Going reply shows no confetti and nothing moving. With Doodles chosen, `expectStill` runs on the drawer and on the guest page (shapes hidden, sticker tilted and still). The poster-mode section then runs with doodles on, so the tilted sticker sits beside the title below the poster.

Browser mutations (on `next dev`, one at a time, each restored), each failing at the step meant to catch it:
- Flow passes `null` as the previous status: fails at "an edit that keeps them Going brings none" (count 1).
- Confetti without `pointer-events-none`: fails at line 92. The tap on Edit details waited for the confetti to land, and the confetti was then gone.
- Confetti ignoring reduced motion: fails at "Confetti never falls" (count 1).
- Doodles without `motion-reduce:hidden`: fails at `toBeHidden`.
- The first two survived the first draft of the spec. `toHaveCount(0)` retried until the fall had ended, and while the modal sheet is open Radix puts `pointer-events: none` on `body`. I fixed the spec: immediate counts, and the tap-through proven on an Inline page.

Definitive browser runs, production build (`pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000, with `drizzle/`, `public` and `.next/static` copied into `.next/standalone` and the Compose dev profile up), `--workers=2`:
- `effects` + `reduced-motion`: 9/9 (operator setup included)
- `design`, `theme`, `rsvp`, `rsvp-sheet`, `poster`, `accessibility`: 67/67
- `keyboard`: 11/11. Not on the dispatch list; I ran it because its focus-ring check reads screen pixels and the default page now sparkles.
- After the last code change (`pointer-events-none` on the two backdrop layers), I rebuilt and reran `effects`, `reduced-motion`, `theme`, `poster` and `design`: 35/35.

One dev-server run of `effects.spec.ts` failed at unrelated waits: a page-load check, and a status-button click that timed out after 90 s. The cause was memory: swap was full and Playwright reported "session closed". I had left out `--workers=2` on that run. With one worker it passed.

## Lighthouse

`pnpm exec playwright test --config playwright.perf.config.ts` against the standalone server, 3 runs per theme and language. Every perf event starts from Birthday, so all eight ran with sparkles on.

| Theme | English | Simplified Chinese |
| --- | --- | --- |
| Curated background, Sheet (Birthday, default) | **94** (94, 94, 94) | **95** (95, 95, 94) |
| Curated background, Inline | 93 (95, 86, 93) | 92 (79, 95, 92) |
| Uploaded photo as background | 96 (88, 96, 96) | 95 (96, 95, 90) |
| Portrait poster | 93 (93, 92, 93) | 91 (94, 91, 91) |

Every median is at least 90, and CLS is 0.000 throughout. The largest paint is the title (or the poster) in every run.

## Files changed

- New: `src/themes/effects/sparkles.tsx`, `src/themes/effects/doodles.tsx`, `src/themes/effects/confetti.tsx`, `src/themes/effects/trigger.ts`, `src/themes/effects/trigger.test.ts`, `e2e/effects.spec.ts`
- Modified: `src/themes/changes.ts`, `src/themes/changes.test.ts`, `src/themes/theme.ts`, `src/themes/themed-page.tsx`, `src/themes/poster-card.tsx`, `src/app/e/[slug]/design-panel.tsx`, `src/app/e/[slug]/rsvp-flow.tsx`, `src/app/globals.css`, `messages/en.json`, `messages/zh-Hans.json`, `messages/zh-Hant.json`, `e2e/reduced-motion.spec.ts`
- Ticket `.scratch/m2-social/issues/11-effects.md`: boxes ticked, status done, dated comment. Not staged.
- **`scripts/measure-backgrounds.ts` is not changed in the commit.** I had added `[data-effect] { display: none }` to its "as the glass sees it" CSS. The script measures backgrounds on a new event, which now sparkles, and I expected white points to raise the measured lightest point. I then tested this, measuring Golden hour and Midnight with the line removed: both still match the stored values to within rounding. The script's `driftTo` pauses the twinkle along with the drift, and its 24 px glass blur flattens a 2-5 px point. The line was not needed, so I reverted it.

## Self-review findings (fixed)

- The sparkles and doodles layers lacked `pointer-events: none`, which the ticket asks of every effect. Added; the affected specs were rerun on a fresh build.
- Two spec assertions could not fail (see the mutations above). Rewritten and re-verified.
- `rsvp-flow.tsx`: the first placement of `<Confetti>` (inside the confirmation, and inside the sheet's root `div`) would have replayed the fall after "Change my answer" followed by coming back to the confirmation, because the component remounted. All three branches now share the shape `<>{confetti}{…}</>`, which keeps the instance.
- The sticker wrapper was first named `DateSticker`, the name of the layout's own component in `poster-layout.tsx`. Renamed to `StickerHolder`.

## Concerns (for the reviewer's judgement)

1. **Accent-filled sticker.** The ticket and the dispatch name only the tilt and the spring. I also fill the sticker with the accent, because the spec says "tilted as in the prototype", PROTOTYPE.md's Effect bullet says "a tilted accent-coloured date sticker", and the prototype's tilted `DateSticker` is the filled one. Removing it means dropping the `ON_ACCENT` style and `text-theme-on-accent` in `StickerHolder`.
2. **The prototype's sparkle formula is not used.** Its hash puts all 26 points on one diagonal across the top half, because each coordinate is linear in the index. I used a proper integer hash so the points scatter, still deterministic and server-rendered.
3. **The flow change is local, but it re-indents the sheet branch** (wrapped in a fragment, so that the confetti keeps its place across steps). Ticket 12 owns the flow refactor; the comment there says what to carry over.
4. **White sparkle points sit behind the glass**, and they are lighter than the backgrounds' measured lightest point. The dispatch accepted this. They are 2 to 5 px and blurred by the glass, and the measurement above shows they do not move the measured extremes.
5. **The confetti flow in `effects.spec.ts` runs on an Inline page.** Under the modal sheet, taps would pass even if the confetti blocked them. The Sheet page is covered by the reduced-motion test and by a visual check (screenshots at both widths: the confetti falls over the open sheet).
6. **`docs/contributing/templates.md` still says effects are "drawn from M2".** I left it for ticket 15, since the spec says the data-file guides gain nothing in M2. Noted in the ticket.

Port 3000 is free. The Compose dev profile is still up, as earlier tasks left it.
