# Task 11 report: Sheet RSVP style and adaptive Design drawer

**Status:** DONE_WITH_CONCERNS (the concern is outside the ticket: see "Concerns", item 1).

**Commit:** `45f4bd1` RSVP style: guests answer inline or in a sheet over the invitation, and the drawer fits the screen

## What I implemented

### The RSVP style knob
- `src/themes/theme.ts`: `RsvpStyle` type exported. `src/themes/changes.ts`: `KnobChange` gains `{ knob: "rsvpStyle" }`, and `parseThemeChange` accepts only `inline` or `sheet`.
- `src/themes/resolve.ts`: `ResolvedTheme.rsvpStyle`, plus `sheetVariables(resolved)`, the CSS variables the sheet sets on itself.
- `src/app/e/[slug]/design-panel.tsx`: an "RSVP style" row (Inline, Sheet), last in Details, with a hint for the chosen value.
- Templates: Birthday uses Sheet and Festival uses Inline, as the ticket requires; both were already in the data files. **Vows moved to Sheet.** A wedding invitation is the thing guests keep, and answering on a reply card laid over it leaves it whole. The white accent and outline buttons read as a formal reply card on the frost. Supper club stays Inline: it was made for Broadsheet, whose single reply form sits in the page. Kids' party stays Inline: it was made for Thread, where guests answer in place, and parents on the move get the steps right under the button they tapped. Quiet stays Inline: its blurb is "Nothing moves", and a rising sheet is both a layer and a motion. The reasons are also in the ticket comment.

### One flow, two containers (`src/app/e/[slug]/rsvp-flow.tsx`)
- There is one set of steps, one `<form>`, one `Confirmation`, one `saveRsvpAction` and `removeRsvpAction`, and one set of validation and error-to-step routing. They are built once as `stepper` and `confirmation`. Inline renders them in `Glass`, and the confirmation takes the buttons' place, exactly as in ticket 07. Sheet renders them in `RsvpSheet`, with the buttons staying under the poster.
- `RsvpSheet` is a modal Radix `Dialog` from the `radix-ui` package already in the repo. Radix provides the focus trap, hides the rest of the page from assistive technology, and closes on Escape.
  - The sheet is portalled into the page's own root element, so it inherits the theme variables and fonts. `ThemedPage` now provides that element in context as `root`.
  - Its height follows its content through a ResizeObserver on the inner scroller, with a CSS `height` transition, so it grows and shrinks through the steps.
  - It is fixed to the bottom of the screen, `max-w-[34rem]`, with safe-area padding, a `backdrop-blur-2xl` frost and `bg-theme-sheet`.
  - A tap outside is ignored (`onPointerDownOutside` is prevented), so tapping away the phone keyboard never throws the guest out.
  - `onCloseAutoFocus` returns focus to whichever button opened the sheet. If that button is gone (after Change my answer or Remove my RSVP), focus goes to the status button being chosen from.
- The confirmed sheet has a Close button beside its heading (a `dismiss` slot on `Confirmation`). Under the buttons, "You replied as {name}. Show my RSVP" reopens it; this is also what a returning guest sees. Closing part-way leaves the saved RSVP as it was.
- The Design button moves to the top right while a sheet is open, through a `rsvp-sheet-open` custom variant (`body:has([data-slot="rsvp-sheet"])`) in `globals.css`.

### Two focus fixes the keyboard flow needed (shared by both styles)
- **Enter handling.** Enter in a field still finishes its step, and focus now follows to the new step's first control. Before, focus was left on a now-hidden field, and inside the modal that let focus escape the trap: Radix FocusScope cannot refocus a hidden element. Enter on a button now does what the button says. Previously Enter on Back or on a plus-one chip moved forward.
- **Name field focus.** The name field's `autoFocus` became a ref that focuses with `preventScroll`. A plain focus could scroll the page behind the fixed sheet: I saw that once, in one of several screenshot runs of the sheet.

### Legibility rule for the sheet (`src/themes/legibility.ts`)
- `SHEET_SURFACES(tone, …)` lists the text surfaces on the sheet:
  - the bare sheet (headings, labels, hints, summary, errors)
  - an inset (fields, placeholders, chips, calendar links, the edit-link pill)
  - the inset button (the copy button)
  - the accent ink on the sheet
