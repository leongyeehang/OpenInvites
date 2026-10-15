# 12: The Broadsheet layout

**What to build:** The editorial layout from the prototype: a masthead, one very large title, a facts grid, the description in columns, a typeset guest list, and a single ballot form that is sticky on desktop. The Supper club template applies with it. Every rule of the guest flow is shared with Poster.

**Blocked by:** 06 Comments, 08 Multiple-choice questions, 11 Effects (the layout must render all of them)

**Status:** done

- [x] The RSVP flow's rules are one implementation. If the Poster flow (`src/app/e/[slug]/rsvp-flow.tsx`) holds state and rules its components cannot share, pull the state machine and the submit path into `src/rsvps/flow.ts` (or similar) as a hook the layouts call, with the Poster layout rewired to it and every Poster browser test still passing before Broadsheet is started. This is the only refactor allowed, and it is part of this ticket.
- [x] `OFFERED_LAYOUTS` gains `broadsheet` (Thread stays "coming soon" until ticket 13). `applyTemplate` applies a template's layout when offered; the Supper club template now applies as Broadsheet. `resolveTheme` carries the layout through instead of forcing `"poster"`. The drawer's layout row makes Broadsheet choosable and hides the RSVP style row under it. Changing layout keeps every other knob.
- [x] `src/themes/broadsheet-layout.tsx`, from `layout-broadsheet.tsx` on the prototype branch (spec, "Broadsheet"): masthead with "Invitation" and "Hosted by …"; the title at `clamp(3.5rem, 14vw, 8.5rem)` for serif and smaller for the others, or the poster with the title on or below it; the facts grid (When with the viewer's time, Where with the map link, Host with the headcount, Countdown with a large number and "days to go"/"hours to go"); the description under "The details" in two columns from `sm`; announcements under "From the host"; the guest list as a numbered list with "+N", "you", blur under the after-reply setting, Maybe as a line; the comments section. The ballot: a glass card, sticky on `lg`, radio list, name, plus-ones stepper with names when required, questions of every type, "Post my reply"; the confirmation with a tilted "Received" stamp in the accent, the status, the summary, calendar links, the edit link with Copy, and "Amend reply", "Change answer", "Remove my RSVP". The draft, cancelled and retired notices; the Design drawer.
- [x] Legibility: every text and surface uses the theme tokens (`themeVariables`); mono labels and rules use the text colour at reduced opacity, as the tokens define. `legibility.ts` checks whatever new surface the ballot adds, as it checks the sheet.
- [x] The layout sketch and notes in the drawer say what Broadsheet is (`DesignDrawer.layouts.broadsheet.note`).
- [x] Unit tests: `applyTemplate` with Broadsheet offered; `resolveTheme` carrying the layout.
- [x] Browser tests (`e2e/broadsheet.spec.ts`), at 390 and desktop: a guest completes the flow (Going, two plus-ones with names, a required single-choice and a multiple-choice question), sees the Received stamp, the edit link, and their name in the numbered list; changes to Can't go and the list drops them; removes their RSVP; the guest list visibility settings behave as on Poster; announcements and comments render; the cancelled event shows the notice and a disabled ballot; the accessibility spec (`e2e/accessibility.spec.ts`) runs its event-page and RSVP checks on Broadsheet too; the keyboard spec completes the ballot by keyboard.

## Notes for the implementer

- The prototype worktree is at `.claude/worktrees/agent-a4e08520ae236ba41` and read only; it uses Motion, which is not a dependency here. Entrance animations are CSS, and stop under reduced motion.
- `data-layout` is already set on the page root (`themed-page.tsx`); CSS specific to a layout keys off it.
- Commit subjects: one for the flow refactor if any (`RSVP flow: the rules of replying are one module every layout calls`), one for the layout (`Layouts: the Broadsheet layout, an editorial page with a single ballot`).

## Comments

**2026-10-08, implementing agent.** Done. `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 62 files, 491 tests passed; 163 browser tests passed against a production build of the final commit (`--workers=2`): broadsheet, rsvp, rsvp-sheet, questions, conveniences, effects, keyboard, accessibility, reduced-motion, design, theme, poster, comments, announcements, guest-list.

Commits: `41d0ec7` RSVP flow: the rules of replying are one hook every layout calls; `66fa5d3` Event page: the comments and announcements sections are shared by every layout; `4d9ac68` Layouts: the Broadsheet layout, an editorial page with a single ballot. Review fix: `d264fbb` Layouts: the Broadsheet's reply button wears the theme's button style.

How it landed:
- **The flow hook** (`src/app/e/[slug]/use-rsvp-flow.ts`, `41d0ec7`). `useRsvpFlow(props, land)` holds the step, the draft, the refusals, saving through `saveRsvpAction`, removing through `removeRsvpAction`, and the confetti count (`confettiFor` inside `send`). It lives beside the event page rather than in `src/rsvps/` because it is a client hook that calls the server actions and reads the page's theme, not a pure rule. `RsvpFlow` (Poster, Inline and Sheet) is now a presentation over it and keeps its own sheet, step headings, Enter-to-continue and focus refs. Every Poster flow spec passed on this commit alone (71 tests).
- **Shared sections** (`src/themes/sections/`, `66fa5d3`). `AnnouncementsSection` and `CommentsSection` render a section's body (the list, the locked count, the delete dialog, the form where allowed); each layout frames it and gives it its heading. The Poster's DOM is unchanged; its comments, announcements and poster specs passed on this commit (27 tests).
- **Plumbing.** `OFFERED_LAYOUTS = ["poster", "broadsheet"]`. `applyTemplate` applies an offered layout, so Supper club applies as Broadsheet and Kids' party still as Poster. `ResolvedTheme.layout` is a `Layout`; `resolveTheme` carries the stored layout and renders one not offered yet (Thread) as Poster. `KnobChange` has `{ knob: "layout" }`, which `parseThemeChange` accepts only for offered layouts. The drawer's Layout row chooses, and the RSVP style row shows only under Poster. Changing layout goes through the generic knob path, so every other knob is kept (unit-tested).
- **The page** picks the component by `resolved.layout` from the saved theme. It hands each layout its own flow presentation in the `rsvp` slot, because layouts under `src/themes` never import from `src/app`: `<RsvpFlow/>` for Poster and `<BroadsheetBallot/>` for Broadsheet, both with the same `RsvpFlowProps`. The Broadsheet takes the guest list as data (`guests: { view, guests, counts, you }`) rather than a slot, because its Host fact needs the headcount. Poster keeps its slot.
- **Broadsheet** (`src/themes/broadsheet-layout.tsx`, `broadsheet-title.tsx`, `broadsheet-guest-list.tsx`; `src/app/e/[slug]/broadsheet-ballot.tsx`, `broadsheet-receipt.tsx`; `CountdownFigure` in `viewer.tsx`):
  - The page is at most 64rem wide. The masthead reads "Invitation" and "Hosted by …" in mono small capitals (a `label-mono` utility in `globals.css`).
  - The title is `clamp(3.5rem,14vw,8.5rem)` for serif and `clamp(2.75rem,11vw,6.5rem)` for the other faces, at line height 0.92. In poster mode the host's poster comes first (Poster's `Picture` and `fitted`, now exported with a `sizes` prop), with the title on its foot over the Poster's title scrim, or large below it.
  - The facts grid has When (with the viewer's time), Where (with the map link), Host (plural when there are co-hosts, with the headcount when the list is open) and Countdown (one large number with "days/hours/minutes to go", or words once the event has begun or ended). Next come "The details" in two columns from `sm`, "From the host", the numbered guest list ("01", "+N", a "you" pill, maybes on one line, nobody who can't go), and the comments.
  - On `lg` the ballot is sticky in the second column. On a phone it comes straight after the facts rather than at the foot as in the prototype, so a guest does not scroll past the whole page to reply.
  - The ballot has native radio and checkbox inputs, drawn as marks in the text colour: three answers, then everything the chosen answer asks at once (name, email when asked, a plus-ones stepper with a name field for each, every question type), then "Post my reply". The receipt has a "Received" stamp tilted -8 degrees in the accent (it animates in under `motion-safe:` only), the status, the summary, the calendar, the edit link with Copy, and Amend reply / Change answer / Remove my RSVP.
  - The draft and cancelled notices and the Design drawer work as on Poster.

Decisions and things to know:
- **Legibility.** The Broadsheet's text is set on the page, not on glass. The page's text therefore sits on the veil (`bg-theme-veil backdrop-blur-xl`), the surface `legibility.ts` already solves for bare text (`SURFACES.page`), behind the same 24px blur the backdrop's extremes are measured under. The veil is clear on most backdrops (midnight, Supper club's, is 0) and up to 0.58 on others.
  - Accent as text is solved for glass, and on the veil it falls short of AA on many backdrops (measured: worst 3.41). So nothing outside the ballot uses accent ink. The countdown number is in the text colour, and the "you" pill and the Host pill are filled with the accent.
  - The ballot is the card glass the Poster's inline flow sits on, with its contents on the same surfaces, so it adds no surface. The one new stack is the comment box on the veil, `SURFACES.fieldOnPage`. Every token `toneTokens` solves is byte-identical before and after for every background, tone, accent and use (snapshot compared). The unit tests check the new stack, and a mutation of it fails 14 of them.
- **Calendar links** appear only in the receipt, as the ticket and the prototype have them. Since the review fix (`d264fbb`), `AddToCalendar` takes `inCard`, which the page sets under Broadsheet. In the receipt the links sit side by side once the card is 32rem wide (`@lg`), above the 31.5rem the three need on one line. On the Poster they stack until `sm`, exactly as before.
- **Copy reused, not duplicated:** `Rsvp.maybe`, `Rsvp.sheet.title` (the ballot's hidden legend "Your RSVP"), `Rsvp.name.*`, `plusOnes.*`, `summary.*`, `editLink.*`, `errors.*`, `remove`, `done.*`, and `EventPage.hostedBy`, `when`, `where`, `announcements`, `guests`, `locked`, `nobodyYet`, `headcount`, `status.maybe`, `happeningNow`, `ended`. New keys: `EventPage.broadsheet.*` (invitation, host, countdown, days/hours/minutesToGo, details, you) and `Rsvp.ballot.*` (title, pending, received, going, cant, plusOnes, fewer, more, post, amend, change), in all three files.
- **`DesignDrawer.layouts.broadsheet.note`** already existed ("An editorial page with one reply form.", translated). It shows now that Broadsheet is offered, and I left the wording alone.
- **Small behaviours.** Choosing the chosen answer of an optional single-choice question again clears it, as on Poster. The stepper's buttons are `aria-disabled` at their ends, so keyboard focus is never dropped. "Received" shows once, as the stamp, rather than also in the card's header.
- **Two refactors.** The ticket allows one. The second (shared sections) was the controller's ruling.

Left for later tickets or noted:
- **Ticket 13, the hook.** `useRsvpFlow(props: RsvpFlowProps, land: (target: "confirmation" | "status", status: RsvpStatus) => void)` returns:
  - `step`, `draft`, `change(patch)`, `recordAnswer(questionId, values)`
  - `steps`, `position`, `last`
  - `answer` (the saved one), `confirmed` (the saved answer while the confirmation shows, else undefined), `answering`
  - `refusal`, `withdrawRefusal`, `working`, `falls` (render `<Confetti key={falls}/>` where it will not remount)
  - `pick(status)`, `forward()`, `back()`, `stopAnswering()`, `send(formData)`, `withdraw()`, `changeAnswer()`, `editDetails()`

  `land` is called once the new state is drawn, to move the focus to your confirmation or to the status control for `status`. `send` takes a `FormData` with `status`, `name`, `email`, `plusOnes`, `plusOneNames` (one per plus-one) and `answer:<questionId>` (one per pick). Thread's chips can post hidden inputs, as Poster does, and step one question at a time with `steps`/`position`/`forward`/`back`.
- **Ticket 13, the sections.** `<AnnouncementsSection announcements={…} timeZone={event.timeZone} />` and `<CommentsSection comments={…} form={commentForm} slug={event.slug} timeZone={event.timeZone} />` render bodies only. Thread's "N comments" bubble can expand into `CommentsSection`, with its count from `comments.view === "locked" ? comments.count : comments.comments.length`.
- **Ticket 13, registering a layout:**
  1. Add it to `OFFERED_LAYOUTS`. The drawer's row enables it, "Coming soon" goes, `parseThemeChange` accepts it, `resolveTheme` carries it, and Kids' party applies with it.
  2. Update `changes.test.ts` ("Kids' party with the Poster layout"), `resolve.test.ts` (thread → poster) and `design.spec.ts` (Thread disabled).
  3. Add a branch in `page.tsx` for its layout component and flow presentation.
  4. Extend `e2e/events.ts`'s `layout` option and `chooseLayout`.
  5. Add any new client component that reads `Rsvp` messages to `client-messages.test.ts`'s list.

  If Thread sets text on the page rather than in glass bubbles, set it on the veil and never use accent ink there.
- **Ticket 15:**
  - `docs/contributing/templates.md:31` still says "Only Poster is offered today". I left it, following ticket 11's handling of the data-file guides.
  - The locale spec does not yet visit the Broadsheet (the spec extends the locale specs to every layout).
- **Ticket 15, the Chinese I am least sure of:**
  - `EventPage.broadsheet.daysToGo` / `hoursToGo` / `minutesToGo` as 天后开始 / 小时后开始 / 分钟后开始 (zh-Hant 天後開始 …). They are set under the large number, so they read "149 天后开始".
  - `broadsheet.countdown`: 倒计时 / 倒數.
  - `broadsheet.invitation`: 邀请函 / 邀請函.
  - `Rsvp.ballot.title` ("RSVP"): 回复 / 回覆.
  - `ballot.going` / `cant`: 我会来 / 来不了 (我會來 / 來不了).
  - `ballot.plusOnes` ("Guests with you"): 同伴人数 / 同伴人數.
  - `ballot.post`: 发送我的回复 / 送出我的回覆.
  - `ballot.amend` / `change` reuse the Poster's Chinese for "Edit details" / "Change my answer" (修改详情 / 更改回复; 修改資料 / 更改回覆), although the English differs.

Evidence:
- RED: `pnpm exec vitest run src/themes/changes.test.ts src/themes/resolve.test.ts` → 3 failed, 51 passed. Supper club applied `'poster'` instead of `'broadsheet'`; `parseThemeChange({ knob: "layout", value: "poster" })` was `undefined`; `resolveTheme({ layout: "broadsheet" }).layout` was `'poster'`.
- GREEN: `pnpm exec vitest run src/themes` → 8 files, 128 tests passed.
- Browser runs, production-build loop (`pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000 with `drizzle/`, `public` and `.next/static` copied in, Compose dev profile up), `--workers=2`:
  - After `41d0ec7`: rsvp, rsvp-sheet, questions, conveniences, effects and keyboard, 71 passed.
  - After `66fa5d3`: comments, announcements and poster, 27 passed.
  - After `4d9ac68`: the full list above, 163 passed (10.4 min).
