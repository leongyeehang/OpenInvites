# Task 13 report: the Thread layout

**Status:** DONE

## Commits

- `0187184` **RSVP flow: choosing an option is one rule in the hook.** `answerAfterPicking(question, given, option)` in `src/questions/answers.ts` (unit-tested) holds both answer rules: a multiple-choice pick toggles; any other option becomes the answer, and picking the chosen option of an optional question again takes it back (a required one keeps it). `useRsvpFlow` offers `pickOption(question, option)` (a functional `setDraft`). `rsvp-flow.tsx` and `broadsheet-ballot.tsx` call it instead of their own copies.
- `9707132` **Layouts: the Thread layout, the invitation as a scripted chat with the host.**
  - Registration: `OFFERED_LAYOUTS` has all three. The drawer row lost its "Coming soon" badge, the `Badge` helper, `Choice`'s orphaned `disabled` prop and the `comingSoon` string in all three files. Kids' party applies as Thread. `changes.test.ts`, `resolve.test.ts`, `design.spec.ts`, `e2e/events.ts` and `client-messages.test.ts` are updated, and `page.tsx` has a `thread` branch.
  - `src/themes/thread-layout.tsx` (server): the header, the sent line, and the host's bubbles. `thread-card.tsx` (client) is the card. `thread-bubble.tsx` holds the shared bubble markup, the chip class and the arrival classes.
  - `src/themes/thread-script.ts`: `threadTurns` and `threadMessages`, pure, with 15 unit tests.
  - `src/app/e/[slug]/thread-composer.tsx` is the flow's presentation: the conversation (`role="log"`), pacing, focus, and the sticky composer with hidden fields posting to `flow.send`.
  - `MapLink` takes `chip`, `AddToCalendar` takes `chips`, and `useReducedMotion` is exported from the confetti module. `globals.css` gains the `theme-typing` keyframes and a `thread-page` variant, which lifts the host's Design button above the composer below `md`.
  - Strings: `EventPage.thread.*` in en, zh-Hans and zh-Hant.
  - Specs: `e2e/thread.spec.ts` (7 scenarios × 2 widths); Thread cases in `accessibility`, `keyboard` and `reduced-motion`.

## Rulings applied

- Who's coming has no bubble under the hidden setting.
- The header shows "Invitation · {n} replies" only when the guest list is open to the viewer, and "Invitation" otherwise.
- Pacing: everything present on arrival is server-rendered and shows at once. The first six host bubbles arrive 90 ms apart and the rest with the sixth; a returning guest's whole conversation also shows at once. The 650 ms typing dots only come before host lines that answer the guest. The page scrolls only when the conversation grows. Under reduced motion none of this happens.
- Closed events: a guest who replied is offered what Poster offers: Copy edit link, then Change my answer, Edit my details and Remove my RSVP. The conversation is followed by the closed line.

## Tests