- The sheet rises over the page itself, so what is behind it can be anything. It is solved against the far end of the scale outright, which the first, opaque layer of each surface stands for: white under light text, black under dark.
- `toneTokens` returns `sheet: { tint, textMuted, textFaint, accentInk }`. The tint is the tone's shade at the least alpha that reads. The results are 0.67 to 0.73 in the light tone and 0.60 in the dark, close to the prototype's 70% plum and 80% white.
- The sheet's secondary strengths and accent ink are solved separately from the page's, so the page's values are unchanged. The sheet applies its own values through `sheetVariables`, which overrides `--theme-text-muted`, `--theme-text-faint` and `--theme-accent-ink` on the sheet element. The flow's classes are identical in both containers.
- The existing page-strength and ink computation was folded into one `strengthsOn(surfaces)` helper, used for both the page and the sheet.

### The drawer's two forms (`design-panel.tsx`, `themed-page.tsx`)
- The switch is pure CSS at the **`md`** breakpoint (768px). The shadcn components in the repo already use it, and so did the prototype for this exact switch. At `sm` (640px) a 380px side panel would leave the page 260px.
- Under `md` the drawer is a bottom sheet: edge to edge, at most 62dvh tall, sliding up. The page gets `pb-[62dvh]` so all of it can scroll up above the sheet.
- From `md` up it is a side panel: `inset-y-3 right-3 w-95`, sliding in from the right. The page gets `pr-101`, so its content moves over beside the panel, and an open RSVP sheet centres in that space too.
- The page makes room through a `designing` custom variant (`body:has([data-slot="design-panel"])`).
- The panel only exists once opened, so server rendering cannot show a wrong form. The panel stays non-modal, as in ticket 10.

### Reduced motion
- The following are `motion-safe` or turned off by `motion-reduce:transition-none`:
  - the sheet's rise, fade and height transition
  - the drawer's slide
  - the hover transitions on the flow's Continue/Send button and chips, and on the status buttons (`rsvp-buttons.ts`)

### Messages
- New English strings in `messages/en.json`:
  - `Rsvp.replied`, `Rsvp.showMine`, `Rsvp.sheet.title` ("Your RSVP"), `Rsvp.sheet.close`
  - `DesignDrawer.rsvpStyle`, `DesignDrawer.rsvpStyles.*`, `DesignDrawer.rsvpStyleHints.*`

## Tests

### Pure rules: TDD evidence (Vitest)

**1. RSVP style knob** (`src/themes/changes.test.ts`). Added a knob-change case, accepted and refused inputs, and the Vows expectation changed to `sheet`.
- RED: `pnpm exec vitest run src/themes/changes.test.ts`
  ```
   FAIL  … > applying a template > copies every knob the template sets and records it as not dirty
  AssertionError: expected { uploadId: null, …(11) } to deeply equal { layout: 'poster', …(11) }   (rsvpStyle "inline" vs "sheet")
   FAIL  … > reading a change the drawer sent > accepts every change the drawer offers
  AssertionError: expected undefined to deeply equal { knob: 'rsvpStyle', value: 'sheet' }
        Tests  2 failed | 19 passed (21)
  ```
  The knob-change case also failed the type check: `tsc --noEmit` reported `error TS2322: Type '{ knob: "rsvpStyle"; value: string; }' is not assignable to type 'ThemeChange'`, three times. At runtime it passed, because `applyChange` is generic.
- GREEN, same command: `Tests  21 passed (21)`.

**2. The sheet as a legibility surface** (`src/themes/legibility.test.ts`)
- What the new tests check:
  - The "every combination" loop now also checks `SHEET_SURFACES` with the sheet's own strengths.
  - Independently of that model, the sheet reads over white, black and the backdrop's worst point, for every background, both tones and every accent.
  - The sheet is never solid: its alpha is above 0 and at most 0.9.
  - The page's own tokens are unchanged.
- RED: `pnpm exec vitest run src/themes/legibility.test.ts` gave `Tests  21 failed | 7 passed (28)`, with `TypeError: SHEET_SURFACES is not a function` and `TypeError: Cannot read properties of undefined (reading 'tint')`. One failure was my own test's wrong premise (`expected 0.8 to be 0.75`: Slate's muted strength is already 0.8). I rewrote that test to use the very dark backdrop that the existing "settled look" test uses.
- GREEN: `Tests  28 passed (28)`.
- Mutation checks on the implementation:
  - Replacing the opaque "anything behind" layer with a transparent one: 3 tests fail. Restored.
  - Solving the tint on the bare sheet only (`slice(0, 1)`): at first nothing failed, because secondary text would simply rise to full strength. I then added a hierarchy test: secondary text on the sheet is never closer than 80% to full strength, the same guarantee the page gives. With the mutation that test fails (`Tests  1 failed | 28 passed (29)`). Restored: `29 passed`.

