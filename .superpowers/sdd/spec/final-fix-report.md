# Final fix wave on `m1-remaining`: report

Date: 2026-09-26. Five commits on top of `030a81b`. Nothing was amended, pushed, tagged or published.

| Commit | Finding | Subject |
| --- | --- | --- |
| `47ea96e` | 1 | Preview card: a link unfurls in the event's own title face, in Chinese too, and the instance asks no one for a font or an emoji |
| `654fe80` | 2 | Design drawer: the row of templates scrolls on its own, and the panel around it stays still |
| `fbcbb65` | 3 | Browser tests: a test that passes only when it is run again fails the CI run |
| `2df2fe2` | 4 | Release: 1.2, 1 and latest move to a release only once it has started on amd64 and on arm64 |
| `8811af2` | 5 | Docs: the development rate limits, the verification link, the first account's seat and the event page limit are described as they work |

## Checks, on the final tree

| Command | Result |
| --- | --- |
| `pnpm lint` | clean |
| `rm -f tsconfig.tsbuildinfo && pnpm typecheck` | clean |
| `pnpm test` | 47 files, 375 tests passed (5 new). The only other output is Vite's `configLoader: 'native'` notice about `vitest.config.ts`. It was there before this wave: the lockfile change only adds packages, and Vite/Vitest are unchanged. |
| `docker compose --profile test up -d --build --wait && pnpm exec playwright test` | 258 passed (9.2m) |
| `CI=1 pnpm exec playwright test` (retries 1, `failOnFlakyTests`) | 258 passed (9.2m), no flaky test, exit 0 |
| After the last two trivial edits (a comment in `card-fonts.ts`, and `codePointsOf` no longer exported): rebuilt the test profile, then `pnpm exec playwright test e2e/sharing.spec.ts e2e/design.spec.ts e2e/poster.spec.ts e2e/rate-limits.spec.ts` | 43 passed |
| `docker build -t openinvites:local . && deploy/smoke-test.sh openinvites:local` (final tree) | "Smoke test passed" (health ok, uid 1000, sharp 0.35.4 / libvips 8.18.6, reset command reaches the DB) |
| `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest` | 0 errors in 2 files, exit 0 |

## Finding 1: the preview card and the network

**What changed**
- `src/sharing/preview-card.tsx`: `drawPreviewCard(event, theme, when, picture?)` draws the same card layout with `satori` directly, passing no `loadAdditionalAsset`, and turns the SVG into a PNG with `sharp(svg).png()`. The route (`src/app/e/[slug]/preview.png/route.tsx`) returns that PNG with `Content-Type: image/png` and the same Cache-Control as before. `next/og` is no longer imported anywhere.
- `src/sharing/card-fonts.ts`: loads the faces once each and reads each face's cmap (formats 4 and 12) to answer `canDraw(codePoint)`. On all five shipped fonts the reader gives exactly the same code-point sets as fontTools' `getBestCmap()`: 206, 226, 223, 217 and 10,034.
- `src/sharing/card-text.ts` (pure rule, test first): it NFC-normalises and walks grapheme clusters. A space (`\p{Zs}`) that no face has becomes `" "`. Any other cluster with a code point no face has is dropped, ignoring ZWJ, VS15 and VS16, so an emoji goes whole with its skin tone, joiners, keycap or flag. Runs of spaces collapse, and the ends are trimmed.
- Fonts in `src/sharing/fonts/`, each OFL licence next to its face:
  - `instrument-serif-400.ttf` (48,360 B), `bricolage-grotesque-800.ttf` (48,556 B), `syne-800.ttf` (30,964 B) and `fredoka-600.ttf` (35,680 B). Each is unpacked with fontTools from the existing WOFF2 in `public/fonts`, so it has the same Latin subset. 163,560 B in all.
  - `noto-sans-sc-700.otf` (2,230,672 B): Noto Sans SC Bold 2.004 from notofonts/noto-cjk `Sans/SubsetOTF/SC`, cut with `pyftsubset --no-hinting` to U+0020–007E, U+00A0–00FF, U+2010–2027, U+2030–205E, U+3000–303F, U+FF00–FFEF, everything GB 2312's rows hold (A1A1–F7FE, decoded as GBK, private use removed), and Big5's symbols and level-1 characters (A140–A3FE, A440–C67E). That is 10,034 code points, including 8,861 hanzi, and every hanzi of the repertoire is covered. I chose OTF (CFF) because it is 2.2 MB against 3.2 MB for the same subset as TTF from the variable font. It is the whole card's text face (the host's name, the date, and whatever the title face lacks), so one weight is enough; Bold suits the heavy title faces.
  - `OFL-noto-sans-sc.txt` is google/fonts' OFL.txt for Noto Sans SC, with Adobe's copyright line. The four title-face licences are copies of those in `public/fonts`.
  - The recipe (source, ranges, command) is in the `card-fonts.ts` header comment.
