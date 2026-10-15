# Task S1 report: the browser suite, from empty volumes

**Status:** DONE_WITH_CONCERNS (every checkbox met; the concerns are at the end, and none blocks)

Commits on `m1-remaining`:

- `2990767` RSVP sheet: its controls stay where the guest sees them while it grows and shrinks
- `a3ef78c` Browser tests: the hostile paste is saved once the editor has settled

## In one paragraph

The three flakes are the same mechanism: **a control moves between the press and the release
of a click.** Playwright checks the hit target only on the first mouse event of a click and
caches the result (`setupHitTargetInterceptor` in playwright-core 1.63:
`if (result === void 0 && point) result = this.expectHitTarget(...)`). So when the control
slides away after the press, the release lands on whatever slid under the pointer, and the
browser sends the click to the nearest common ancestor of the two. Nothing is chosen, nothing is
sent, and Playwright reports the click as done. Two of the three were in the product: in the
Sheet RSVP style, the steps' controls slid for about 300 ms after a step changed size, starting
a few frames late, so a guest's quick tap could miss as well. I fixed that in the product, and a
test now shows it. The third was the hostile-paste test's own injected picture, which pushed
Save down 16 px at an arbitrary moment when it failed to load. The test now waits for the editor
to settle. None of the three was a click before hydration, and none depended on the volumes
being empty.

## Flake 1: `rsvp-sheet.spec.ts`, "a guest answers in a sheet…" (ticket 11)

**Reproduced** on the first from-empty run (separate Compose project `oi-s1`, `down -v` then
`up --build --wait`, `--trace retain-on-failure`): 176 passed, this one failed at 390 px (test
71 of 177, so not late in the run). It failed as before: after the second "Send RSVP", "You're a
maybe." did not appear.

**Evidence:**

- **The failure's aria snapshot.** The sheet was on the plus-ones step, with "Just me" checked,
  Send RSVP enabled (not pending), and no alert.
- **The trace's network log for the guest's page.** It has exactly three requests after the
  page opened: the page, one server-action POST (the first "Going" save), and the reload. There
  is no POST after the second Send RSVP. The Playwright log for that click reads "element is
  visible, enabled and stable" (after one check, 90 ms), then "performing click action", then
  "click action done", with no retry.
- **An instrumented copy of the scenario, repeated under parallel load** (logging each
  mousedown, mouseup, click and submit, with its target and whether that target was hydrated,
  i.e. carried a React fiber). On the old image it failed 4 times in 306 runs. For example:
  ```
  mousedown on BUTTON "Send RSVP" at 640 610 hydrated= true
  mouseup   on BUTTON "+1"        at 640 610 hydrated= true   (4 ms later, same point)
  click     on FORM ...           at 640 610                  (no requestSubmit, no POST)
  ```
- **Frame by frame, the Send button after "Just me"** (old image, desktop). In the click it was
  at y=719. Then 555 at 35 ms and still 555 at 83 ms: the guest fields had gone, so it jumped up
  164 px and held still for two frames. Then 627, 656, 685, 698, 711, 716, and 719 by 380 ms,
  while the sheet's height went from 406 to 242.

**Root cause (product).** The sheet is fixed to the foot of the screen and takes its content's
height a frame or more after the content changes: a ResizeObserver sets React state, which sets
`height`, which a 300 ms CSS transition animates. Its content was laid out from the sheet's top.
So each change of a step's size moved every control below the change twice: at once by the size
of the change (the content changed, the sheet had not), then back again over 300 ms as the
height caught up. The pause between the two (two frames here, longer on a busy machine) is
enough for Playwright's stability check, which wants the same box on two consecutive frames. It
then presses the control at its temporary place, and the slide takes the control away before
the release. A guest who taps within those 300 ms misses the same way, and everyone sees the
button jump up and slide back.

**Why it looked tied to empty volumes and late runs.** The evidence doesn't bear that out. The
run above failed at test 71 of 177. The instrumented copies failed on a stack whose database was
no longer empty, and passed 60 of 60 under 4x CPU throttling of the browser. What matters is how
the machine's load happens to fall around one click. The persistent stack's clean runs were luck:
the instrumented copies failed about once in 75 runs of one scenario.

## Flake 2: `guest-list.spec.ts`, "the host sees every guest's details…"