**3. Resolution** (`src/themes/resolve.test.ts`). Two new tests: the resolved theme carries the RSVP style, and `sheetVariables` emits the sheet's four variables.
- RED: `Tests  2 failed | 11 passed (13)`, with `expected undefined to be 'sheet'` and `TypeError: sheetVariables is not a function`.
- GREEN: `Tests  13 passed (13)`.

**Full unit suite:** `pnpm test` gives 27 files, **185 passed**. `pnpm lint` is clean, and `pnpm typecheck` is clean after removing a stale `tsconfig.tsbuildinfo`. The Vite "configLoader: 'native'" warning at the top of `pnpm test` comes from the untouched `vitest.config.ts` and was there before this ticket.

### Browser tests (Playwright, 390px and desktop)
- **New `e2e/rsvp-sheet.spec.ts`** covers the Sheet style, four scenarios:
  1. **Full flow.** The sheet rises and the title stays above it, with the three buttons still on the page. The sheet grows at the plus-ones step, confirms, and the host's headcount updates. The confirmation closes and reopens. After a reload the guest sees "You replied as…" and no sheet. Edit details prefills the name. Escape closes the sheet. Change my answer closes it onto the buttons; choosing Maybe keeps the name and replaces the RSVP (0 going · 1 maybe).
  2. **Focus.** Focus lands in the name field. Eleven Tab and Shift+Tab presses never leave the sheet. Escape returns focus to Going. The Design button moves above the sheet and comes back when it closes.
  3. **Keyboard only.** Tab from the top of the page to Going, then Enter, type the name, Enter (focus follows to "Just me"), Tab, Space on +1, Tab ×2, type the guest's name, Tab to Send, Enter, then Escape: focus is back on Going.
  4. **Reduced motion.** A control checks that with motion welcome the sheet's animation is `enter` and its transition is `height`. With `reducedMotion: "reduce"` emulated, at open and after a step change: animation `none`, transition `none`, `getAnimations({subtree:true})` empty.
- **`e2e/design.spec.ts`** adds three scenarios:
  1. **The RSVP style row.** Birthday starts on Sheet and a guest gets the dialog. Choosing Inline marks the theme "Custom, started from Birthday", and a guest then answers inline with no dialog. Festival selects Inline; Birthday again selects Sheet, and a guest gets the sheet.
  2. **The drawer's forms.** On a phone the drawer is a bottom sheet: edges polled flush left, right and at the foot, less than 70% of the height, the title above it, and the whole page scrollable above it. On desktop it is a side panel: at the right edge, over 90% of the height, less than half the width, with the page's content ending before it. In both, the page updates while the drawer is open (tone and font). On desktop the window is then resized to 390px and the drawer becomes the bottom sheet.
  3. **The drawer under reduced motion.** A control checks the animation is `enter` with motion welcome. Under `reduce`: `none`, with nothing running, including after a knob change.