- `next.config.ts`: `serverExternalPackages: ["postgres", "satori"]`. Bundled, satori's `harfbuzzjs` looked for `hb.wasm` beside the bundle, and `next dev` failed with ENOENT. `outputFileTracingIncludes` for `/e/\[slug\]/preview.png` adds `./src/sharing/fonts/*`. In the built image both `src/sharing/fonts/*` and `harfbuzzjs/hb.wasm` are present.
- Comments that this change made stale were updated: `src/themes/fonts.ts` (adding a face now also means its card TTF and its entry in `card-fonts.ts`) and `src/uploads/renditions.ts` (the card JPEG no longer mentions next/og).
- Dependency: `satori ^0.33.5` (MPL-2.0), justified in the commit body. It pulls in `@shuding/opentype.js`, `harfbuzzjs` (MIT), `linebreak`, `fflate`, css parsers and so on. The lockfile only adds packages.

**Covering tests**
- `src/sharing/card-text.test.ts` (3 tests, written first and seen failing). They cover drawable text kept; U+2009/U+202F becoming plain spaces while a drawable U+00A0 is kept; "Party 🎂" → "Party"; "🎉 Ada 👩🏽‍💻 turns 30 1️⃣ 🇸🇬!" → "Ada turns 30 !"; and undrawable CJK dropped.
- `src/sharing/preview-card.test.ts` (2 tests):
  1. `fetch` is stubbed to record and throw. The card is drawn for each of the four title faces × "Ada’s birthday 🎂", "陈家的婚宴" and "陳家的婚宴" × no picture or a JPEG data-URL picture, with host "Mei 陈 🌸" and the date `Sat, Mar 6, 2027, 7:00 – 10:00 PM`. Each render must be a 1200x630 PNG (checked with sharp), and the recorder must stay empty.
  2. In every title face the card writes Simplified and Traditional titles whole (陈家的婚宴, 陳家的婚宴, 我們的畢業典禮, 我们的毕业典礼) and the English date whole, and drops the emoji.
- **Why the unit test and not the offline browser test:** it runs in `pnpm test` everywhere, CI included, and observes the network API itself. The browser version would need a new, internal-only Compose network, and Docker does not publish ports from an internal network, so Playwright could not reach the app. I did run the equivalent by hand once, below.
- **Mutation check:** I put `next/og`'s `ImageResponse` back into `drawPreviewCard`, with the text unfiltered. Test 1 then failed: "Failed to load dynamic font for 陈", the thin spaces, and the emoji fetch hit the throwing `fetch`. The file was then restored byte for byte (`cmp`).
- **By hand, in the final image, with no outbound network:** I put `openinvites:local` on an `--internal` Docker network with only the db. From inside the container, `fetch('https://fonts.googleapis.com/...')` failed with `EAI_AGAIN`. The cards still came back `200 image/png`: 109,514 B for "Ada’s 30th birthday 🎂", 133,004 B for "陈家的婚宴 · 陳家的婚宴", and 97,183 B for "小明的生日会 · 小明的生日會 🎉". The app log had no errors. The network was removed afterwards.
- The existing `e2e/sharing.spec.ts` passed in both full runs.