- `pnpm lint` clean; `pnpm typecheck` clean; `pnpm test` 63 files, 510 tests passed.
- Browser runs, all on the **production-build loop**: `pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000 with `drizzle/`, `public` and `.next/static` copied into `.next/standalone`, and the Compose dev profile up. All runs used `--workers=2`.
  - After `0187184`: rsvp, rsvp-sheet, questions, broadsheet: **55 passed** (2.8 min).
  - During the Thread work (same loop): thread **15/15**; thread + design + keyboard + reduced-motion **43/43**; the accessibility Thread case **3/3**. axe found 0 issues at every impact (critical, serious, moderate, minor) on every Thread view, in both tones and cancelled.
  - The full list on a build of the commit before its final amendment: **145 passed, 2 failed**: the Thread keyboard case at both widths, where "Just me" was not focused. A late self-review change had made the focus go to the first `input` in the composer, and on a chip turn that is a hidden field of the send form. I fixed the selector to `input:not([type="hidden"])` and folded the fix into `9707132` (amend; nothing was pushed).
  - After `9707132`, the full list (thread, rsvp, rsvp-sheet, broadsheet, questions, design, theme, accessibility, keyboard, reduced-motion, effects, comments, announcements): **147 passed** (11.1 min).
- Port 3000 was stopped afterwards, and the unit suite was rerun on the final tree: 510 passed.

## TDD evidence

- RED: `pnpm exec vitest run src/questions/answers.test.ts` → `Tests 3 failed | 15 passed (18)`, `TypeError: answerAfterPicking is not a function`. GREEN: `Tests 18 passed (18)`.
- RED: `pnpm exec vitest run src/themes/changes.test.ts src/themes/resolve.test.ts` → `Tests 3 failed | 52 passed (55)`:
  - `expected 'poster' to be 'thread'` (Kids' party)
  - `expected undefined to deeply equal { knob: 'layout', value: 'thread' }`
  - `expected 'poster' to be 'thread'` (resolveTheme)

  GREEN: `pnpm exec vitest run src/themes` → `Test Files 8 passed`, `Tests 129 passed`.
- RED: `pnpm exec vitest run src/themes/thread-script.test.ts` → `Error: Cannot find module './thread-script'`. GREEN: `Tests 15 passed (15)`.
- Mutations of `thread-script.ts`, each restored:
  - Dropping Can't go's early return: 2 failed.
  - Dropping the break at the current turn: 7 failed.
  - Dropping the "turn beyond the current one" condition: all 15 passed. That condition was dead, so it was removed.

## Files changed

- New:
  - `src/themes/thread-layout.tsx`, `thread-card.tsx`, `thread-bubble.tsx`, `thread-script.ts`, `thread-script.test.ts`
  - `src/app/e/[slug]/thread-composer.tsx`
  - `e2e/thread.spec.ts`
- Changed:
  - `src/questions/answers.ts`, `answers.test.ts`
  - `src/app/e/[slug]/use-rsvp-flow.ts`, `rsvp-flow.tsx`, `broadsheet-ballot.tsx`, `page.tsx`, `design-panel.tsx`, `design-drawer.tsx`, `viewer.tsx`, `add-to-calendar.tsx`
  - `src/app/globals.css`
  - `src/themes/theme.ts`, `changes.test.ts`, `resolve.test.ts`, `templates/kids-party.ts`, `effects/confetti.tsx`
  - `src/locale/client-messages.test.ts`
  - `messages/en.json`, `zh-Hans.json`, `zh-Hant.json`
  - `e2e/events.ts`, `design.spec.ts`, `accessibility.spec.ts`, `keyboard.spec.ts`, `reduced-motion.spec.ts`
- Ticket `.scratch/m2-social/issues/13-thread-layout.md` updated, not staged.

## Self-review findings, fixed before the commit

- Screenshots at 390 and desktop:
  - The host's floating Design button covered the composer's last chip on a phone. It now sits above the composer below `md`.
  - The input's focus outline was a rectangle inside the pill. The input is now the pill itself, with Send laid over its end, so the focus ring follows the pill. A first attempt wrapped the input in a `<label>`, which would have contained the button, and I dropped it.
- A turn with Skip handed the focus to Skip. The field now comes first, and in chip rows Skip comes after the options. The first version of this fix picked the send form's hidden input; the full run caught it, and it is fixed (above).
- `BackgroundDescription` was moved into the card, as on the Poster, so an uploaded background is described with the invitation.
- The script's redundant loop condition was removed (found by mutation).
- Legibility: every Thread surface is one `SURFACES` already solves, and `legibility.ts` is unchanged. There is no accent ink anywhere in Thread. The comments bubble uses card glass because `CommentsSection`'s comment box is solved there.

## Concerns and notes

- On a closed event, "Change my answer" leads to the closed line with no chips, and "Edit my details" leads to the name turn, whose save is refused as "closed". This mirrors what Poster offers, as ruled: Poster's change leads to disabled buttons, and its edit to a refused send.
- Single-choice chips go through `pickOption`. While editing details, tapping the current answer of an optional question takes it back and stays on the question (Skip or another chip moves on), rather than keeping the answer and moving on.
- No Back control mid-conversation, as in the prototype: a guest finishes, then changes or edits.
- `askPlusOnes` keeps the ticket's words verbatim ("You can bring up to 1." when one is allowed).
- For ticket 14: the card paints `resolved.background` itself. Soft blur will need the backdrop's blur in the card's frame.
- For ticket 15: `docs/contributing/templates.md:31` is now stale; the locale spec does not visit the Thread; the uncertain Chinese strings are listed in the ticket.