- **`e2e/rsvp.spec.ts`** is now explicitly the Inline style's spec. `createPublished` takes `rsvpStyle`, which it sets through the Design drawer as a host would.
- Under the new Sheet default, 8 older scenarios failed. Each came back to the page expecting the inline confirmation in place of the buttons. `rsvp.spec.ts` (all of it) and five other tests (cancel, calendar there and then, host changes a guest's answer, two question tests) now set `rsvpStyle: "Inline"`, each with a one-line reason. The other 48 flow scenarios pass unchanged with the flow inside the sheet, which is good evidence that it is one flow.
- **`e2e/hosts.ts`**: see Concerns, item 1.

### Definitive run against the Compose test profile
- `fuser -k 3000/tcp`, then `docker compose --profile test up -d --build --wait` (exit 0), then `pnpm exec playwright test`.
- The first definitive run gave **131 passed, 11 failed**. All 11 failed at host email verification with Better Auth's `{"message":"Too many requests. Please try again later."}` (Concerns, item 1).
- After the test-helper fix (test files only; the image already held the final source): **`142 passed (1.8m)`**.
- I then restarted the same image, first confirming no file under `src/`, `messages/`, `public/` or the config was newer than the image, and ran the suite on the exact committed state: **`142 passed (1.9m)`**, exit 0.
- Stability: `pnpm exec playwright test e2e/rsvp-sheet.spec.ts e2e/design.spec.ts --repeat-each=4` gave **72 passed**.
- In a dev-mode run of the Sheet flow and the drawer, no console warnings or errors were logged.
- The app container and dev server are stopped, and port 3000 is free. Only db and mail are running, as I found them.

### Visual pass
- Screenshots at 390px and 1280px:
  - the Birthday sheet at the name, plus-ones and confirmation steps, the closed state, and the dark tone
  - Vows on the sheet
  - Festival inline
  - the drawer in both forms
  - the host's RSVP sheet over their open drawer
- The sheet's plum and white frosts read cleanly and look like the prototype. The invitation stays visible above the sheet, and on desktop the page sits beside the side panel.

## Files changed
- `src/themes/`:
  - `theme.ts`, `changes.ts`, `changes.test.ts`
  - `legibility.ts`, `legibility.test.ts`
  - `resolve.ts`, `resolve.test.ts`
  - `themed-page.tsx`, `rsvp-buttons.ts`, `templates/vows.ts`
- `src/app/e/[slug]/`: `rsvp-flow.tsx`, `design-panel.tsx`, `design-drawer.tsx`
- `src/app/globals.css`
- `messages/en.json`
- `e2e/`:
  - `rsvp-sheet.spec.ts` (new), `design.spec.ts`, `rsvp.spec.ts`
  - `events.ts`, `hosts.ts`
  - `cancel-delete.spec.ts`, `conveniences.spec.ts`, `guest-list.spec.ts`, `questions.spec.ts`
- Not staged, as required: `.scratch/openinvites/issues/11-design-drawer-sheet-and-adaptive.md` (status `done`, boxes ticked, dated comment added).
- Not touched: `CONTEXT.md`, `.scratch/openinvites/decisions.md`, `.claude/`, `.superpowers/` (apart from this report).

## Self-review
- **One flow.** There is a single step list, form, actions, validation and confirmation; the containers differ only in `Glass` versus `RsvpSheet` and the "Show my RSVP" line. No flow logic is forked.
- **Rulings.**
  - The legibility rule covers the sheet in both tones on every background, with its own tests.
  - One existing breakpoint (`md`) drives a CSS-only switch.
  - Radix provides the focus trap.
  - Focus returns to the opener.
  - Reduced motion is tested by emulation, with controls so the tests are not vacuous.
  - The template choices are explained in the ticket comment.
- **Changes beyond the ticket, all small and explained in the code:**
  - the Enter-on-button behaviour
  - `autoFocus` replaced by a `preventScroll` focus
  - `motion-reduce` on the status buttons' colour transition
  - the `strengthsOn` fold in `legibility.ts`
- **Edge cases I considered:**
  - The host switches style mid-step: the sheet never pops open by itself; `sheetOpen` is only set by the guest's actions and cleared whenever the sheet closes.
  - The guest closes the sheet mid-send: the saved answer lands and the "You replied as" line shows.
  - Cancelled event: "Show my RSVP" still opens the confirmation, and Change my answer returns to disabled buttons. Focus then has nowhere enabled to go.
  - The host has the drawer open while the guest's sheet is open (their own page): the sheet sits above the drawer, `z-60` over `z-50`.
- **Glossary.** UI copy uses "RSVP" and verb-form "replied". I introduced no avoided words.

## Concerns
1. **Better Auth's rate limiter against the browser suite.** This concern is outside the ticket. Better Auth's limiter is on in production builds.
   - How it counts: each (client address, path) gets 100 requests, and the count only resets after ten quiet seconds.
   - Why the suite hits it: the verification link (`/api/auth/verify-email?token=…`) is the one limited endpoint the browser opens directly. Its token is in the query string, so every host shares one bucket. The test profile has no proxy to tell clients apart, so the suite's 101st verification is refused. Ticket 10's run was just under that number; my 14 new scenarios pushed it over.
   - What I changed: `verifyEmail` in `e2e/hosts.ts` now sends a random private-range `X-Forwarded-For` per host. That is the header the example reverse proxy would set, and Better Auth reads it. This is a test-infrastructure change, not a product change.
   - The production side is **ticket 18's to decide**. With no trusted proxies configured, Better Auth believes any single-value `X-Forwarded-For`, so the limit can be spoofed. With no header at all, every client shares one bucket per path, so an instance run without a proxy would refuse its 101st verification in any busy stretch. When ticket 18 configures `advanced.ipAddress` or its own limiter, the test header needs revisiting.
2. **The default guest experience changed.** Every new event starts from Birthday, so guests now meet the Sheet by default. `decisions.md` still says "inline stepper by default". Worth a line from the maintainer, but I did not edit the file.
3. **Vows' RSVP style is a design call** that departs from the prototype (Inline to Sheet). The maintainer's eye is welcome.
4. **Accessibility checks left for ticket 20.** The disabled Continue button in the sheet is the accent at 50% opacity, as it was inline. Focus-ring contrast on the sheet was not checked for 3:1.
