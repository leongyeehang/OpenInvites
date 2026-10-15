# Task 20b report: accessibility and reduced motion

Status: DONE_WITH_CONCERNS (all five brief boxes satisfied; see "Fix round 1" at the end for the review fixes).

Commits on `m1-remaining` (BASE `2924e93`):

- `5bbc036` Accessibility: every page reads to a screen reader, the invitation works by keyboard alone, and nothing moves under reduced motion
- `b7a1e21` Not found: a link that leads nowhere is answered with a page drawn on the server, in the visitor's language

Ticket 20: boxes 2 (accessibility checks, keyboard, alternative text) and 3 (reduced motion) ticked; `**Status:**` left at `ready-for-agent` for 20c; a dated Comments entry appended.

## What I implemented

1. **axe-core in the normal browser suite.** `@axe-core/playwright@4.13.0` is the only new dev dependency. `e2e/axe.ts` exports `expectNoSeriousViolations(page, where)`, which every spec uses:
   - it waits for every finite animation to finish (the backdrop's infinite drift is ignored);
   - it runs all of axe's rules (no tag filter, so best-practice rules too);
   - a serious or critical violation fails via `expect.soft`, so one run lists every failing page;
   - it records the counts by impact as a test annotation (`type: "axe"`), which is where the tables below come from.
2. **`e2e/accessibility.spec.ts`** (8 tests × 2 projects, 50 checks per project):
   - pages anyone can open: home, sign-up, sign-in, forgot password, privacy, terms, too fast, an unknown event link, an unmatched address;
   - the host's pages: the dashboard (empty and with an event), the event form (creating, with a question added, and editing), the share screen, the guest list (and a guest opened for editing);
   - the instance settings, as the operator;
   - the Design drawer, open with Details expanded, in the light and dark tones; it is the bottom sheet in the 390px project and the side panel at desktop;
   - the host's picture as the background (dark tone by itself, then light) and as the poster (light, dark, title on the poster), with the drawer showing the upload section;
   - a draft as a guest sees it, and as its host sees it in both tones;
   - a cancelled event in both tones;
   - both RSVP styles, every step (buttons, name, plus-ones, questions) and the confirmation, in both tones.
3. **Focus rings solved by `legibility.ts`.** There is a new `focusRing` token, plus `sheet.focusRing`. It is the accent moved towards the tone's text until it reaches 3:1 (`NON_TEXT = 3`, solved at 3.1) on every surface in `SURFACES` and `SHEET_SURFACES`.
   - It is exposed as `--theme-focus-ring` by `themeVariables` and `sheetVariables`.
   - `globals.css` rings `.event-page :focus-visible` with it: 2px, offset 2px, in the components layer.
   - The RSVP buttons and the Design button sit on the bare backdrop, so they ring inside instead (`focus-visible:outline-current focus-visible:-outline-offset-4`), in their own label's colour, which already reads at AA on their own surface.
   - The fields' accent box-shadow ring was removed in favour of the shared ring.
4. **`e2e/keyboard.spec.ts`** (3 tests × 2 projects), key presses only:
   - the guest flow in the Inline and Sheet styles: Going, a name, +1 with a named plus-one, a required question, Send;
   - the drawer: tab through the whole invitation to the Design button, arrow from Birthday to Vows, change the background, open Details and change the text tone, Escape, with focus back on the Design button;
   - every Tab stop asserts a visible focus indicator: an outline of at least 2px or a box-shadow, on the element or on the label it sits in.
5. **Reduced motion.** One rule in `globals.css` under `prefers-reduced-motion: reduce` sets `*, ::before, ::after { animation: none !important; transition: none !important; }`.
   - `e2e/reduced-motion.spec.ts` is one test × 2 projects, with the `reducedMotion: "reduce"` context option.
   - It visits the public pages, the dashboard, the event form with the delete dialog open and closed, the drawer through a template and a knob, the event page, the RSVP sheet from open to confirmation to closed, the guest list, the share screen, and the instance settings.
   - After each step it asserts that `document.getAnimations()` is empty and that no element (nor its `::before`/`::after`) has a non-zero animation or transition duration.
6. **Parked notes** (the full list is below): templates as a radio group, the upload hint described, the QR label carrying the link, the rich-text toolbar's `aria-pressed` and a clickable label, the questions editor as a named fieldset, and "(Required)" as text beside the asterisk.
7. **Not-found pages rendered on the server with `lang`.** The cause and the fix are below.

New strings: `Events.share.qrLabel` now takes `{link}` ("QR code for {link}", "{link} 的二维码", "{link} 的 QR 碼"), and `Rsvp.questions.required` is "Required" / 必填 / 必填, pairing with the existing 选填/選填. All three files are complete; the translation structure test passes.

## axe results per page, before and after

Counts are critical/serious/moderate/minor.
- "Before" is the product at BASE `2924e93`, measured with the final helper (half-screen colour contrast on pages with a fixed backdrop), against the dev server.
- "After" is the committed tree against the production image on the Compose test profile.
- "not in the baseline" marks rows added after the baseline run: the dark tone for the draft and the cancelled page.
- "not run" marks the desktop cancelled page, which the baseline run did not reach: the dev server was slow to publish.

| Page | Before 390px | Before desktop | After 390px | After desktop |
| --- | --- | --- | --- | --- |
| / | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| /sign-up | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| /sign-in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| /forgot-password | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| /privacy | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| /terms | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| /too-fast | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| /e/abcdefghij (not found) | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| /no-such-page | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| the dashboard, empty | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| the event form, creating | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| the event form, editing | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| the dashboard, with an event | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| the share screen | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| the guest list | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| the guest list, editing a guest | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| the instance settings page | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| the Design drawer, light tone | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| the Design drawer, dark tone | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| the Design drawer, with the host's picture | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| event page, picture as background, dark tone | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| event page, picture as background, light tone | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| event page, poster mode, light tone | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| event page, poster mode, dark tone | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| event page, poster mode, title on the poster, dark tone | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| a draft, as a guest sees it | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| a draft, as its host sees it, light tone | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| a draft, as its host sees it, dark tone | not in the baseline | not in the baseline | 0/0/0/0 | 0/0/0/0 |
| a cancelled event, light tone | 0/0/0/0 | not run | 0/0/0/0 | 0/0/0/0 |
| a cancelled event, dark tone | not in the baseline | not in the baseline | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, light tone: the RSVP buttons | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, light tone: the name step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, light tone: the plus-ones step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, light tone: the questions step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, light tone: the confirmation | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, dark tone: the RSVP buttons | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, dark tone: the name step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, dark tone: the plus-ones step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, dark tone: the questions step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Inline RSVP, dark tone: the confirmation | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, light tone: the RSVP buttons | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, light tone: the name step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, light tone: the plus-ones step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, light tone: the questions step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, light tone: the confirmation | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, dark tone: the RSVP buttons | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, dark tone: the name step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, dark tone: the plus-ones step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, dark tone: the questions step | 0/1/0/0 | 0/1/0/0 | 0/0/0/0 | 0/0/0/0 |
| Sheet RSVP, dark tone: the confirmation | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |

The real violations before:
- **Event form editing and guest list editing:** `color-contrast` on `.bg-destructive/10`, the destructive button. Its text was 3.99:1 on its 10% tint (computed).
- **Every stepper step:** `aria-prohibited-attr` on `div[aria-label="Step N of M"]`.

My first baseline, with a single axe pass, also reported serious `color-contrast` on the event page in the light tone. Those were false positives (next section).

## Excluded rules

None. No axe rule is disabled or excluded anywhere.

One false positive is handled without excluding anything. axe's `color-contrast` builds its background stack from a grid in which each element sits at its current `getBoundingClientRect`. This is `createGrid` in axe-core 4.13.0, which I read.
- The event page's backdrop is `position: fixed; inset: 0`, so in that grid it only covers the screenful in view.
- Text further down the page was measured against the body's white. For example, the footer on the veil read as 3.15:1 over `#847d8d`, which is the veil at 0.54 over white.
- Proof: after scrolling to the bottom, the flagged set flipped to the top of the page, and the bottom was clear.

`e2e/axe.ts` detects a fixed element covering the whole viewport. On such pages colour contrast is re-run half a screen at a time, and only verdicts on text wholly on screen are kept. Every other rule, and every other page, is read once.
- Mutation check: disabling the slicing brings the false positives back.
- I searched for an axe-core issue to cite and found none that matches, so the comment explains the mechanism instead.
- The slicing only applies to such pages because the instance settings page is 8,873px tall on the persistent test database. Slicing it made axe time out in my first definitive run.

## TDD evidence for the extended legibility rule

RED: the tests were written first (`src/themes/legibility.test.ts`):
- the ring checked on every surface in `expectEveryTextReads`, which covers every background × tone × accent, uploads and posters;
- the sheet's ring checked over white, black and the backdrop;
- a new `describe("the focus ring")`: it is the accent where the accent stands out, it moves only as far as needed, and the sheet solves its own.

```
$ pnpm exec vitest run src/themes/legibility.test.ts
 FAIL  src/themes/legibility.test.ts > every combination the drawer offers > reads at AA on golden in the light tone
 ... (18 background × tone cases, 2 upload, 2 poster, the sheet, and the 3 new focus-ring cases)
 Test Files  1 failed (1)
      Tests  26 failed | 15 passed (41)
```
(`tokens.focusRing` was undefined, so `contrast()` threw; `NON_TEXT` was not exported.)

GREEN, after adding `NON_TEXT`, `RING_TARGET`, the `focusRing` / `sheet.focusRing` tokens and the solve in `strengthsOn`:
```
$ pnpm exec vitest run src/themes/legibility.test.ts
 Test Files  1 passed (1)
      Tests  41 passed (41)
```

Mutation checks:
- `RING_TARGET = 1`, so the ring stays the raw accent: 25 failed.
- Solving on only the first surface: 7 failed.
- Both were restored; 41 pass.

The full unit suite gives 332 passed. One existing test that pins the sheet's variables was updated to include `--theme-focus-ring`.

What the ring is on each background with its own accent (`focusRing` / `sheet.focusRing`):

| Background | Tone | Accent | Page ring | Sheet ring |
| --- | --- | --- | --- | --- |
| golden | light | #ffc36b | #ffc36b | #ffc36b |
| golden | dark | #ffc36b | #5c4441 | #5c4441 |
| dusk | light | #ff8fc0 | #ff9ac6 | #ff99c6 |
| dusk | dark | #ff8fc0 | #663a60 | #663a60 |
| forest | light | #8fe6c2 | #8fe6c2 | #8fe6c2 |
| forest | dark | #8fe6c2 | #3b4c59 | #3b4c59 |
| midnight | light | #a5b4fc | #adbbfc | #acbafc |
| midnight | dark | #a5b4fc | #464471 | #464471 |
| sunset-sea | light | #ffcf6b | #ffcf6b | #ffcf6b |
| sunset-sea | dark | #ffcf6b | #5a4541 | #5a4541 |
| bokeh | light | #ffb26b | #ffb26b | #ffb26b |
| bokeh | dark | #ffb26b | #5f4142 | #614242 |
| aurora | light | #7ef0c8 | #7ef0c8 | #7ef0c8 |
| aurora | dark | #7ef0c8 | #354c59 | #354c59 |
| rose | light | #ff9ec7 | #ffa0c8 | #ffa1c9 |
| rose | dark | #ff9ec7 | #613c5f | #633d60 |
| slate | light | #d9d9e3 | #d9d9e3 | #d9d9e3 |
| slate | dark | #d9d9e3 | #4c445f | #4e4660 |

## What changed in the look

Checked with screenshots in both text tones at 390px and 1280px.

- **RSVP buttons:** on focus, a 2px ring inset 4px, in the label's own colour: white in the light tone, deep plum in the dark. It used to be a 2px accent ring outside, with a transparent offset, over the backdrop, which could be anything.
- **Fields, chips, the calendar and map links, footer links, the language buttons, the back and close buttons, and links in the description:** a 2px outline 2px outside, in the solved ring colour.
  - In the light tone this is the accent, as before.
  - In a forced dark tone it is a deep shade of the accent.
  - Previously most of these had only the browser's own 1px auto ring in `--ring` at 50%.
- **Design button:** inset ring in its own label's colour, instead of neutral-500 outside over the backdrop.
- **Host area:** the destructive red is darker (`oklch(0.49 0.2 27.5)`, which replaces `--red-500`).
- **Rich-text toolbar:** a pressed toggle has a light `bg-muted` fill.
- **Questions editor:** the label is now a legend, spaced as before.
- **Template tiles:** look unchanged. The focus outline is now on the tile's label.
- **Drawer rings:** measured at 3.33:1 to 3.79:1 against the panel (95% neutral-900 over white, the light base or the dark base) and 3.28:1 on a tile. Left unchanged.

## Not-found: the cause and the fix

I read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`, `04-functions/not-found.md`, the `loading.md` status-code section, and the error-handling guide.

**The cause is in Next.js / React, not in our code.**
- React's server renderer (Fizz) has no error boundaries: `getDerivedStateFromError` appears 0 times in `react-dom-server.node.production.js`.
- So a `notFound()` thrown during a document render, outside any Suspense boundary, fails the shell.
- `app-render.js` then catches it, sets 404, and renders `getErrorRSCPayload`, whose seed is literally `<html id="__next_error__"><head/><body/></html>`.
- The client sees the id and client-renders from the original flight data (`app-index.js`: "Server rendering failed, fall back to client-side rendering").

**A bare Next.js 16.3.5 app reproduces it.** In the scratchpad I built one with only a root layout, `not-found.tsx` and a page calling `notFound()`: `/x` and `/y` served `<html id="__next_error__">`, while an unmatched `/nosuch` served `<html lang="en">`.

**Why the other routes behave differently:**
- Unmatched URLs render Next's `/_not-found` route directly, with the not-found component as the page, so nothing throws.
- Under a `loading.tsx` or Suspense boundary, the shell gets `lang`, but the not-found content is still client-rendered, and the status becomes 200. I tested this too.
- Next only re-renders with `createNotFoundLoaderTree` for server-action results.

**The fix, in `src/proxy.ts`.** For document requests (GET or HEAD without the `RSC` header), the proxy asks each page that ends in `notFound()` its own question:
- `/e/<slug>`: not a slug, or neither an event nor a retired slug;
- `/events/<id>`, `/share`, `/guests`: a signed-in host whose event it is not (signed-out visitors are left to the page's sign-in redirect);
- `/instance`: not the operator.

It then rewrites the request to `/_not-found` with status 404. This is the route Next itself uses for unmatched URLs, and it matches the docs' advice to run 404 checks in proxy.

Details of the fix:
- The rate limit still runs first under `/e/`, so a refused request still gets too-fast.
- Path segments are decoded safely: a malformed escape still gets a 404, not a 500.
- The pages keep their own `notFound()`, which client navigations use.
- `app/not-found.tsx` gains `generateMetadata` (title "Page not found"). Before, `/no-such-page` was titled "OpenInvites", and the rewrite would otherwise have regressed `/e/unknown`'s title.
- The analytics marker and `AnalyticsFallback` are removed (`src/components/analytics.ts` and `analytics-fallback.tsx` are deleted). The layout injects the snippet as given, and the analytics tests pass unchanged.

`e2e/test.ts`'s `expectNotFoundAsSent(response, { lang, heading })` asserts 404, `<html lang=...>`, and the `<h1>` in the served HTML with scripts stripped. It is used on:
- unknown event links, including a not-a-slug and a `zh-TW` visitor (`lang="zh-Hant"`, 找不到頁面);
- a deleted event's link;
- mistyped host event pages;
- `/instance` signed out and signed in.

## The definitive browser run (Compose test profile)

- Stopped the dev server (`fuser -k 3000/tcp`), then ran `docker compose --profile test up -d --build --wait`; every service was healthy.
- `pnpm exec playwright test`:
  - First run: 242 passed, 2 failed. Both were `accessibility.spec.ts`'s instance settings test: an axe timeout on the 8,873px page. I fixed the helper as above.
  - Rerun: **244 passed (5.9m)**.
  - After the commits, the committed tree against the same image: **244 passed (6.0m)**. The image postdates every file under `src/`, `messages/` and `public/`, checked with `find -newermt`.
- 24 of the 244 tests are new: accessibility 8×2, keyboard 3×2, reduced motion 1×2.
- `pnpm lint` is clean; `pnpm typecheck` is clean (after `rm -f tsconfig.tsbuildinfo`); `pnpm test` gives 332 passed.
- The app log from the run holds only lines already seen before this part: React's "The destination stream closed early" (11 times, which 20a also saw), and Better Auth's "User not found" / "Invalid password" from tests that fail sign-in on purpose.
- The dev server was stopped, and port 3000 is served by the test profile's `app` container.

## Files changed

`5bbc036` (24 files):
- e2e: `axe.ts` (new), `accessibility.spec.ts` (new), `keyboard.spec.ts` (new), `reduced-motion.spec.ts` (new); `design.spec.ts` (templates are radios), `description.spec.ts` (clickable label, aria-pressed), `sharing.spec.ts` (QR name).
- `package.json`, `pnpm-lock.yaml`.
- `messages/en.json`, `zh-Hans.json`, `zh-Hant.json`.
- `src/app/globals.css`: destructive red, reduced motion, the event page's focus ring.
- `src/themes/legibility.ts` and its test, `resolve.ts` and its test, `rsvp-buttons.ts`.
- `src/app/e/[slug]/rsvp-flow.tsx`, `design-panel.tsx`, `design-drawer.tsx`.
- `src/app/(host)/events/description-editor.tsx`, `questions-editor.tsx`, `[id]/share/page.tsx`.

`b7a1e21` (10 files):
- `src/proxy.ts`, `src/app/not-found.tsx`, `src/app/layout.tsx`.
- Deleted: `src/components/analytics.ts`, `src/components/analytics-fallback.tsx`.
- e2e: `test.ts` (`expectNotFoundAsSent`), `events.spec.ts`, `instance-settings.spec.ts`, `cancel-delete.spec.ts`, `legal-and-analytics.spec.ts` (comment).

Not staged, as required: `.scratch/openinvites/issues/20-…md` (edited), `CONTEXT.md`, `decisions.md`, `.claude/`, `.superpowers/`.

## How each parked note was resolved

| Note | Resolution |
| --- | --- |
| Template tiles use `aria-pressed` buttons (task 10 review) | **Fixed.** A radio group (fieldset, legend, hint), like every other drawer group. The clean template is checked, none is when dirty, and re-choosing applies it afresh. |
| Focus rings on the accent and in the sheet never checked for 3:1 (tickets 10, 11) | **Fixed.** `legibility.ts` `focusRing` / `sheet.focusRing`; inset own-colour rings on the backdrop controls. |
| Disabled Continue at 50% accent (tickets 07, 11) | **Ruled out.** Inactive components are exempt (WCAG 1.4.3, 1.4.11) and axe exempts them. It is disabled only until a name is typed. |
| "Remove my RSVP" accent on glass (ticket 07) | **Already solved** by `accentInk` at AA on the card and sheet; axe checks the confirmation in both tones. |
| Golden hour secondary text (ticket 06) | **Settled by ticket 10**; axe finds nothing. |
| Upload hint not tied to its file input (task 12 review) | **Fixed.** `aria-describedby` points at the hint, or at the problem that replaces it. |
| QR code has no text alternative carrying the link (ticket 14) | **Fixed.** "QR code for {link}" in all three languages. |
| Countdown not announced (ticket 15) | **Decided: not announced.** A live region would interrupt every 30s or every minute. The countdown is in the reading order under the date. |
| Rich-text toolbar lacks `aria-pressed`; editor labelled by `aria-label` (ticket 17) | **Fixed.** `aria-pressed` follows `selectionchange` via `queryCommandState`, with a visible pressed fill. The visible label names the editor (`aria-labelledby`) and focuses it on click. |
| Guest list status dots and locked discs (ticket 08) | **Ruled out.** The dots are decoration and the status is in words. The faint word is solved at AA and axe agrees. The locked discs are placeholders by design, and the lock line says what to do. |
| Questions editor group label points at nothing; asterisk has no text equivalent (ticket 09) | **Fixed.** A fieldset named by a legend; the asterisk is `aria-hidden` plus visually hidden "(Required)". |
| Alt text field and `role="img"` description not audited (ticket 12); poster alt not checked (ticket 13) | **Covered.** axe checks the drawer with the upload section; accessible-name assertions for both modes. |
| Themed footer contrast on a light theme; legal prose (ticket 18) | **Checked by axe** on every event page in both tones and on both legal pages: nothing. |
| Footer switcher small buttons and the browser's ring (20a) | Now takes the themed ring. About 28px tall, above the 24px target. The current language is shown by weight and `aria-current`, not colour alone. The CJK title font is not an accessibility matter. |
| `notFound()` served as `__next_error__` without `lang` (ticket 18 review) | **Fixed** (above); the analytics marker and fallback are removed. |

## Self-review and concerns

Self-review:
- Every new string is in all three files.
- No `CONTEXT.md` avoid-words are used in copy.
- Tests observe only what a person or the browser sees: roles, names, focus, computed styles and served HTML, never rows.
- Pure-rule tests stay in Vitest.
- Comments match the code's current behaviour; I checked the proxy, axe helper and legibility comments against the diff.
- Nothing I created is orphaned: the `Heading` helper, `--red-500`, and the analytics files are all gone.
- The existing `motion-safe:` / `motion-reduce:` classes are left in place. They are harmless but now redundant with the global reduced-motion rule, and I did not remove pre-existing code.

Concerns:
1. **The host area's focus ring is below 3:1.** shadcn's `focus-visible:ring-ring/50` gives about 1.5:1 on white, and `border-ring` 2.6:1. I read the brief's "every control" as the RSVP flow, the themed event page and the drawer, which are the box's subjects, and left the host look alone.
   - A darker light `--ring` (e.g. neutral-800) would fix it in one token, but it changes the host area's look.
   - The maintainer's call. Say if you want it in this ticket.
2. **The proxy's check duplicates the pages' own logic.** It asks each notFound page's question itself, commented page by page.
   - If a page gains a new not-found condition and the proxy is not updated, that page falls back to the browser-built 404 (still 404, still correct after JS).
   - An event page document request now does one more indexed slug lookup, and a host event page one more session and event lookup: small, but relevant to 20c.
3. **Behaviour changes worth a look:**
   - Template radios move with arrow keys and apply as you arrow, like the other drawer groups.
   - After an Inline RSVP is sent, focus falls to the page body; the next Tab lands in the confirmation. I left this, and noted it in the ticket.
4. **Route handlers answer unknown tokens with an empty 404 body:** `/r/<token>` (edit link) and `/host-invitation/<token>`. This is noted for later and is not the `__next_error__` case.
5. **Pre-existing noise:** Vitest prints a Vite "configLoader: native" warning about `vitest.config.ts` on every run. It predates this part.

---

# Fix round 1

Commits, new, on top of `b7a1e21` (nothing amended):

- `9f0818b` Focus: once a guest has answered, the focus is on what their answer says, and every focus ring stands out at 3:1
- `09d2455` Not found: /events/new/share and /events/new/guests are drawn on the server too
- `6cf45c6` Accessibility checks: what axe could not measure is counted, and reduced motion covers every page
- `da3aba0` Accessibility checks: the first view's contrast comes from the run of every rule

## 1. Focus after Send, Remove and Change (Important)

**What I chose:** focus moves to the confirmation's heading, and there is no live region. Focusing the heading makes a screen reader read it, so a live region as well would say it twice.

What changed (`src/app/e/[slug]/rsvp-flow.tsx`):
- **After Send:** the confirmation's line ("You're going!") is now an `h2` with `tabIndex={-1}` and `outline-none`. It is not a control, so it gets no ring. A `focusNext` ref is set as the answer is saved, and one effect after the step changes moves focus to that heading, in both styles (`preventScroll` in the sheet, which is fixed to the screen).
- **After Remove, or "Change my answer" (the same bug):** focus moves to the status button of the draft (Going after Remove). This is Inline only; the sheet closes, and its own `onCloseAutoFocus` handler already returned focus to the buttons.
- **After "Edit details":** unchanged. The name field already takes focus on arrival.

Covering tests (`e2e/keyboard.spec.ts`, both styles):
- after Send: `expect(flow.getByRole("heading", { name: "You’re going!" })).toBeFocused()`;
- then Tab to "Remove my RSVP", Enter: `expect(page.getByRole("button", { name: "Going" })).toBeFocused()`, plus the visible-focus check.

Mutation: with the two `focus()` calls removed, both styles fail (`Locator: getByRole('heading', { name: 'You’re going!' }) … Received: inactive`).

## 2. Host-area focus rings at 3:1 (Important, spec)

**The host pages do not follow the device's colour scheme.** `.dark` is only a class: nothing in the app sets it from `prefers-color-scheme`, and it is used on the Design drawer and the Design button alone. So "both system themes" is the light host pages under either scheme, plus the `.dark` surfaces. The test runs under both emulated schemes.

The tokens (`src/app/globals.css`); components keep their `ring-ring/50` and `outline-ring/50`:

| Token | Was | Now | At 50% against |
| --- | --- | --- | --- |
| light `--ring` | neutral-400 (1.54:1) | neutral-900 | 3.41 white, 3.34 muted, 3.38 muted/40 row |
| `.dark` `--ring` | neutral-500 (1.71 to 1.87:1) | neutral-300 | 3.75 panel, 3.52 the panel's field, 3.72 a tile; 3.92, 3.77 and 3.85 over the dark base |

The destructive button's own `focus-visible:ring-destructive/20` and `border-destructive/40` overrides (and their `dark:` variants) are removed from `src/components/ui/button.tsx`. It now takes the shared ring; the red at 20% was about 1.4:1.

**The check** is a browser measurement, once per scheme and project: "every focused control on a host's pages and in the Design drawer is ringed at 3:1".
- Each control is focused as the keyboard would focus it: a key press first, then `focus()`, with `:focus-visible` asserted.
- The test takes a screenshot of the 12px strip to the left of the control (or of its tile's label), at half its height, once focused and once blurred.
- It passes when some pixel both changed with the focus by at least 3:1 and stands out at least 3:1 from the page 12px out.
- Controls measured:
  - the event form: Title (text field), All day (checkbox), Time zone (select), Description (contenteditable), Bold (ghost), Add a question (outline), Save changes (primary), Publish, Delete event (destructive);
  - the share screen's "Back to the event" (a plain link, the base `outline-ring/50`);
  - the drawer: Details, a template tile, a background tile, and "Describe your picture" after an upload (the drawer's one `ring-ring/50` field).

RED/GREEN:
```
# old light token (neutral-400)
✘ … ringed at 3:1, with a light colour scheme
    Error: the ring round getByLabel('Title')   Received: 1.5424002833605304
# old dark token (neutral-500), light token new
✘ … Error: the ring round getByRole('dialog', { name: 'Design' }).getByLabel('Describe your picture')   Received: 1.877488831152874
# new tokens
✓ … ringed at 3:1, with a light colour scheme / with a dark colour scheme (both projects)
```
The look: on the host pages, focused fields get a near-black border and a mid-grey 3px halo instead of a pale one. In the drawer, focus outlines are light grey (neutral-300) instead of mid grey.

## 3. The visible-focus check (Important)

`expectVisibleFocus` in `e2e/keyboard.spec.ts` now:
- reads the focused element's outline (style, width of at least 2px, colour, offset) and box-shadow, and its label's, with `transition: none` set inline while it reads;
- then `blur()`s the element, reads again, and refocuses (asserting `:focus-visible` is back);
- passes only when a reading differs and the focused one is not "none | none".

So the Design button's resting `shadow-xl` no longer counts. Mutation: with the Design button's ring classes removed, the drawer test fails with `no ring on <button … class="dark fixed right-4 …`.

## 4. Reduced motion visits the listed pages (spec)

`e2e/reduced-motion.spec.ts` now adds:
- the event form as the host creates it (with a question added);
- a draft, as its host and as a guest see it;
- the Inline RSVP style for a second guest: name, plus-ones and questions steps, then the confirmation;
- the host's picture uploaded and used as the poster, with the drawer showing it and the guest's page in poster mode;
- a cancelled event.

These join the public pages, the dashboard, the delete dialog, the drawer through a template and a knob, the Sheet style from open to confirmation to closed, the guest list, the share screen and the instance settings.

The switch to Inline waits for the saved theme in the page a guest is sent (`rsvpStyle\":\"inline`), not for "Saved", which may already be showing. The limit is `test.setTimeout(240_000)`. It passes in both projects (24 to 28s).

## 5. `/events/new/share` and `/events/new/guests` (not-found box)

`src/proxy.ts` now tests `pathname !== "/events/new"`, not `hostEvent[1] !== "new"`. Both paths are added to `events.spec.ts`'s mistyped-address cases, which use `expectNotFoundAsSent`.

Mutation: with the old condition, the test fails with `Expected substring: "<html lang=\"en\"" … Received string: "<!DOCTYPE html><html id=\"__next_error__\">…"`.

## 6. Axe honesty

`e2e/axe.ts`:
- **The annotation** now carries, per check, the violations by impact, `incomplete` (the nodes axe could not decide, by rule) and `contrastMeasured` (texts with a contrast verdict). Incomplete contrast is counted only from a view where its text is wholly in sight, and never for text measured from another view.
- **Views read.** On a page with a backdrop fixed to the screen, contrast is read:
  - at every half screen down the page;
  - at every half view of anything on screen that scrolls on its own, each way it scrolls: the drawer's list down, and its template row across.
- **What is kept.** A verdict is kept only when its text is wholly on screen and inside every clipping ancestor. Text taller or wider than half its view is never wholly in sight, and the comment says it is left out.
- **The comment** is rewritten. axe cannot measure text over a picture or a gradient and marks it incomplete. On the event page that is nearly all the text, so there the zeros are not contrast measurements; the event page's contrast is `legibility.ts`'s rule.
- **Speed.** The first view reuses the full run's contrast verdicts rather than running axe again. The two ten-page tests have `test.setTimeout(180_000)`.

What axe measured in the definitive run (violations critical/serious/moderate/minor; texts whose contrast axe measured; what it left undecided):

| Page | 390px: violations c/s/m/m, contrast measured, undecided | Desktop: the same |
| --- | --- | --- |
| / | 0/0/0/0; 10; none | 0/0/0/0; 10; none |
| /sign-up | 0/0/0/0; 18; none | 0/0/0/0; 18; none |
| /sign-in | 0/0/0/0; 14; none | 0/0/0/0; 14; none |
| /forgot-password | 0/0/0/0; 11; none | 0/0/0/0; 11; none |
| /privacy | 0/0/0/0; 28; none | 0/0/0/0; 28; none |
| /terms | 0/0/0/0; 24; none | 0/0/0/0; 24; none |
| /too-fast | 0/0/0/0; 7; none | 0/0/0/0; 7; none |
| /e/abcdefghij | 0/0/0/0; 8; none | 0/0/0/0; 8; none |
| /no-such-page | 0/0/0/0; 8; none | 0/0/0/0; 8; none |
| the dashboard, empty | 0/0/0/0; 11; none | 0/0/0/0; 11; none |
| the event form, creating | 0/0/0/0; 40; none | 0/0/0/0; 40; none |
| the event form, editing | 0/0/0/0; 54; none | 0/0/0/0; 54; none |
| the dashboard, with an event | 0/0/0/0; 17; none | 0/0/0/0; 17; none |
| the share screen | 0/0/0/0; 17; none | 0/0/0/0; 17; none |
| the guest list | 0/0/0/0; 22; none | 0/0/0/0; 22; none |
| the guest list, editing a guest | 0/0/0/0; 30; none | 0/0/0/0; 30; none |
| the instance settings page | 0/0/0/0; 564; none | 0/0/0/0; 585; none |
| the Design drawer, light tone | 0/0/0/0; 6; color-contrast 75 | 0/0/0/0; 6; color-contrast 77 |
| the Design drawer, dark tone | 0/0/0/0; 6; color-contrast 75 | 0/0/0/0; 6; color-contrast 72 |
| the Design drawer, with the host's picture | 0/0/0/0; 3; color-contrast 62 | 0/0/0/0; 3; color-contrast 65 |
| the event page, the host's picture as the background, dark tone | 0/0/0/0; 2; color-contrast 26 | 0/0/0/0; 2; color-contrast 26 |
| the event page, the host's picture as the background, light tone | 0/0/0/0; 2; color-contrast 26 | 0/0/0/0; 2; color-contrast 26 |
| the event page, poster mode, light tone | 0/0/0/0; 2; color-contrast 26 | 0/0/0/0; 2; color-contrast 26 |
| the event page, poster mode, dark tone | 0/0/0/0; 2; color-contrast 26 | 0/0/0/0; 2; color-contrast 26 |
| the event page, poster mode, the title on the poster, dark tone | 0/0/0/0; 2; color-contrast 23 | 0/0/0/0; 2; color-contrast 23 |
| a draft, as a guest sees it | 0/0/0/0; 7; none | 0/0/0/0; 7; none |
| a draft, as its host sees it, light tone | 0/0/0/0; 3; color-contrast 23 | 0/0/0/0; 3; color-contrast 23 |
| a draft, as its host sees it, dark tone | 0/0/0/0; 3; color-contrast 23 | 0/0/0/0; 3; color-contrast 23 |
| a cancelled event, dark tone | 0/0/0/0; 2; color-contrast 23 | 0/0/0/0; 2; color-contrast 23 |
| a cancelled event, light tone | 0/0/0/0; 2; color-contrast 23 | 0/0/0/0; 2; color-contrast 23 |
| the Inline RSVP flow, light tone: the RSVP buttons | 0/0/0/0; 2; color-contrast 26 | 0/0/0/0; 2; color-contrast 26 |
| the Inline RSVP flow, light tone: the name step | 0/0/0/0; 4; color-contrast 28 | 0/0/0/0; 4; color-contrast 28 |
| the Inline RSVP flow, light tone: the plus-ones step | 0/0/0/0; 7; color-contrast 31 | 0/0/0/0; 7; color-contrast 31 |
| the Inline RSVP flow, light tone: the questions step | 0/0/0/0; 6; color-contrast 32 | 0/0/0/0; 6; color-contrast 32 |
| the Inline RSVP flow, light tone: the confirmation | 0/0/0/0; 3; color-contrast 38 | 0/0/0/0; 3; color-contrast 38 |
| the Inline RSVP flow, dark tone: the RSVP buttons | 0/0/0/0; 2; color-contrast 26 | 0/0/0/0; 2; color-contrast 26 |
| the Inline RSVP flow, dark tone: the name step | 0/0/0/0; 4; color-contrast 28 | 0/0/0/0; 4; color-contrast 28 |
| the Inline RSVP flow, dark tone: the plus-ones step | 0/0/0/0; 7; color-contrast 31 | 0/0/0/0; 7; color-contrast 31 |
| the Inline RSVP flow, dark tone: the questions step | 0/0/0/0; 6; color-contrast 32 | 0/0/0/0; 6; color-contrast 32 |
| the Inline RSVP flow, dark tone: the confirmation | 0/0/0/0; 4; color-contrast 40 | 0/0/0/0; 4; color-contrast 40 |
| the Sheet RSVP flow, light tone: the RSVP buttons | 0/0/0/0; 2; color-contrast 26 | 0/0/0/0; 2; color-contrast 26 |
| the Sheet RSVP flow, light tone: the name step | 0/0/0/0; 3; aria-hidden-focus 4, color-contrast 28 | 0/0/0/0; 3; aria-hidden-focus 4, color-contrast 28 |
| the Sheet RSVP flow, light tone: the plus-ones step | 0/0/0/0; 5; aria-hidden-focus 4, color-contrast 31 | 0/0/0/0; 5; aria-hidden-focus 4, color-contrast 31 |
| the Sheet RSVP flow, light tone: the questions step | 0/0/0/0; 4; aria-hidden-focus 4, color-contrast 32 | 0/0/0/0; 3; aria-hidden-focus 4, color-contrast 33 |
| the Sheet RSVP flow, light tone: the confirmation | 0/0/0/0; 4; aria-hidden-focus 4, color-contrast 42 | 0/0/0/0; 4; aria-hidden-focus 4, color-contrast 42 |
| the Sheet RSVP flow, dark tone: the RSVP buttons | 0/0/0/0; 2; color-contrast 26 | 0/0/0/0; 2; color-contrast 26 |
| the Sheet RSVP flow, dark tone: the name step | 0/0/0/0; 3; aria-hidden-focus 4, color-contrast 28 | 0/0/0/0; 3; aria-hidden-focus 4, color-contrast 28 |
| the Sheet RSVP flow, dark tone: the plus-ones step | 0/0/0/0; 5; aria-hidden-focus 4, color-contrast 31 | 0/0/0/0; 5; aria-hidden-focus 4, color-contrast 31 |
| the Sheet RSVP flow, dark tone: the questions step | 0/0/0/0; 4; aria-hidden-focus 4, color-contrast 32 | 0/0/0/0; 3; aria-hidden-focus 4, color-contrast 33 |
| the Sheet RSVP flow, dark tone: the confirmation | 0/0/0/0; 5; aria-hidden-focus 4, color-contrast 44 | 0/0/0/0; 5; aria-hidden-focus 4, color-contrast 44 |

Reading the table:
- **Host and public pages:** every text is measured. The instance settings count grows with the persistent test database's host invitations.
- **Event pages:** 2 to 7 texts are measured and 23 to 44 are undecided (the glass over a picture or gradient backdrop).
- **Drawer:** 3 to 6 measured, 62 to 77 undecided. The panel is 95% opaque over the invitation's backdrop. At worst it is #232323 (95% neutral-900 over a white page), where its faintest text (`muted-foreground`, neutral-400) is 6.08:1, and 5.98:1 on its tiles. That is computed, not tested.
- **Sheet steps:** 4 `aria-hidden-focus` undecided, from the page behind a modal Radix dialog, which is `aria-hidden` with its buttons still focusable. Radix's focus trap keeps focus off them, and axe cannot verify that.
- **Ticket comment:** "which axe confirms", "checked by axe … nothing found", "axe checks the confirmation" and "axe finds nothing on Birthday" are reworded to say what axe measured and what `legibility.ts` guarantees. The first part's "All report 0…" bullet now says what the zeros cover.

## Commands and output

```
$ pnpm lint                          → clean
$ rm -f tsconfig.tsbuildinfo && pnpm typecheck
                                     → ✓ Types generated successfully (no tsc errors)
$ pnpm test                          → Test Files 41 passed (41); Tests 332 passed (332)
# dev loop (app container stopped, next dev on 3000)
$ pnpm exec playwright test e2e/keyboard.spec.ts            → 11 passed (after the fixes)
$ pnpm exec playwright test e2e/reduced-motion.spec.ts      → 3 passed
$ pnpm exec playwright test e2e/events.spec.ts -g "mistypes|unknown link" → 5 passed
$ pnpm exec playwright test e2e/accessibility.spec.ts       → 17 passed
# definitive: fuser -k 3000/tcp; docker compose --profile test up -d --build --wait (all healthy; the image is newer than every file under src/, messages/, public/)
$ pnpm exec playwright test          → 248 passed (6.1m)
```

The first full run on the rebuilt image gave 247 passed and 1 failed: the desktop Inline accessibility test timed out at 90s, having done more reading per check. That is fixed by `da3aba0` (test-only), and the rerun gave 248 passed.

## Concerns after this round

- The host area's new ring is a visible change: darker focus borders and halos on every host page.
- Focus on the confirmation heading draws no ring, by design, because it is not a control.
- Minor findings recorded by the coordinator were not worked on, as instructed.