The same mechanism, in the same sheet (a new event starts from Birthday, so the Sheet style).
This event asks for an email, so the name step is taller than the plus-ones step, and "Continue"
shrinks the sheet.

- **An instrumented copy failed once in its share of the repeats above:**
  ```
  mousedown on BUTTON "+1"                          at 639 583
  mouseup   on P "You can bring up to 2 people."   at 639 583   (17 ms later, same point)
  click     on DIV (the step)                       at 639 583
  ```
  So "+1" was never chosen and "Guest 1" never appeared: "the +1 choice did not take".
- **Frame by frame after Continue:** "+1" appears at y=603, holds for two frames (17 ms, 44 ms),
  then slides 96 px down to 699. The chip is 48 px tall.
- **Not hydration.** Ticket 04's reviewer suspected a click before hydration. Every target in
  every failing run was hydrated.

## Flake 3: `description.spec.ts`, "a hostile paste leaves nothing but words behind"

This did not appear in the brief. It showed up in my own from-empty runs (1 failure in 12 runs of
the scenario across the full suites). After "Save changes", "Saved." never appeared.

**Evidence from its trace:**

- The host's page made no POST after the click. The test's own markup
  `<img src=x onerror="alert(3)">` requested `/events/x`, which failed (500) at about 148335 ms.
  "Performing click action" was at 148332 and "click action done" at 148363.
- The screencast frames at 148348 and 148389 show the browser's broken-image icon appearing on
  its own line in the editor, and the whole form below it, Save changes included, moving down
  16 CSS px (10 px in the 0.625-scale frames), during the click's press and release.
