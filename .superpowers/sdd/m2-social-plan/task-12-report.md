# Task 12 report: the Broadsheet layout

**Status: DONE_WITH_CONCERNS.** The concerns are judgement calls for the reviewer and maintainer, not open defects. They are listed at the end.

## Commits

| SHA | Subject |
| --- | --- |
| `41d0ec7` | RSVP flow: the rules of replying are one hook every layout calls |
| `66fa5d3` | Event page: the comments and announcements sections are shared by every layout |
| `4d9ac68` | Layouts: the Broadsheet layout, an editorial page with a single ballot |

## What each commit does

### `41d0ec7`: the flow hook (refactor 1)

- **New: `src/app/e/[slug]/use-rsvp-flow.ts`.** `useRsvpFlow(props: RsvpFlowProps, land: (target: "confirmation" | "status", status: RsvpStatus) => void)`. It owns all of the flow's state and rules:
  - the step, the draft (`draftFrom`, `BLANK`), `change` and `recordAnswer`;
  - `steps`, `position`, `last`;
  - `answer` (the saved one) and `confirmed` (the saved answer while the confirmation shows, else `undefined`, so a destructured value still narrows);
  - `answering`, `refusal` with `STEP_OF`, `withdrawRefusal`, `working`;
  - the confetti count `falls`, bumped inside `send` through `confettiFor` under the Confetti effect;
  - the actions `pick`, `forward`, `back`, `stopAnswering` (the sheet's close-part-way rule), `send`, `withdraw`, `changeAnswer` and `editDetails`.
- **Where the hook lives.** It is in `src/app/e/[slug]/` rather than `src/rsvps/`: it is a client hook that calls the server actions and reads the page's theme, not a pure rule, and only the event page uses it. Your ruling left this to me.
- **Focus.** The Poster's `focusNext` ref and its effect became the hook's private `landing` ref. An effect on `[step, answer]` calls the presentation's `land` callback through `useEffectEvent` once the new state is drawn. The old effect's extra dependencies (`sheet`, `draft.status`) only ever ran it with nothing pending, so dropping them changes nothing. `land` gets the status being chosen from, because the React Compiler lint refused a callback that reads `flow` before it is declared.
- **`rsvp-flow.tsx` is a presentation over the hook:** buttons, steps, sheet, Enter-to-continue focus, confirmation. Its diff is the state moving out and nothing else.

### `66fa5d3`: shared sections (refactor 2)

- **New: `src/themes/sections/announcements-section.tsx`.** `AnnouncementsSection({ announcements, timeZone })`, plus a `ShownAnnouncement` type.
- **New: `src/themes/sections/comments-section.tsx`.** `CommentsSection({ comments, form, slug, timeZone })`: the locked count, the list with its Host pill, the server-rendered delete `AlertDialog`, and the form when `canPost`.
- Each renders a section's body only. The layout frames it and gives it its heading. `poster-layout.tsx` uses both, and its rendered DOM is unchanged.

### `4d9ac68`: layout plumbing and the Broadsheet

**Plumbing**

- `theme.ts`: `OFFERED_LAYOUTS = ["poster", "broadsheet"]`. `applyTemplate` already applied an offered layout, so Supper club now applies as Broadsheet and Kids' party still as Poster.
- `resolve.ts`: `ResolvedTheme.layout: Layout`. `resolveTheme` carries the stored layout when it is offered and renders Poster otherwise. Thread therefore renders as Poster until ticket 13 offers it. This is how I read "carries the stored layout through" while Thread has no component.
- `changes.ts`: a `{ knob: "layout"; value: Layout }` change, which `parseThemeChange` accepts only for offered layouts. It goes through the generic knob path, so every other knob is kept.
- `design-panel.tsx`: the Layout row chooses (Thread stays disabled with "Coming soon"), and the RSVP style row renders only when `resolved.layout === "poster"`. The stored value is kept.

**Page**

- `page.tsx` picks the component by `resolved.layout` from the saved theme. Both layouts get the same flow props (`RsvpFlowProps`), and **the page passes the matching flow component in the `rsvp` slot**: `<RsvpFlow/>` or `<BroadsheetBallot/>`. Layouts under `src/themes` never import from `src/app`, so a slot is the only way.
- Broadsheet takes the guest list as data (`guests: { view, guests, counts, you }`, with `you` the viewer's RSVP id), because its Host fact needs the headcount. Poster keeps its `guestList` slot.

**Layout** (`src/themes/broadsheet-layout.tsx`, 156 lines; `broadsheet-title.tsx`; `broadsheet-guest-list.tsx`)

- At most 64rem (`max-w-5xl`).
- Masthead rule with "Invitation" and "Hosted by …" in a new `label-mono` utility (mono, 11px, 0.14em, uppercase; in `globals.css`).
- Title at `clamp(3.5rem,14vw,8.5rem)` for serif and `clamp(2.75rem,11vw,6.5rem)` for the others, line height 0.92. In poster mode the host's poster comes first, with the title on its foot over the Poster's title scrim (POSTER_SURFACES) or large below it. `poster-card.tsx` now exports `Picture` (with a `sizes` prop) and `fitted` for this.
- Facts grid with rules:
  - When: `formatWhen` and `ViewerTime`.
  - Where: the location and `MapLink`.
  - Host: hosts via `format.list`, with the label "Host" or "Hosts" by count, and the headcount when the list is open.
  - Countdown: a new client `CountdownFigure` in `viewer.tsx`, one large number with "days/hours/minutes to go", or "Happening now"/"This has ended".
- "The details" in `sm:columns-2`, "From the host", the guest list, the comments.
- The guest list numbers its Going guests ("01", "+N", a "you" pill filled with the accent) and puts maybes on one line beneath. Nobody who can't go is listed. When the list is locked it shows four blurred placeholder rows and "RSVP to see who's coming", and no names reach the browser.
- Grid tracks are `grid-cols-1` and `lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]`. On `lg` the ballot is sticky in column 2, spanning both rows. On a phone it comes straight after the facts rather than at the foot, as the prototype had it, so a guest doesn't scroll past everything to reply.
- Entrance animations are the Poster's `motion-safe:` classes.

**Ballot** (`src/app/e/[slug]/broadsheet-ballot.tsx`, 277 lines; `broadsheet-receipt.tsx`, 95 lines)

- A `Glass` card: header "RSVP" and "Please reply", then a radio list ("I'll be there", "Maybe", "Can't make it") drawn with native inputs as marks in the text colour, inside a fieldset that is disabled when the event is closed.
- Then everything the chosen answer asks, at once:
  - name, and email when the host asks;
  - a plus-ones stepper with a name field for each plus-one; its buttons are `aria-disabled` at their ends, so keyboard focus is never dropped;
  - every question type: text as a textarea, single choice and yes/no as radios (choosing the chosen option again clears an optional one, as on Poster), multiple choice as checkboxes.
- Then "Post my reply".
- The receipt has a "Received" stamp (accent border, accent ink, `-rotate-8`, `motion-safe:animate-theme-stamp-in`), the status heading (which takes focus), the summary, the calendar, the edit link with Copy, and "Amend reply", "Change answer", "Remove my RSVP".
- Confetti is rendered by the ballot from `falls`.

**Legibility** (`legibility.ts`)

- The Broadsheet's text is set on the page, not on glass. Its two paper blocks therefore sit on the veil (`bg-theme-veil backdrop-blur-xl`), which `SURFACES.page` already solves for text at every strength. The blur matches how the backdrop's extremes are measured.
- Accent ink on the veil falls below AA on many backdrops (measured: worst 3.41), so the Broadsheet never sets accent as text on the page. The countdown is in the text colour. The "you" and Host pills are filled with the accent.
- The ballot sits on the card glass with the Poster's inline surfaces, so it adds no surface.
- New stack: `SURFACES.fieldOnPage` (the comment box on the veil, `[veil, glassStrong]`). It is excluded from the glass solve and included in the veil solve.

**Other changes**

- `add-to-calendar.tsx` lays out by its container (`@container`, `@md:grid-cols-3`) so it fits the ballot.
- Messages:
  - New keys `EventPage.broadsheet.{invitation, host, countdown, daysToGo, hoursToGo, minutesToGo, details, you}` and `Rsvp.ballot.{title, pending, received, going, cant, plusOnes, fewer, more, post, amend, change}`, in all three files.
  - Everything else is reused where the meaning is identical.
  - `DesignDrawer.layouts.broadsheet.note` already existed and is now shown. I didn't change its wording.

## Tests and results

### Commit 1 (`41d0ec7`), production-build loop, `--workers=2`

```
pnpm exec playwright test e2e/rsvp.spec.ts e2e/rsvp-sheet.spec.ts e2e/questions.spec.ts e2e/conveniences.spec.ts e2e/effects.spec.ts e2e/keyboard.spec.ts --workers=2
  71 passed (3.4m)
```

lint and tsc were clean, and `pnpm test` was green.

### Commit 2 (`66fa5d3`), production-build loop, `--workers=2`

```
pnpm exec playwright test e2e/comments.spec.ts e2e/announcements.spec.ts e2e/poster.spec.ts --workers=2
  27 passed (1.8m)
```

### Commit 3 (`4d9ac68`), final tree

- `pnpm lint` clean. `pnpm typecheck` clean (after `rm -f tsconfig.tsbuildinfo`).
- `pnpm test`: Test Files 62 passed, Tests 491 passed. The only console noise is the existing Vite `configLoader` notice.
- Fresh `pnpm build`, production-build loop, `--workers=2`:

```
pnpm exec playwright test e2e/broadsheet.spec.ts e2e/rsvp.spec.ts e2e/rsvp-sheet.spec.ts e2e/questions.spec.ts e2e/conveniences.spec.ts e2e/effects.spec.ts e2e/keyboard.spec.ts e2e/accessibility.spec.ts e2e/reduced-motion.spec.ts e2e/design.spec.ts e2e/theme.spec.ts e2e/poster.spec.ts e2e/comments.spec.ts e2e/announcements.spec.ts e2e/guest-list.spec.ts --workers=2
  163 passed (10.4m)
```

The server log's only line was `⨯ Error: The destination stream closed early.` (7 times). Task 1's report records it as pre-existing.

### New and changed browser tests

**`e2e/broadsheet.spec.ts`** (5 tests, each at 390 and desktop):

1. **The whole flow:**
   - the masthead, title, facts, details and the locked list;
   - Going with two named plus-ones, a multiple-choice question and a required single choice (refused until answered);
   - the stamp at -8 degrees, the summary, the edit link, Copy and the calendar;
   - no sideways overflow;
   - the numbered line with "01", "+2" and "you", and "3 people expected";
   - the host's guest list showing "Salad" and "Friday and Sunday";
   - Change answer (focus returns to the answer), then Can't make it (asks nothing more; the list drops the guest);
   - Amend reply (prefilled), then Remove my RSVP (the device forgets too).
2. **Visibility:** after-reply (nothing in the page source, no count), unlocking on reply, Maybe as a line, always (a visitor sees the list), hidden (no list and no count, even for a guest who has replied).
3. **Announcements and comments:** locked for a guest who hasn't replied, then a guest who has replied reads the host's comment and posts one.
4. **Confetti** for Going and not for Maybe, through the shared hook.
5. **States:** the host sees the draft notice, a disabled ballot and the Design button. Once the event is cancelled, a guest who replied keeps the receipt and can't choose again, and a visitor sees the notice and a disabled ballot.

**Other specs:**

- `e2e/accessibility.spec.ts`: Broadsheet in both tones (the page, the ballot filled in with a refusal, the receipt with the list and comments open) and a cancelled Broadsheet.
- `e2e/keyboard.spec.ts`: the ballot completed by keyboard alone, with every stop ringed, focus on the receipt heading, and focus back on the answer after Remove.
- `e2e/reduced-motion.spec.ts`: Broadsheet chosen, then the ballot and the receipt (the stamp) are still.
- `e2e/design.spec.ts`: the layout test now checks that Thread is coming and Broadsheet is choosable with its note; choosing it changes only the layout, hides RSVP style, and guests get the ballot; back to Poster keeps RSVP style at Sheet; Supper club applies with Broadsheet.
- `e2e/events.ts`: a `layout` option and an exported `chooseLayout`.

## TDD evidence

**RED**

```
$ pnpm exec vitest run src/themes/changes.test.ts src/themes/resolve.test.ts
 ❯ src/themes/changes.test.ts (34 tests | 2 failed)
     × applies Supper club with the Broadsheet layout, and Kids' party with the Poster layout while Thread is coming
     × accepts every change the drawer offers
 ❯ src/themes/resolve.test.ts (20 tests | 1 failed)
     × carries the stored layout through, and renders one not offered yet as Poster
AssertionError: expected 'poster' to be 'broadsheet'
AssertionError: expected undefined to deeply equal { knob: 'layout', value: 'poster' }
AssertionError: expected 'poster' to be 'broadsheet'
 Tests  3 failed | 51 passed (54)
```

**GREEN**

```
$ pnpm exec vitest run src/themes
 Test Files  8 passed (8)
      Tests  128 passed (128)
```

**Characterisation tests that already passed before the change.** These cover the generic knob path:

- "sets the knob and marks the template dirty: layout broadsheet";
- "keeps every other knob, the RSVP style included, when the layout changes and changes back";
- "brings its own layout when applied over another".

**Legibility**

- I snapshotted `toneTokens` for every background, both tones, every accent (plus three odd ones) and both uses, before and after adding `fieldOnPage`. The snapshots are byte-identical.
- Mutation: replacing `fieldOnPage`'s glass with near-white fails 14 legibility tests (`text, #ffc36b accent, on fieldOnPage: expected 1.107… ≥ 4.5`). Restored.

**Overflow guard.** Mutation: dropping `grid-cols-1` and rebuilding made the mobile flow test fail with `Received: 198` (pixels of sideways overflow). Restored and rebuilt.

## Files changed

**New**

- `src/app/e/[slug]/use-rsvp-flow.ts`
- `src/app/e/[slug]/broadsheet-ballot.tsx`
- `src/app/e/[slug]/broadsheet-receipt.tsx`
- `src/themes/broadsheet-layout.tsx`
- `src/themes/broadsheet-title.tsx`
- `src/themes/broadsheet-guest-list.tsx`
- `src/themes/sections/comments-section.tsx`
- `src/themes/sections/announcements-section.tsx`
- `e2e/broadsheet.spec.ts`

**Changed, source**

- `src/app/e/[slug]/rsvp-flow.tsx`
- `src/app/e/[slug]/page.tsx`
- `src/app/e/[slug]/design-panel.tsx`
- `src/app/e/[slug]/viewer.tsx`
- `src/app/e/[slug]/add-to-calendar.tsx`
- `src/app/globals.css`
- `src/themes/poster-layout.tsx`
- `src/themes/poster-card.tsx`
- `src/themes/theme.ts`
- `src/themes/resolve.ts`
- `src/themes/changes.ts`
- `src/themes/legibility.ts`
- `src/themes/templates/supper-club.ts`
- `messages/en.json`, `messages/zh-Hans.json`, `messages/zh-Hant.json`

**Changed, tests**

- `src/themes/changes.test.ts`
- `src/themes/resolve.test.ts`
- `src/locale/client-messages.test.ts`: the walker now finds the ballot and the receipt among the `Rsvp` readers.
- `e2e/events.ts`, `e2e/design.spec.ts`, `e2e/keyboard.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/reduced-motion.spec.ts`

**Not staged:** the ticket file, with all 7 boxes ticked, status done and a dated comment with notes to tickets 13 and 15.

## Self-review findings (all fixed before the commit)

1. **Title line height lost.** `cn()` (tailwind-merge) dropped the title's `leading-[0.88]` because a later `text-[clamp()]` counts as a size class. The line height now goes last, and is 0.92, the Poster's title line height, since 0.88 made descenders touch the next line.
2. **Sideways overflow.** The edit link's min-content grew the grid's `auto`/`fr` tracks. At 390px the page scrolled sideways by about 198px, and on desktop the text column was squeezed. Fixed with `grid-cols-1` and `minmax(0, …)` tracks, and guarded by a test that a mutation proves.
3. **Calendar links cramped** (two-line buttons) in the ballot. Fixed by making `AddToCalendar` lay out by its container.
4. **Headcount twice** (the Host fact and the guest list). It is now in the Host fact only.
5. **"Received" twice** (the header and the stamp). It is now on the stamp only.
6. **Glossary.** Code comments used "reply" as a noun for the RSVP; they now say RSVP. The ticket's verbatim UI copy ("Post my reply", "Amend reply") is kept.
7. **Ballot file size.** It had grown to 362 lines, so the receipt moved to its own file.
8. **Race in my visibility test.** A second "Saved." matched the first save's message. The helper now reloads the manage page first.

## Concerns (judgement calls; nothing failing)

1. **The veil can show as a panel.** Where the veil is not zero, the editorial column appears as a tinted, blurred panel: on Golden hour light the veil is 0.54, and other photo backgrounds sit between 0.09 and 0.58. This is what keeps bare text at AA. On Supper club's midnight (veil 0) it is invisible and looks like the prototype. The maintainer may want to see it on the default theme.
2. **The countdown number is not in the accent** as the prototype has it, because accent ink fails AA on the veil (measured). This is deliberate.
3. **Add to calendar on the Broadsheet** appears only in the receipt, as the ticket and the prototype have it. The Poster also shows a tile to everyone.
4. **The `AddToCalendar` container query** changes the Poster slightly at viewports of about 470 to 640px: three links side by side instead of stacked. Everywhere else the Poster is as before.
5. **The "RSVP buttons" style knob does nothing visible under Broadsheet.** Form buttons are always the accent, as on Poster, and the status choice is radios. The drawer still shows it. Noted for ticket 15.
6. **Stale guide.** `docs/contributing/templates.md:31` still says "Only Poster is offered today". I left it for ticket 15, following ticket 11's handling of the data-file guides. The locale spec does not visit the Broadsheet yet (ticket 15).
7. **Two refactors** although the ticket says one; the second was your ruling.
8. **Coupling.** `Asked` is now exported from `rsvp-flow.tsx` for the ballot.
9. **Chinese I'm least sure of** (also in the ticket comment):
   - `daysToGo`/`hoursToGo`/`minutesToGo`: 天后开始 / 小时后开始 / 分钟后开始, set under the big number;
   - `countdown`: 倒计时 / 倒數;
   - `invitation`: 邀请函 / 邀請函;
   - `ballot.title` ("RSVP"): 回复 / 回覆;
   - `going`/`cant`: 我会来 / 来不了;
   - `plusOnes` ("Guests with you"): 同伴人数;
   - `post`: 发送我的回复 / 送出我的回覆;
   - `amend`/`change` reuse the Poster's Chinese for "Edit details" / "Change my answer".

## Workspace

- Nothing listens on port 3000.
- The copies of `drizzle/`, `public` and `.next/static` in `.next/standalone` are removed.
- The Compose dev containers were already running when I started, and I left them running.
- The throwaway screenshot specs were deleted.

---

# Fix report, round 1 (commit `d264fbb`)

**Commit:** `d264fbb` Layouts: the Broadsheet's reply button wears the theme's button style. It is a new commit; the three reviewed commits are untouched.

## 1. Important: the button-style knob had no effect under Broadsheet

- New in `src/themes/rsvp-buttons.ts`: `cardButtonClasses(style)`, the RSVP button style for a button set inside a glass card. It reuses the Poster's `BASE`, which rings the focus inside in the label's own colour. For glass and solid it reuses the Poster's own classes: glass is strong glass on the card (SURFACES.inset) and solid is the accent. Outline is `border-2 border-current/40` with no veil behind it, because the card under its label is already a surface the tone's text reads on (SURFACES.card). Poster's `rsvpButtonClasses` is unchanged.
- `broadsheet-ballot.tsx`: "Post my reply" uses `cn(cardButtonClasses(buttonStyle), "h-14 justify-between px-5 text-lg font-bold tracking-tight")`. The receipt's three actions stay links.
- New browser case in `e2e/broadsheet.spec.ts`: "the ballot's Post button wears the theme's RSVP button style, and Supper club brings the Broadsheet with it". It observes computed styles, as `design.spec.ts` does for the Poster's buttons:
  - Supper club (solid): `background-color` is `rgb(255, 195, 107)`.
  - Outline: `rgba(0, 0, 0, 0)`, with a `border-top-width` of 2px.
  - Glass: `backdrop-filter` matches `/blur/`, and the background is neither the accent nor transparent.

## 2. Important: Poster regression from the `AddToCalendar` container query

- **Chosen: keep the Poster on `sm:grid-cols-3`, and apply the container rule only under Broadsheet.**
  - `AddToCalendar` takes `inCard` (default false). With `inCard` false it renders exactly the markup it had before task 12: the same element and the same classes (`git diff 69ea574 -- add-to-calendar.tsx` shows only the new branch). With `inCard` true it wraps the links in `@container` and uses `@lg:grid-cols-3`. 32rem is above the reviewer's 31.5rem, so the receipt's labels are never squeezed onto two lines.
  - `page.tsx` builds `calendar` after the theme is resolved, with `inCard={resolved.layout === "broadsheet"}`.
- **Why not one shared threshold.** Below 640px the Poster's calendar card is already about 30.5–33rem wide (488–528px of content at 560–600px viewports). Any threshold low enough to give the ballot three columns, or even the reviewer's 31.5rem, would put three columns on the Poster at some width below 640px where it used to stack. A shared threshold cannot keep the Poster pixel-identical.
- New browser case in `e2e/conveniences.spec.ts` (Poster): "the calendar links stack on a narrow screen and sit side by side from 640 pixels".
  - At a 560px-wide viewport each link starts below the previous one.
  - At 700px the three share one top edge and are each 44px tall (one line).
  - It measures once the tiles' entrance animations have finished. An earlier version measured mid-slide on mobile and differed by 0.94px; it now passed 3 of 3 repeats at both widths.

## 3. The empty "Guests" section when everyone can't go

- `broadsheet-guest-list.tsx` checks for no Going and no Maybe after filtering. It shows "Nobody has replied yet. Be the first." when nobody has replied, and otherwise `EventPage.headcount` at 0, "No one yet". No new string.
- Browser assertion in the flow test: after Priya, the only guest, changes to Can't go, the guest list shows "No one yet".

## Covering tests

### RED

Build of `4d9ac68` (my src changes stashed, the new tests kept), production-build loop:

```
$ pnpm exec playwright test e2e/broadsheet.spec.ts e2e/conveniences.spec.ts --workers=2 -g "button style|stack on a narrow|received stamp"
  ✘ [mobile/desktop] broadsheet.spec.ts:264 the ballot's Post button wears the theme's RSVP button style …
      Expected: "rgba(0, 0, 0, 0)"  Received: "rgb(255, 195, 107)"
  ✘ [mobile/desktop] broadsheet.spec.ts:55 a guest replies on the ballot …
      await expect(guestList(page).getByText("No one yet")).toBeVisible()  → element(s) not found
  ✘ [mobile/desktop] conveniences.spec.ts:48 the calendar links stack on a narrow screen …
      Expected: >= 844.125  Received: 800.125
  6 failed, 1 passed
```

### GREEN

Fixed tree, fresh `pnpm build`, production-build loop, `--workers=2`:

```
$ pnpm exec playwright test e2e/broadsheet.spec.ts e2e/conveniences.spec.ts e2e/rsvp.spec.ts e2e/rsvp-sheet.spec.ts e2e/design.spec.ts --workers=2
  63 passed (2.9m)
$ pnpm exec playwright test e2e/keyboard.spec.ts e2e/accessibility.spec.ts e2e/reduced-motion.spec.ts --workers=2 -g "Broadsheet|reduced motion nothing moves"
  7 passed (59.7s)
$ pnpm exec playwright test e2e/conveniences.spec.ts --workers=2 --repeat-each=3 -g "stack on a narrow"
  7 passed (18.4s)
```

`pnpm lint` clean, `pnpm typecheck` clean, and `pnpm test`: 62 files, 491 tests passed.

## Bookkeeping

- **Ticket comment.** The note that the "RSVP buttons" knob has no effect is removed, the calendar note is rewritten, the commit is listed, and a dated fix entry is appended.
- **Workspace.** Nothing is on port 3000, and the standalone copies are removed.

## Concerns

None new. Earlier concern 4 (the Poster's calendar change) and concern 5 (the knob) are resolved.