**Card images I looked at**
- English, Birthday template (Instrument Serif): "Ada’s 30th birthday" with the 🎂 dropped; "Saturday, March 6, 2027, 7:00 – 10:00 PM GMT+8" in Noto Sans SC Bold; host in spaced capitals.
- Chinese "陈家的婚宴 · 陳家的婚宴" in Birthday (serif) and Festival (Bricolage). Both scripts are drawn in Noto Sans SC Bold. In Festival the date reads "12:00–3:00 PM" more tightly, because Bricolage has U+2009 and keeps the thin spaces (see concerns).
- Chinese "小明的生日会 · 小明的生日會 🎉" in Kids' party (Fredoka). It wraps to two lines, 會 is drawn, and 🎉 is dropped.
- Poster mode, "Summer fair 夏日市集" (dev) and "Summer fair" (from `poster.spec`'s event in the test-profile image). The poster's card rendition is under the shade, with the Latin title in Instrument Serif and the CJK in Noto Sans SC Bold.
- The same English and Chinese cards from the production image, and from it again with outbound traffic cut off.

**Sizes**
- Fonts added: 2,420,314 B for the folder. Noto Sans SC subset 2,230,672 B, title TTFs 163,560 B, licences about 22 kB.
- Image: 307,938,464 B (HEAD `030a81b`, built for comparison) → 314,781,693 B (final tree), **+6,843,229 B, about 6.8 MB**. Of that, the fonts are 2.4 MB and `harfbuzzjs` 3.2 MB. The trace copies the whole harfbuzzjs package, including a 1.8 MB `test/` folder, `hb-subset.wasm` (596 kB) and a 305 kB logo; `hb.wasm` itself is 382 kB. `@shuding/opentype.js` is 393 kB, `satori` 382 kB, and the small parsers make up the rest.
- A character outside the subset is dropped from the card (never fetched, never a tofu box).

## Finding 2: the drawer scrolling sideways

- **Change:** the `Choices` fieldset in `src/app/e/[slug]/design-panel.tsx` has `className="min-w-0"`, with a comment saying why.
- **Test:** `e2e/design.spec.ts`, "nothing in the drawer scrolls sideways but its row of templates", runs at 390px and at desktop width. It opens the drawer and waits for the slide-in to settle, expands Details, and then collects every element in the dialog with `scrollWidth > clientWidth` and `overflow-x` auto or scroll. It maps each to the number of radios inside and expects `[6]`, the templates row alone. It also checks that Quiet's tile starts past the panel's right edge and is fully inside it after `scrollIntoViewIfNeeded()`.
  - Before the fix it failed at both widths with `[37]`: the panel body, holding every radio, was what scrolled.
  - After the fix, all 13 tests in `design.spec.ts` pass, and the whole suite passes.
- **Screenshot:** `pnpm screenshots` against the Compose test profile; only `docs/screenshots/design-drawer.webp` was kept (45,790 B, before 45,820 B, 1280x800). The four other retaken files were put back with `git checkout --`. A freshly opened drawer looks as it did before (the bug only showed once the panel was scrolled), except for "Starts in 300 days".

## Finding 3: CI retries

- **Change:** `playwright.config.ts` adds `failOnFlakyTests: isCI` and keeps `retries: isCI ? 1 : 0` and `trace: "on-first-retry"`, with a comment.
- **Proof:** a throwaway spec that passes only when `testInfo.retry === 1`, run with `CI=1`, reported "1 flaky" and exited 1. The spec was then deleted. The full suite with `CI=1` passed with no flaky test.

## Finding 4: the release order

- **`publish`** now tags only `type=semver,pattern={{version}}` (1.2.3), plus the labels as before.
- **`smoke-test`** is unchanged. It starts that image by digest on amd64 and on arm64.
- **New `promote` job:**
  - It runs `needs: [publish, smoke-test]` and `if: !contains(github.ref_name, '-')`, so a pre-release gets only its own tag. The implicit `success()` still applies.
  - It uses `packages: write`, the same image-name step (names cannot be job outputs), `setup-buildx`, and both logins.
  - Its `metadata-action` produces `{{major}}.{{minor}}`, `{{major}}` (disabled for `v0.`) and `latest`, and then each tag is moved with `docker buildx imagetools create --tag "$tag" "${tag%:*}@${DIGEST}"`.
- **Semver rules:** these are the tags ticket 19 set, under its rules.
- **Retagging by digest, tried locally:** against a local `registry:2` (a copy of `alpine:3.20` as `:1.2.3`), `imagetools create --tag …:latest …@sha256:d9e8…` gave `:latest` the same index digest.
- **Loop dry-run:** the tag-moving loop was run over a sample `TAGS` list and produced the six expected commands.
- **Docs:** the header comment of `release.yml` and `docs/releasing.md` ("What a tag does") now describe four steps, and what a failed smoke test leaves behind.
- actionlint: 0 errors.

## Finding 5: stale comments and docs

- **`.env.development`:** it now says Next.js fills a missing X-Forwarded-For with the address the request came from, so a browser on this machine is counted as 127.0.0.1 (or ::1).
  - The new wording rests on a test against `next dev` with the dev limit of 40/1m. 42 requests to `/e/AAAAAAAAAB` from 127.0.0.1 gave 40×404 then 429s. A request from `[::1]` was 404, not refused, and so was one from 127.0.0.1 with its own XFF. The warning for a request with no address was never logged.
  - So under `next dev` even the proxy (`src/proxy.ts`) sees the connection's address; see concerns.
- **`src/instance/repository.ts`:** `(seatNewHost below)` → `(seatFirstAccount below)`, the function that clears the claim once the account exists.
- **`src/auth/auth.ts`:** the comment no longer calls email-link tokens single-use. It now says a `/verify-email` token is signed rather than stored, works again until it expires, and that this is harmless today, because by then the address it verifies is verified already, or no longer the account's.
  - I checked this against Better Auth's handler. An already-verified user is just redirected. A change-email token whose old address is gone gives USER_NOT_FOUND.
- **`docs/operator/configuration.md`, `RATE_LIMIT_EVENT_PAGE`:** only the host's own changes in the Design drawer are left out; their visits to the page count, and so does the refresh that shows a picture they have just uploaded. This matches `redrawAllowed` in `e/[slug]/page.tsx`, and the proxy counting GET/RSC requests under `/e/`.

## Bookkeeping

- Appended a dated `## Comments` entry to `.scratch/openinvites/issues/14-sharing.md` (finding 1) and to `21-go-public.md`. The second covers the fixed drawer bug and the retaken screenshot, and notes the fourth release job and the flaky-test gate for its step 8. No Status changed.
- The stack is left as asked: the dev profile's `db` and `mail` are running. The test profile's app and extra database containers are stopped, port 3000 is free, and no dev server is running. The temporary card spec and flaky spec were deleted. The baseline image built for the size comparison was removed.
- Staged by explicit path only. Nothing under `.claude/`, `.superpowers/` or `.scratch/` was staged, and neither was `CONTEXT.md` or `decisions.md`.

## Files changed (`030a81b..HEAD`)

- Finding 1:
  - `package.json`, `pnpm-lock.yaml`, `next.config.ts`
  - `src/app/e/[slug]/preview.png/route.tsx`
  - `src/sharing/preview-card.tsx`, `src/sharing/preview-card.test.ts`
  - `src/sharing/card-fonts.ts`, `src/sharing/card-text.ts`, `src/sharing/card-text.test.ts`
  - `src/sharing/fonts/` (5 fonts, 5 licences)
  - `src/themes/fonts.ts`, `src/uploads/renditions.ts`
- Finding 2: `src/app/e/[slug]/design-panel.tsx`, `e2e/design.spec.ts`, `docs/screenshots/design-drawer.webp`
- Finding 3: `playwright.config.ts`
- Finding 4: `.github/workflows/release.yml`, `docs/releasing.md`
- Finding 5: `.env.development`, `src/instance/repository.ts`, `src/auth/auth.ts`, `docs/operator/configuration.md`

## Concerns

1. **Finding 5, the proxy and addresses.** The ruling said "only the proxy may see no address". Under `next dev` I measured the proxy seeing the connection's address too: 127.0.0.1 and ::1 were counted apart. The new comment claims only what I measured. I did not repeat the measurement against `next start`/standalone. The code path, where base-server fills XFF in `handleRequestImpl` before the middleware-invoke branch, looks the same there.
2. **Finding 4, which tags wait.** `1.2` and `1` now wait for the smoke test along with `latest`. Operators follow them too, and the tag set and its rules are unchanged. `1.2.3` itself is published before the smoke test, as the ruling allows. If the smoke test fails, that tag exists and the fix is a new patch release, which `docs/releasing.md` says.
3. **Image size.** Of the +6.8 MB, about 2.7 MB is harfbuzzjs's test folder, subset wasm and logo, which the file trace copies. An `outputFileTracingExcludes` entry could drop them. I did not add it, to stay inside the wave.
4. **Card typography.** A face that has U+2009 (Bricolage Grotesque) keeps the thin spaces, as the ruling's "wherever the fonts lack them" says, so Festival and Quiet cards read "12:00–3:00 PM" more tightly than the others. Replacing the three spaces unconditionally would make every card the same, if the maintainer prefers that.
5. **Dropped characters are silent.** A character outside the CJK subset, or a title made only of emoji, simply goes missing from the card; nothing marks the gap. The ruling accepts this.
6. **Licence mix.** Satori is MPL-2.0, like the `@vercel/og` that next/og already bundled, so the licence situation does not change.