- **On demand** (holding the picture's request with `page.route`): Save changes is 32 px tall. It
  is at y=716 while the picture loads and at y=732 once it fails, 16 px lower, which is half its
  height. That takes a press at its centre off it.
- **Ruled out:** the `alert(3)` the picture raises opens at the same moment. In isolation
  (Chromium, `alert` raised in mousedown or mouseup handlers, or from a separate task 0 to 10 ms
  after the pointer arrives or after the press), 0 of 102 clicks were lost. So the alert alone does not
  explain the failure; the layout shift does.

**Root cause (test).** The test simulates what a hostile page would leave by setting the editor's
`innerHTML`. The product's `onPaste` already turns a real paste into plain text, so a host cannot
get a live picture into the editor that way. The picture really loads in the host's browser, and
when it fails, the form below it moves at an arbitrary moment relative to the next click.

## What I changed and why

1. **Product: `src/app/e/[slug]/rsvp-flow.tsx`** (`RsvpSheet`). The sheet holds its content to its
   foot: `flex flex-col justify-end` on the sheet, and `shrink-0` on the scrolling content, so
   the content keeps its natural height (up to 80dvh) instead of being squeezed into the
   animating one, which would stop the sheet growing. While the height animates, only the
   sheet's top edge moves. Every control is drawn in its final place in the same frame as the
   change, and nothing slides afterwards. On the new image, frame by frame, each control has
   exactly one y position from the change until the sheet has settled (for example, Send RSVP
   at 763 on every frame while the sheet shrinks from 406 to 242). The settled sheet looks as it
   did. While it grows, its top edge rises over the new step's heading instead of its foot
   covering Send. I checked screenshots at 390 px. The height transition, the rise, and reduced
   motion are untouched.
2. **Test: `e2e/rsvp-sheet.spec.ts`**, "a guest answers in a sheet…". Two checks that the Send
   button is where the guest saw it: right after "+2" (the sheet grows) and right after
   "Just me" (it shrinks, the step that flaked). The second waits for the re-opened sheet to
   finish rising first, with the spec's own `settled`, called right after opening as the spec
   already does. Both fail against the old product: 6 of 6 each, the second checked on its own
   with the first removed, with the product change reverted and `app` rebuilt. Both pass
   against the fix.
   - Two things I got wrong on the way. Measuring before the sheet finished rising left me
     2.1 px off once, in a full run. Then calling `settled` after Continue rejected with an
     AbortError, because `animation.finished` rejects when a height transition is replaced
     mid-way. The final version settles right after opening, where only the rise runs.
3. **Test: `e2e/description.spec.ts`**, "a hostile paste…". After the paste it waits for
   `expect(editor.locator("img")).toHaveJSProperty("complete", true)`: the browser has given up
   on the picture and drawn its broken icon, so the form has stopped moving, and then the host
   saves. The payload is unchanged.
4. **No helper changed.** `e2e/hosts.ts` and `e2e/events.ts` click nothing that moves. The general
   fix is in the product, where every spec that answers in the sheet benefits (guest list,
   questions, conveniences, cancel, the Sheet spec itself). No sleep, no raised timeout, no
   retries, nothing skipped.

## Runs

The from-empty harness is `COMPOSE_PROJECT_NAME=oi-s1`: `docker compose --profile test down -v`,
then `up -d --build --wait`, then `pnpm exec playwright test --trace retain-on-failure`. The
variable, not only `-p`, matters: the fresh-instance specs' `recreate()` calls
`docker compose --profile test` without `-p`, and would otherwise recreate the default project's
`app-fresh` and `app-no-mail`. The default project was stopped meanwhile, since both use the same
host ports. There are 177 tests: 88 scenarios at two widths, the operator setup, and the
fresh-instance scenarios.

| Run | Code | Result |
| --- | --- | --- |
| r1, from empty | before the fix | 176 passed, 1 failed (rsvp-sheet, mobile) |
| instrumented copies | before the fix | 4 failed of 306 (3 sheet, 1 guest details); 0 of 60 under 4x CPU throttle |
| instrumented copies | product fix | 0 failed of 160 |
| r2, r3, from empty | product fix, before a comment moved | 177 passed, 177 passed |
| r5, from empty | product fix | 176 passed, 1 failed (description: flake 3, found here) |
| r6, from empty | product fix | 176 passed, 1 failed (my new check measured mid-rise; fixed as above) |
| repeats of the two edited specs | final | 129 passed (8 repeats) |
| **r7, r8, r9, from empty, consecutive** | **final** | **177, 177, 177 passed** (no failures; the diff was checked unchanged across the three) |
| **persistent local stack** | **final** | **177 passed** (default project, `db-data` kept, images rebuilt) |

Also run: lint, `pnpm typecheck`, and `pnpm test` (281 unit tests) pass. The Vite
`configLoader` warning in `pnpm test` was there before this task.

## Files changed

- `src/app/e/[slug]/rsvp-flow.tsx`
- `e2e/rsvp-sheet.spec.ts`
- `e2e/description.spec.ts`

## Concerns

- **A visible change to the sheet.** It now grows and shrinks from its top edge with its content
  held at the foot. For up to 300 ms, the rising edge reveals the new step's Back button,
  progress bar and heading, where before the foot hid Send. The settled look is unchanged.
  The maintainer may want to see it (ticket 11's look).
- **A separate product bug, not fixed (out of scope):** `/events/<anything not a uuid>` returns
  500, because the id reaches Postgres as a uuid (`invalid input syntax for type uuid: "x"`),
  where it should be Not Found. The hostile-paste test's broken picture requests `/events/x`, so
  every suite run logs two stack traces from `app`. A fit for ticket 18 (hardening), or a
  one-line `isUuid` check in `findHostEvent`'s callers.
- **CI would have hidden these.** It runs with `retries: 1` and `trace: on-first-retry`, so each
  of these flakes would have passed on its retry, reported only as "flaky". I did not change
  that (the brief forbids raising retries, and lowering it was not asked for). The
  from-empty harness here runs with no retries.
- **The class of bug can come back.** Because Playwright checks only a click's first event, any
  interface that moves a control a frame or more after a change can flake the same way. I looked
  for others. The drawer's panel has no height transition. The page's entrance animation moves
  pieces 16 px over 700 ms, which, between a press and a release a few milliseconds apart, is a
  pixel or two, too little to take the pointer off any control.
- The spec's `settled` helper rejects if called while a height transition is being replaced. I
  used it only right after the sheet opens, where it was already used.

## Housekeeping

- The separate project `oi-s1` is torn down with its volumes and images
  (`down -v --rmi local`). The default project `openinvites` is back up with the test profile
  as it was at the start (`db`, `mail`, `app`, `app-social`, `app-fresh`, `db-fresh`,
  `app-no-mail`, `db-no-mail`), so port 3000 is held by its `app` container. I started no dev
  server.
- The instrumentation (a temporary `e2e/zz-s1-debug.spec.ts`) and the scratch scripts lived
  only in the session scratchpad and are not in the tree. Nothing under `.claude/` or
  `.superpowers/`, and neither `CONTEXT.md` nor `decisions.md`, was staged.
- No glossary or decision change is needed.
