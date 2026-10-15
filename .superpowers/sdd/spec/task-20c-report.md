# Task 20c report: performance

Status: DONE_WITH_CONCERNS (every box of the brief is met; the concerns are at the end)

Commits on `m1-remaining`, none pushed:

| Commit | Subject |
| --- | --- |
| `a973ed3` | Performance audit: pnpm perf scores the event page on a mid-range phone on slow 4G |
| `1e8ccf8` | Event page: a guest on a phone gets the invitation first, its title face with it, and pictures at the size the screen needs |
| `7f717a4` | Messages: each page sends the browser only the messages its client components read |
| `0739fd4` | Not found: the proxy asks only whether an event link leads to a page |

Checks: `pnpm lint` clean, `pnpm typecheck` clean, `pnpm test` 366 passed (332 before; 34 new), the full browser suite against the rebuilt production image on the Compose `test` profile 256 passed (248 before; 8 new), and `pnpm perf` passed twice against that image. Each intermediate commit was type-checked and unit-tested on its own in a worktree.

## Method

- `pnpm perf` (below) seeds four kinds of theme through the product and audits each as a guest: Lighthouse 13.5.0, default mobile profile (Moto G Power emulation, 412x823 at 1.75x, slow 4G at 150 ms RTT and 1.6 Mbps, 4x CPU slowdown, throttling simulated), performance category only, a fresh Chromium (Playwright's, 153) per run, three runs in English (`Accept-Language: en-US`) and three in Simplified Chinese (`zh-CN`). The median of the three scores is judged; the table's metrics are the medians of each metric.
- The four themes: a curated background (Golden hour, the default Birthday template) with the Sheet RSVP style (the default) and with the Inline style; a 12-megapixel landscape phone photo (4032x3024, 1.7 MB JPEG) as the background; an A4 poster at 300 dpi (2480x3508, 0.9 MB JPEG) as the poster, title below. Both pictures are drawn by `perf/pictures.ts` from a fixed seed with the grain of a photograph, so the renditions weigh what real ones do (background 249 kB, poster 136 kB). Every event has a title, an end, a location, a 200-character description and two plus-ones.
- Attribution runs were on a local production build (`next build`, standalone server on port 3000 with the `app` service's environment, against the same Postgres and Mailpit); the definitive runs on the image from the Compose `test` profile.
- **The machine's speed moved a great deal during the day.** Lighthouse records a CPU benchmark per run: 600-2400 (median 1800) during the first baseline this morning, 2400-3100 during the attribution runs, 3000-3800 during the definitive runs. With a fixed 4x slowdown, TBT (and so the score) follows it. So I re-measured the baseline image (the HEAD I started from, `da3aba0`, rebuilt from a worktree) in the same sitting as the final image, and the before/after below compares those.

## Baseline and final, production image, same sitting

Median of three (the three scores in brackets). FCP, LCP and Speed Index in seconds, TBT in ms. Bytes are the page's total transfer.

| Theme | Lang | Before | FCP | LCP | TBT | CLS | Bytes | After | FCP | LCP | TBT | CLS | Bytes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Curated, Sheet | en | 95 (95, 95, 95) | 1.37 | 2.85 | 92 | 0 | 247 KiB | 96 (96, 96, 96) | 0.92 | 2.61 | 108 | 0 | 236 KiB |
| Curated, Sheet | zh-Hans | 95 (95, 95, 95) | 1.37 | 2.82 | 61 | 0 | 249 KiB | 96 (96, 96, 96) | 1.15 | 2.55 | 83 | 0 | 236 KiB |
| Curated, Inline | en | 94 (94, 92, 95) | 1.38 | 2.87 | 125 | 0 | 247 KiB | 96 (96, 97, 96) | 0.92 | 2.60 | 120 | 0 | 236 KiB |
| Curated, Inline | zh-Hans | 94 (94, 95, 94) | 1.39 | 2.83 | 68 | 0 | 249 KiB | 96 (96, 88, 96) | 1.14 | 2.55 | 120 | 0 | 236 KiB |
| Photo background | en | 85 (85, 85, 86) | 1.37 | 4.06 | 146 | 0 | 497 KiB | 96 (96, 97, 96) | 0.92 | 2.76 | 68 | 0 | 362 KiB |
| Photo background | zh-Hans | 86 (86, 86, 86) | 1.37 | 4.07 | 109 | 0 | 498 KiB | 96 (96, 96, 96) | 1.23 | 2.71 | 47 | 0 | 363 KiB |
| Portrait poster | en | 88 (88, 88, 90) | 1.38 | 3.47 | 183 | 0 | 384 KiB | 94 (94, 93, 94) | 0.96 | 2.91 | 106 | 0 | 303 KiB |
| Portrait poster | zh-Hans | 89 (89, 90, 87) | 1.38 | 3.47 | 142 | 0 | 385 KiB | 95 (95, 93, 95) | 1.13 | 2.88 | 65 | 0 | 304 KiB |

("After" is the second `pnpm perf` run, printed in full below. The first definitive run, twenty minutes earlier: 96/96, 96/96, 96/96, 94/94, with LCP within 0.05 s of these, FCP within 0.15 s and TBT within 30 ms.)

Largest opportunities, before (median run): "Reduce unused JavaScript" (46-47 KiB, est. LCP 300 ms), "Render-blocking requests" (est. 300-320 ms on the photo and the poster in English), "Legacy JavaScript" (13 KiB), "Page prevented back/forward cache restoration". After: "Reduce unused JavaScript" (46-47 KiB, all in React's and Next.js's own chunks), "Legacy JavaScript" (13 KiB, Next.js's chunk), "Render-blocking requests" (20-60 ms), "Improve image delivery" on the photo's cut (78 KiB) and the 720 poster (45 KiB). The last two judge the files against CSS pixels without the phone's 1.75x density: the cut is 1024x1536 for a screen 721x1440 device pixels tall, the poster 720 wide for a 665-pixel slot. Left as they are.

The first baseline, this morning, on the same image but on a much busier machine (benchmark median 1800): curated Sheet 87/89, Inline 88/83, photo 62/80, poster 84/85; FCP 1.38-1.91 s, LCP 2.91-4.13 s, TBT 231-1095 ms, CLS 0. The largest opportunities then were the same two, with "Minimize main-thread work" (2.5-4.0 s) on top. Same code: the difference is the host's speed.

Where the page spends its bytes, before and after (median run, English, transfer / uncompressed): the document 16.8 / 66 kB and 10.7 / 46 kB; the stylesheet 15.6 / 84 kB and 15.0 / 84 kB; scripts 194 / 614 kB and 189 / 599 kB; the title font 20.8 kB, now preloaded; the photo 250 kB and 127 kB; the poster 136 kB and 67 kB (the 720 poster and the 4.6 kB copy).

## What changed, and what each change gained

Attribution runs on the local production build, each stage adding to the one before (median score, English / Chinese; LCP in s). The local baseline is `da3aba0` built locally.

| Stage | Curated Sheet | Curated Inline | Photo | Poster | What moved |
| --- | --- | --- | --- | --- | --- |
| Local baseline | 92/91, LCP 2.95 | 94/84, LCP 2.85-3.04 | 79/82, LCP 4.07 | 86/86, LCP 3.48 | |
| A: invitation fades from 1% | 92/91, 2.96 | 94/94, 2.88 | 84/84, 4.06 | 89/89, 3.47 | Lighthouse finds the largest paint in every run (before: none on the curated pages); its simulated LCP does not move |
| B: title font preloaded | 93/90, 2.78 | 87/92, 2.76 | 80/84, 4.08 | 89/86, 3.47 | FCP 1.38 → 1.13-1.27 s (en), curated LCP -0.1 s |
| C: messages, photo cut, poster widths and copy, proxy | 94/91, 2.57 | 94/90, 2.51-2.63 | 88/91, 3.19 | 93/91, 2.95 | FCP → 0.97-1.0 s (smaller document); photo LCP -0.9 s (250 → 127 kB); poster LCP -0.5 s (136 → 67 kB) |
| D: backdrop as a low-priority `<picture>` | | | 96/96, 2.75 | | photo LCP -0.45 s |
| E: all of it | 94/96, 2.61 | 96/96, 2.60 | 96/95, 2.75 | 94/94, 2.93 | |
| F: E with every blur removed (experiment, reverted) | 94/95, 2.63 | 94/96, 2.65 | 95/96, 2.80 | 95/95, 2.89 | nothing |

TBT moved between 50 and 310 ms from run to run in every stage, with the host's speed, so none of the score changes of a point or two above are attributable; the LCP and FCP changes are, since Lighthouse's simulation of them is network-bound.

How Lighthouse arrives at LCP matters for reading this: its simulation counts every request that finished before the page was first painted in the fast local trace. On localhost everything finishes before the first paint (this machine takes 100-250 ms over the first layout, below), so every script, the font and any high-priority picture are on the simulated LCP's path. Fewer bytes before the first paint is what moves it, which is what C and D did.

1. **The invitation fades in from 1%** (`src/themes/poster-layout.tsx`). The poster card faded in from opacity 0: Chrome paints it once, invisible, then fades it on the compositor, and never counts an element first painted invisible as the largest paint. Chrome's own LCP entry was then the countdown pill, drawn once the scripts had run, or nothing (seen with a PerformanceObserver: no entry in three of four loads). From 1% the title is the largest paint in the first frame. Lighthouse's simulated LCP did not change, as explained above; what a real phone reports changed. A browser test asserts the first largest paint is in the invitation and at the first paint's time; with the fade from 0 it fails six times in six.
2. **Fonts.** Verified: all five faces are Latin subsets (fc-query: Basic Latin, Latin-1 and a few punctuation marks), one weight each, 14-22 kB of woff2, self-hosted. next/font preloads per route, and the event page imports all four faces (the Design drawer shows them), so it could preload all four or none. The faces now live in `public/fonts` with their `@font-face` rules in `globals.css` (`font-display: swap`; the size-matched fallbacks' figures copied from what next/font computed for these files, so nothing about the fallback changes), and `ThemedPage` calls React's `preload()` for the one its theme uses: `<link rel="preload" as="font" crossorigin>` first in the head. Only that face is ever fetched. FCP fell by 0.1-0.25 s. A browser test checks the head's preload for two fonts, that only that face is fetched, and that every face is `swap`. (I also tried Turbopack's `type: "asset"` rule to keep content-hashed URLs: a JS import gets a URL, but a CSS `url()` to the same file is not rewritten, so the two would not match.)
3. **`public/` in the image** (`Dockerfile`). The standalone output leaves it out, and the Dockerfile never copied it: the four curated scenes (Sunset sea, Bokeh, Aurora, Rose garden) 404ed in the production image, with a 37 kB HTML answer, since ticket 06. The fonts depend on it now. A browser test fetches a scene.
4. **The photo cut for a phone held upright** (`backgroundPortrait`, `background-portrait.webp`). A cover picture on a screen up to 2:3 is scaled to the screen's height, so the screen shows a centred band as wide as itself, never wider than 2:3 of the picture's height. `portraitCut` is that band (unit-tested against five phone sizes and five picture shapes; mutation-checked). A landscape photo's cut is half its pixels; bytes 250 → 127 kB. Photo LCP -0.9 s.
5. **The poster at 720 pixels** (`posterSmall`, `poster-720.webp`) in a `srcset` beside the full poster, `sizes="(min-width: 36rem) 34rem, calc(100vw - 2rem)"` (the card's width), `fetchpriority="high"` as before. 720 serves the audit's phone (380 CSS px at 1.75x is 665), phones at 2x and desktops at 1x; 3x phones and 2x desktops take the 1200. The `srcset` widths come from the poster's stored size (`posterSrcSet`, unit-tested for tall and small posters; a processing test checks the page's arithmetic matches the files made). next/image left the page with it (5 kB of script): it adds its own optimiser's widths, which do not apply to pictures made to size.
6. **The poster's blurred copy from a 192-pixel wash** (`posterCopy`, `poster-copy.webp`, 4-5 kB). It was the full poster file; with the `srcset` it would have been a second 136 kB download on phones that pick the 720. Under a 64-pixel blur nothing finer than about 30 pixels survives, and 192 pixels over the widest screen's 2176 are 11 CSS pixels each. `process.ts` now measures the copy's lightest and darkest points from that very file, scaled and blurred as the page does, so legibility.ts solves against what is shown; the legibility tests and the measurement tests pass unchanged.
7. **The backdrop's picture as a low-priority `<picture>`** (`themed-page.tsx`). It was a CSS background, which Chrome raised to high priority once laid out, ahead of the scripts. Chrome never counts a full-screen backdrop as the largest paint, so its right priority is low: `<img fetchpriority="low" decoding="async">` with `object-fit: cover`, the cut chosen by `<source media="(max-aspect-ratio: 2/3)">`. Pixels compared in Chromium against the CSS background it replaced: identical at 1x (1280x800, 1920x1080), a mean difference of 0.1 of 255 at 1.75x and 3x (0.02% of pixels differ by more than 8). The curated scenes take the same path (mean difference under 0.05). Photo LCP -0.45 s; score 88/91 → 96/96.
8. **Messages** (`src/locale/client-messages.tsx`, `pick-messages.ts`). The root provider now passes `messages={null}`; each page wraps what it renders in `<ClientMessages namespaces={[...]}>`, which picks those namespaces or parts of them (`Events.form`) from the request's messages. The event page passes `EventPage` and `Rsvp`; the Design drawer, rendered only for the host, gets `DesignDrawer` in a provider of its own. The guest's document went from 66 to 46 kB (17 to 11 kB compressed); FCP and curated LCP each about -0.1 s with 4 and 5. The namespaces are typed from en.json (`NamespaceKeys` of next-intl's `Messages`). `client-messages.test.ts` reads the source as the bundler does (static and dynamic imports of the project's own modules; "use client" and everything below it is client code) from every page and layout, and fails when a client component reads a namespace its page does not pass, when a page passes one no client component of it reads, or when a namespace is not a literal. Mutation-checked each way.
9. **The proxy's check** (`eventLinkExists` in `src/events/repository.ts`): one query of two `exists` on the unique slug indexes, instead of the event joined to its host with its theme parsed, plus a second query for an unknown link. Timed against the development database (Postgres in Docker, noisy): median 3.5-4.4 ms → 1.8-3.6 ms for an event's link, 4.9-7.7 → 1.2-3.4 ms for an unknown one. Too small for Lighthouse to see. The brief says "existence and state": the state is not needed, since a draft and a cancelled event each have a page (the not-ready page, the cancelled notice), not a 404.
10. **The blur** (24px `backdrop-filter` on the glass, 64px `blur-3xl` behind a poster and on the gradient's blobs): with all of it switched off by an injected rule, every median was the same within a point (row F). Lighthouse's model counts main-thread and network time; rasterising the blur is the GPU's and does not enter it (main-thread "Rendering" is 24-42 ms scaled for the whole load). So it is not a cost the audit sees, and I did not change it. Scrolling smoothness on a slow phone was not measured.

## `pnpm perf`

`package.json`: `docker compose --profile test up -d --build --wait && playwright test --config playwright.perf.config.ts`. The config runs the browser tests' operator setup (which opens registration), then `perf/event-page.perf.ts` with one worker. `perf/lighthouse.ts` spawns Lighthouse's CLI (`node_modules/lighthouse/cli/index.js`) per run with `CHROME_PATH` set to Playwright's Chromium unless already set, `--chrome-flags=--headless=new --user-data-dir=<a temp dir it removes>` (under WSL, Lighthouse's launcher names a Windows folder that a Linux Chromium creates in the working directory and leaves), `--extra-headers` with the language and an `X-Forwarded-For` of its own per run (the rate limits count per client), and parses the JSON report. Each theme's page is fetched once before the runs, which also checks `<html lang>`. `perf/` is in `.dockerignore`. README's Tests section describes it; README's layout lists `perf/`.

The second definitive run's output (after `docker compose ... up --build`):

```
Running 5 tests using 1 worker

  ✓  1 [operator] › e2e/operator.setup.ts:8:6 › the operator opens registration to everyone (1.7s)
Curated background, Sheet RSVP style, English: performance 96 (runs 96, 96, 96)
  FCP 0.92 s, LCP 2.61 s, TBT 109 ms, CLS 0.000, Speed Index 1.25 s
  largest paint: div.event-page > main.mx-auto > div.border > h1.font-title "Ada’s garden party"
  - Reduce unused JavaScript (Est savings of 46 KiB): LCP 300 ms, 46 KiB
  - Legacy JavaScript (Est savings of 13 KiB): LCP 150 ms
  - Render-blocking requests (Est savings of 20 ms)
  - Page prevented back/forward cache restoration (2 failure reasons)
Curated background, Sheet RSVP style, Simplified Chinese: performance 96 (runs 96, 96, 96)
  FCP 1.15 s, LCP 2.55 s, TBT 83 ms, CLS 0.000, Speed Index 2.88 s
  largest paint: div.event-page > main.mx-auto > div.border > h1.font-title "Ada’s garden party"
  - Reduce unused JavaScript (Est savings of 46 KiB): LCP 300 ms, 46 KiB
  - Render-blocking requests (Est savings of 30 ms): FCP 50 ms, LCP 50 ms
  - Legacy JavaScript (Est savings of 13 KiB)
  - Page prevented back/forward cache restoration (2 failure reasons)
  ✓  2 [lighthouse] › perf/event-page.perf.ts:76:7 › Curated background, Sheet RSVP style (1.2m)
Curated background, Inline RSVP style, English: performance 96 (runs 96, 97, 96)
  FCP 0.92 s, LCP 2.60 s, TBT 120 ms, CLS 0.000, Speed Index 1.26 s
  largest paint: div.event-page > main.mx-auto > div.border > h1.font-title "Ada’s garden party"
  - Reduce unused JavaScript (Est savings of 47 KiB): LCP 450 ms, 47 KiB
  - Legacy JavaScript (Est savings of 13 KiB): LCP 150 ms
  - Render-blocking requests (Est savings of 60 ms): FCP 50 ms, LCP 50 ms
  - Forced reflow
  - Page prevented back/forward cache restoration (2 failure reasons)
Curated background, Inline RSVP style, Simplified Chinese: performance 96 (runs 96, 88, 96)
  FCP 1.14 s, LCP 2.55 s, TBT 120 ms, CLS 0.000, Speed Index 2.90 s
  largest paint: div.event-page > main.mx-auto > div.border > h1.font-title "Ada’s garden party"
  - Reduce unused JavaScript (Est savings of 47 KiB): LCP 300 ms, 47 KiB
  - Forced reflow
  - Legacy JavaScript (Est savings of 13 KiB)
  - Render-blocking requests
  - Page prevented back/forward cache restoration (2 failure reasons)
  ✓  3 [lighthouse] › perf/event-page.perf.ts:76:7 › Curated background, Inline RSVP style (1.2m)
Uploaded photo as background, English: performance 96 (runs 96, 97, 96)
  FCP 0.92 s, LCP 2.76 s, TBT 68 ms, CLS 0.000, Speed Index 1.04 s
  largest paint: div.event-page > main.mx-auto > div.border > h1.font-title "Ada’s garden party"
  - Reduce unused JavaScript (Est savings of 46 KiB): LCP 300 ms, 46 KiB
  - Legacy JavaScript (Est savings of 13 KiB): LCP 150 ms
  - Render-blocking requests (Est savings of 50 ms): FCP 50 ms, LCP 50 ms
  - Forced reflow
  - Improve image delivery (Est savings of 78 KiB)
Uploaded photo as background, Simplified Chinese: performance 96 (runs 96, 96, 96)
  FCP 1.23 s, LCP 2.71 s, TBT 48 ms, CLS 0.000, Speed Index 2.41 s
  largest paint: div.event-page > main.mx-auto > div.border > h1.font-title "Ada’s garden party"
  - Reduce unused JavaScript (Est savings of 46 KiB): LCP 300 ms, 46 KiB
  - Improve image delivery (Est savings of 78 KiB)
  - Legacy JavaScript (Est savings of 13 KiB)
  - Render-blocking requests
  - Page prevented back/forward cache restoration (2 failure reasons)
  ✓  4 [lighthouse] › perf/event-page.perf.ts:76:7 › Uploaded photo as background (1.3m)
Portrait poster, English: performance 94 (runs 94, 93, 94)
  FCP 0.96 s, LCP 2.91 s, TBT 107 ms, CLS 0.000, Speed Index 1.13 s
  largest paint: div.event-page > main.mx-auto > div.@container > img.block "Summer fair poster, 10 July on the villa"
  - Reduce unused JavaScript (Est savings of 46 KiB): LCP 350 ms, 46 KiB
  - Improve image delivery (Est savings of 45 KiB): LCP 300 ms
  - Legacy JavaScript (Est savings of 13 KiB): LCP 150 ms
  - Render-blocking requests (Est savings of 30 ms): FCP 50 ms
  - Page prevented back/forward cache restoration (2 failure reasons)
Portrait poster, Simplified Chinese: performance 95 (runs 95, 93, 95)
  FCP 1.13 s, LCP 2.88 s, TBT 65 ms, CLS 0.000, Speed Index 2.37 s
  largest paint: div.event-page > main.mx-auto > div.@container > img.block "Summer fair poster, 10 July on the villa"
  - Reduce unused JavaScript (Est savings of 46 KiB): LCP 300 ms, 46 KiB
  - Improve image delivery (Est savings of 45 KiB): LCP 150 ms
  - Legacy JavaScript (Est savings of 13 KiB): LCP 150 ms
  - Forced reflow
  - Render-blocking requests
  ✓  5 [lighthouse] › perf/event-page.perf.ts:76:7 › Portrait poster (1.3m)

  5 passed (5.0m)
```

The single 88 among the runs is a run where the host slowed (its benchmark 2770 against 3350-3570 for its neighbours); the median rule absorbs it, as it is meant to.

## Definitive browser run

`fuser -k 3000/tcp`, then `docker compose --profile test up -d --build --wait` (all four app images rebuilt; the image carries `/app/public/backgrounds` and `/app/public/fonts`; `/backgrounds/bokeh.svg` and `/fonts/syne-800.woff2` answer 200 with their types), then `pnpm exec playwright test`: **256 passed (6.7 min)**, nothing else printed. New tests: in `theme.spec.ts`, the head preloads only the title face in use, only it is fetched, every face is `swap`, and a curated scene is served (after the host picks Bokeh and Syne); and the invitation is the first largest paint, in the first frame. In `uploads.spec.ts`, a phone held upright fetches only the cut and a desktop only the whole photo, the cut is the photo's middle at 2:3, and on the phone a screenshot with the cut and one with the whole photo in its place differ by less than 1 of 255 on average; the replace, event-deletion and account-deletion tests now check all six files of an upload. In `poster.spec.ts`, the 720 poster and the copy are made, a 1x screen takes the 720 and the copy and nothing else, a 3x phone takes the full poster and the copy, the poster is `fetchpriority="high"`, and a replaced poster's six files all go. Mutation-checked with rebuilt images: without the `<source>` the phone test fails; without the preload the font test fails; with the fade from 0 the largest-paint test fails.

App log during the run: Better Auth's "User not found" and "Invalid password" warnings from the sign-in tests, and React's "The destination stream closed early" once (seen by 20a and 20b; not from this task). No missing-message errors.

## Files changed

- Audit: `perf/event-page.perf.ts`, `perf/lighthouse.ts`, `perf/pictures.ts`, `playwright.perf.config.ts`, `package.json` (script, `lighthouse` dev dependency), `pnpm-lock.yaml`, `.dockerignore`, `README.md`.
- Page: `Dockerfile`; `public/fonts/*` (moved from `src/themes/fonts/`, with their OFL licences); `src/app/globals.css` (title fonts' `@font-face` and classes); `src/themes/title-fonts.ts`, `fonts.ts` (comment), `themed-page.tsx` (preload; backdrop `<picture>`; copy from the copy file), `poster-layout.tsx` (fade from 1%), `poster-card.tsx` (`<img srcset sizes>`), `resolve.ts` and `resolve.test.ts`, `backgrounds.ts` (`portraitSrc`); `src/uploads/renditions.ts` and new `renditions.test.ts`, `process.ts` and `process.test.ts`, `uploads.ts`; `e2e/theme.spec.ts`, `uploads.spec.ts`, `poster.spec.ts`; `docs/operator/configuration.md`, `upgrade-backup.md` (the six file names).
- Messages: `src/locale/client-messages.tsx`, `client-messages.test.ts`, `pick-messages.ts`, `pick-messages.test.ts` (new); `src/app/layout.tsx`; the pages that render translated client components: `(auth)/forgot-password`, `reset-password`, `sign-in`, `sign-up`, `(host)/account`, `(host)/events/new`, `(host)/events/[id]`, `[id]/share`, `[id]/guests`, `e/[slug]`, `instance`.
- Proxy: `src/events/repository.ts`, `src/proxy.ts`.
- Not committed, as the rules say: `.scratch/openinvites/issues/20-translations-accessibility-performance.md` (Status done, fourth box ticked, the first left unticked for the maintainer's reading, Comments entry). `CONTEXT.md` and `decisions.md` untouched.

## Self-review

- Every brief box: the audit and its medians (above, all eight variants at 94 or more); the script, README, not in CI; responsive images (poster `srcset`/`sizes`, background by media query, new widths in `RENDITIONS`, documented; poster fetched first, background low since it is never the largest paint); fonts verified subset and self-hosted, one preloaded, `swap`; per-page messages with a test that fails on a missing namespace; the proxy's existence query; the blur measured and left, with the reason.
- The look: the backdrop draws the same pixels (measured), the cut draws what the whole photo drew on a phone (tested), the fonts keep their faces, weights and fallback metrics, the copy's legibility is measured from what is shown, and the fade differs only in its first frame (1% where it was 0%).
- Cleanup through `RENDITIONS`: the three new files are removed on replace and on event and account deletion, which the browser tests now check file by file.
- The static messages test is an approximation of the bundler: it follows the project's own imports by regular expression, and checks per page that everything read is passed somewhere on the page, not that each component sits inside the right provider. A client component moved under the Design drawer's provider would pass it; its missing text would show in the browser tests. It fails loudly on anything it cannot read (a non-literal namespace, a list not written out, an import that does not resolve).
- One process note: once, to compare a test run, I used `git stash` and `git stash pop`; that stashed the maintainer's uncommitted `CONTEXT.md` and `decisions.md` edits for a minute. Both came back unchanged (the same 40 insertions and 7 deletions as at the start). I did not do it again.

## Concerns

1. **Scores depend on the host.** Lighthouse's fixed 4x CPU slowdown makes TBT, and so the score, follow the machine: the same image scored 62 to 89 this morning on a busy host and 85 to 95 this afternoon. The final image leaves margin (94 to 96 at a benchmark of 3000-3800), but on a host half as fast the poster, the lowest, could approach 90. The script prints each run's scores so a low one is visible.
2. **`@opentelemetry/api` now reaches the image.** Lighthouse brings `@sentry/node`, and with it `@opentelemetry/api`; pnpm then links that as the optional peer of `next` and `better-auth`, so the standalone output ships it and Next.js loads it in place of its compiled copy. It is the API alone, with no SDK or exporter, so nothing is recorded or sent (ADR-0005), but it is a dev dependency's reach into the production image. `dedupePeerDependents: false` did not prevent it. The maintainer may prefer another way to run Lighthouse (for example `npx`) to keep the lockfile clean.
3. **The backdrop at low priority is a trade.** On slow 4G the host's photo now arrives after the scripts rather than before them: a guest reads the invitation over the base colour a little longer and can answer sooner. The poster, the largest paint, is still first.
4. **Fonts lost their immutable caching.** From `public/` they are served with `max-age=0` and revalidated (a 304) on a returning visit, where next/font's hashed files were cached for a year.
5. **This machine's first layout** takes 100-250 ms on any page, the home page included (about 100 ms of it, measured, is the lookup of the body stack's font names, more for Chinese), which Lighthouse multiplies by four. It is the machine's (WSL with about 2,000 fonts installed), not the page's; I did not change the font stack, which would change the look on desktops.
6. The brief's "existence and state query" became existence only; see change 9.

---

# Fix round 1

Status: DONE. The review's three findings are fixed in new commits; nothing earlier was amended. I did not run `git stash` again.

| Commit | Subject |
| --- | --- |
| `6b73272` | Caching: the title fonts and curated scenes are named after their content and kept for a year |
| `9465e07` | Image: Lighthouse's @opentelemetry/api stays out of the app |
| `6a1a50c` | Performance audit: Lighthouse is told on every run not to report its errors |

## 1. Fonts (and scenes) kept for a year

- Every file in `public/fonts/*.woff2` and `public/backgrounds/*.svg` is renamed to carry the first eight hex digits of its content's SHA-256 before the extension: `instrument-serif-400.5eb09b5a.woff2`, `instrument-serif-400-italic.5a51946d.woff2`, `bricolage-grotesque-800.3e1b5f0a.woff2`, `syne-800.1a340e84.woff2`, `fredoka-600.b62f2898.woff2`; `sunset-sea.66efaaa7.svg`, `bokeh.1de98ced.svg`, `aurora.6e1d45e9.svg`, `rose-garden.f950085a.svg`. References updated in `globals.css` (the five `@font-face` URLs), `title-fonts.ts` (`TITLE_FONT_FILES`), `backgrounds.ts` (the four scenes) and `resolve.test.ts`. The OFL texts keep their names.
- `next.config.ts` `headers()`: `/fonts/:file([^/]+\\.[0-9a-f]+\\.woff2)` and `/backgrounds/:file([^/]+\\.[0-9a-f]+\\.svg)` get `Cache-Control: public, max-age=31536000, immutable`. The pattern matches only hashed names, so anything else in those folders (the OFL texts) keeps Next.js's `public, max-age=0`. **Backgrounds: I chose to hash them too and cache them for a year**, since the same check covers them.
- The guard, `src/themes/public-files.test.ts` (unit test, four cases): every `.woff2` and `.svg` in those two folders is named after its content (the failure says the name it should take); for each of the four title fonts, the file `TITLE_FONT_FILES` preloads is the `url()` of the non-italic `@font-face` whose family that font's class (`.title-font-*`, `--theme-title-font`) names first; every named file exists (each `@font-face` URL, each scene, each preload). Mutation-checked: one byte appended to `bokeh.1de98ced.svg` fails the naming case ("should be named ... bokeh.0be8a7a6.svg"); pointing `TITLE_FONT_FILES.serif` at the italic file fails the agreement case. Restored, both pass.
- Browser test, `e2e/theme.spec.ts` ("a guest's page asks early for its own title font and no other, kept for a year, and a scene background arrives with it"), against the production image: the head preloads exactly one font, named `instrument-serif-400.<8 hex>.woff2`; `GET` of it answers `Cache-Control: public, max-age=31536000, immutable`; the page fetches only that face; every face is `swap`; **on the guest's second visit the face is not fetched again** (its resource entry has transferSize 0: with `max-age=0` it would be a revalidation); after the host picks Syne and Bokeh the preload is `syne-800.<8 hex>.woff2` with the same header, and the scene answers 200, `image/svg+xml`, with the same header.
- Checked on the local production build before the image: `/fonts/syne-800.1a340e84.woff2` and `/backgrounds/bokeh.1de98ced.svg` answer `public, max-age=31536000, immutable`; `/fonts/OFL-syne.txt` answers `public, max-age=0`; `/e/<slug>` still carries `X-Robots-Tag: noindex, nofollow`.

## 2. `@opentelemetry/api` out of the image

- `.pnpmfile.cjs` (new): a `readPackage` hook deleting `@opentelemetry/api` from `peerDependencies` and `peerDependenciesMeta` of `next`, `@better-auth/core` and `drizzle-orm` (vitest keeps it; it never reaches the image). The lockfile now resolves `next@16.3.5(@babel/core@7.29.7)(@playwright/test@1.63.0)(...)` without it.
- That alone was not enough: rebuilt, the server chunks still held `0sj1_@opentelemetry_api_build_esm_index_*.js`. better-auth does `await import("@opentelemetry/api")`, and Turbopack resolved it through pnpm's shared hoisting directory (`node_modules/.pnpm/node_modules/@opentelemetry`), which every package can reach by walking up. So `pnpm-workspace.yaml` also sets `hoistPattern: ["*", "!@opentelemetry/*"]`; @sentry's packages declare their @opentelemetry dependencies and get them linked directly. After a clean `pnpm install --frozen-lockfile` the hoisting directory has no `@opentelemetry`, and the build holds no chunk of the package.
- The Dockerfile's deps stage copies `.pnpmfile.cjs` (pnpm checks the lockfile's `pnpmfileChecksum` against it on a frozen install). I rejected `outputFileTracingExcludes`: it would drop the traced package but not the copy Turbopack bundled into the chunks.
- The image check, `docker run --rm --entrypoint sh <image> -c 'find / -path /proc -prune -o -name "*opentelemetry*" -print'`, on three images built from the same Dockerfile:

```
--- da3aba0 (before ticket 20c)
find: /root: Permission denied
/app/node_modules/.pnpm/next@16.3.5_@babel+core@7.29.7_@playwright+test@1.63.0_@types+node@20.19.43_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/next/dist/compiled/@opentelemetry
/app/.next/server/chunks/ssr/1jdr_next_dist_compiled_@opentelemetry_api_index_10ykr5b.js
--- 0739fd4 (20c before this fix)
find: /root: Permission denied
/app/node_modules/.pnpm/@opentelemetry+api@1.9.1
/app/node_modules/.pnpm/@opentelemetry+api@1.9.1/node_modules/@opentelemetry
/app/node_modules/.pnpm/node_modules/@opentelemetry
/app/node_modules/.pnpm/next@16.3.5_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.63.0_@types+_86b8ab355ef075c06f8f3bca500f8b37
/app/node_modules/.pnpm/next@16.3.5_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.63.0_@types+_86b8ab355ef075c06f8f3bca500f8b37/node_modules/@opentelemetry
/app/node_modules/.pnpm/next@16.3.5_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.63.0_@types+_86b8ab355ef075c06f8f3bca500f8b37/node_modules/next/dist/compiled/@opentelemetry
/app/.next/server/chunks/ssr/0sj1_@opentelemetry_api_build_esm_index_0jebvob.js
/app/.next/server/chunks/ssr/1b9y_next_dist_compiled_@opentelemetry_api_index_019x881.js
/app/.next/server/chunks/0sj1_@opentelemetry_api_build_esm_index_0xy-j06.js
/app/.next/server/chunks/0sj1_@opentelemetry_api_build_esm_index_1yffls4.js
--- the Compose test profile's image now (6a1a50c's code)
find: /root: Permission denied
/app/node_modules/.pnpm/next@16.3.5_@babel+core@7.29.7_@playwright+test@1.63.0_@types+node@20.19.43_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/next/dist/compiled/@opentelemetry
/app/.next/server/chunks/ssr/1jdr_next_dist_compiled_@opentelemetry_api_index_10ykr5b.js
```

  The two paths left are Next.js's own vendored copy of the API (`next/dist/compiled/@opentelemetry`, which its tracer falls back to) and Turbopack's chunk of it. They are part of the `next` package, were in the image before this ticket, and are identical in name to the `da3aba0` image. So "no `@opentelemetry` at all" holds for the package Lighthouse brought; removing Next.js's own copy would mean patching Next.js, which I did not do.

## 3. Lighthouse error reporting

`perf/lighthouse.ts` passes `--no-enable-error-reporting` on every run. The comment now says that Lighthouse reports its own errors to its makers when a user once said yes, an answer it keeps in its settings (`cli/sentry-prompt.js`, via configstore), so every run says no on its command line. Also, not from the review: `playwright.perf.config.ts` sets `reportSlowTests: null`, because Playwright advised running the audit's single long file in parallel, which would have the audits measure each other.

## Commands and their output

- `pnpm lint`: clean. `pnpm typecheck`: clean. `pnpm test`: 45 files, **370 passed** (4 new, in public-files.test.ts).
- Covering specs on the local production build: `pnpm exec playwright test e2e/theme.spec.ts e2e/uploads.spec.ts e2e/poster.spec.ts e2e/design.spec.ts`: **37 passed**.
- `fuser -k 3000/tcp`, then `docker compose --profile test up -d --build --wait` (all four app images rebuilt with the pnpmfile), then the image check above, then `pnpm exec playwright test`: **256 passed (6.0 min)**, nothing else printed. The app log shows React's "The destination stream closed early" (as 20a and 20b saw) and no missing-message errors.
- `pnpm perf` on that image: every median passes, and the numbers are those of the run before the fix (the host was a little slower this time, benchmark 2100-3500):

```
Curated background, Sheet RSVP style, English: performance 95 (runs 94, 95, 95)
  FCP 0.96 s, LCP 2.61 s, TBT 149 ms, CLS 0.000, Speed Index 1.40 s
Curated background, Sheet RSVP style, Simplified Chinese: performance 95 (runs 92, 96, 95)
  FCP 1.29 s, LCP 2.57 s, TBT 123 ms, CLS 0.000, Speed Index 2.98 s
Curated background, Inline RSVP style, English: performance 94 (runs 96, 94, 94)
  FCP 0.95 s, LCP 2.61 s, TBT 190 ms, CLS 0.000, Speed Index 1.39 s
Curated background, Inline RSVP style, Simplified Chinese: performance 96 (runs 96, 96, 96)
  FCP 1.17 s, LCP 2.53 s, TBT 77 ms, CLS 0.000, Speed Index 2.92 s
Uploaded photo as background, English: performance 96 (runs 91, 96, 96)
  FCP 0.94 s, LCP 2.76 s, TBT 104 ms, CLS 0.000, Speed Index 1.08 s
Uploaded photo as background, Simplified Chinese: performance 95 (runs 95, 95, 95)
  FCP 1.36 s, LCP 2.77 s, TBT 97 ms, CLS 0.000, Speed Index 2.42 s
Portrait poster, English: performance 94 (runs 93, 94, 94)
  FCP 0.94 s, LCP 2.93 s, TBT 133 ms, CLS 0.000, Speed Index 1.01 s
Portrait poster, Simplified Chinese: performance 94 (runs 94, 92, 95)
  FCP 1.28 s, LCP 2.89 s, TBT 105 ms, CLS 0.000, Speed Index 2.48 s
  5 passed (5.3m)
```

  (That run still printed Playwright's slow-file advice; the `reportSlowTests` change came after it and touches only reporting.)

## Files changed in this round

`.pnpmfile.cjs` (new), `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `Dockerfile`, `next.config.ts`, `public/fonts/*.woff2` and `public/backgrounds/*.svg` (renamed), `src/app/globals.css`, `src/themes/title-fonts.ts`, `fonts.ts`, `backgrounds.ts`, `resolve.test.ts`, `public-files.test.ts` (new), `e2e/theme.spec.ts`, `perf/lighthouse.ts`, `playwright.perf.config.ts`. The ticket's Comments has a fix-round entry, and the two open notes in the first entry are marked fixed.

## Concerns

- Next.js's own compiled `@opentelemetry` copy stays in the image, as it always has (above).
- A contributor who changes a font or a scene must rename it. The unit test says the new name, and `sha256sum <file> | cut -c1-8` gives it.
- On this machine a plain `pnpm install` recorded the new `hoistPattern` but left the hoisted `@opentelemetry` links in place; they went only after I deleted `node_modules` and reinstalled. A development machine that installed before this commit keeps them, and a local `next build` there would still bundle the API, until it reinstalls from scratch. The Docker build and CI always install from scratch, so the image is not affected.