- A mutation (dropping `grid-cols-1`) brought back a 198px sideways overflow at 390px. The broadsheet spec's overflow check caught it, and the change was restored.

**2026-10-08, implementing agent, review fix round 1** (`d264fbb`). Three findings fixed.
- **"Post my reply" follows the RSVP buttons knob.** It uses `cardButtonClasses(style)` in `rsvp-buttons.ts`: glass is the Poster's glass button, strong glass on the card (SURFACES.inset); solid is the accent; outline is a 2px border in the text colour with no veil behind it, since the card is already a surface the text reads on (SURFACES.card). Focus rings it inside, in its label's colour, as on the Poster. The receipt's three actions stay links.
- **Poster's calendar is as it was.** The links stack until `sm` again. The container rule applies only under Broadsheet, through `AddToCalendar`'s `inCard` prop. A container threshold shared by both layouts would have changed the Poster below 640px, where its card is already about 30.5–33rem wide.
- **Everyone who replied can't go.** The Broadsheet's guest list then says "No one yet" instead of showing an empty section.
- Evidence:
  - The new browser checks fail on `4d9ac68`'s build: the Post button stays `rgb(255, 195, 107)` under Outline; at 560px the second calendar link starts at 800px rather than at or after 844px; "No one yet" is not found.
  - They pass on the fixed build. `broadsheet`, `conveniences`, `rsvp`, `rsvp-sheet` and `design` passed 63 tests; the Broadsheet cases of `keyboard`, `accessibility` and `reduced-motion` passed 7; both runs on the production-build loop at `--workers=2`. lint, typecheck and `pnpm test` (491) are clean.
