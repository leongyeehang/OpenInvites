# 03: The poster-first guest page

**What to build:** The Poster layout as the mockup's guest view: the poster full width, the title on it or below it, the details as one list, the reply buttons pinned to the bottom on phones, and the page phone-width on desktop. Broadsheet and Thread take the poster where they took the background.

**Blocked by:** 01 The poster model

**Status:** done

- [x] `poster-layout.tsx` and `poster-card.tsx` rebuilt to the mockup (spec, "The guest page"): poster full bleed, fading into its blurred copy when the title is below; on the poster, title and date on the scrim; the host line; one frosted list of When (countdown, Add to calendar), Where (Open in Maps), About; then Who's coming, Announcements, Comments as panels. The date sticker goes.
- [x] Under `md`: Going, Maybe, Can't go in a bar fixed to the bottom (safe-area inset), the RSVP sheet opening from it; after a reply the bar reads the reply with Change. At `md` and up: a centred column `max-w-[28rem]`, the bar at the column's foot, sticky.
- [x] The RSVP style knob is ignored by the Poster layout (always the sheet); still parsed.
- [x] Broadsheet and Thread: the blurred poster behind the page in every poster kind; Broadsheet shows the poster beside its title as it shows an upload poster today.
- [x] Every guest-facing behaviour of 0.4 holds: steps, questions, email codes, waitlist, approval, personal invites, the locked guest list, comments, announcements, cancelled and draft notices, effects, reduced motion.
- [x] Browser: the existing rsvp, poster, broadsheet, thread, capacity, approval, invites, email-code, comments, effects specs updated where they find things by layout; new rows for the pinned bar at 390 px (visible at the top and the foot of a long page, the sheet opens from it, focus returns to it) and the desktop column. Accessibility and keyboard rows for the bar. The pixel contrast audit of ticket 13 rerun over the new surfaces.

## Notes for the implementer

- Commit subject, e.g. `Guest page: the poster comes first and the reply buttons stay in reach`.

## Comments

**2026-11-03, implementing agent (Opus, in the maintainer's session).** Done in `0430877`.

- `poster-card.tsx` and `poster-layout.tsx` follow the mockup: the poster full width, the title on it (on the scrim) or below it; the host line; one frosted list of When (countdown, Add to calendar), Where (Open in Maps) and About; then Who's coming, Announcements and Comments as panels. The date sticker is gone.
- The reply bar (`data-slot="rsvp-bar"`, `Rsvp.bar.*`): fixed to the foot on phones with the safe-area inset, sticky at the foot of the `max-w-[28rem]` column from `md` up; after a reply it reads the reply with Change. The sheet opens from it and the focus comes back to it.
- The Poster layout always uses the sheet; the RSVP style is still parsed and still used by nothing else. Broadsheet and Thread keep the blurred poster behind the page.
- Browser: the specs that found things by layout use `e2e/reply.ts`; new rows for the bar at 390 px and the column (`rsvp-sheet.spec.ts`, "the reply bar stays at the foot of the screen…"); the accessibility spec, contrast audit included, runs over the new page in both tones.

**2026-11-03, the browser run.** `docker compose --profile test up -d --build --wait` from the working tree of tickets 03, 05, 06 and 07 together, then `CI=1 pnpm exec playwright test --workers=2`, every project: **538 passed, 2 failed, 1 flaky** in 59.9 min. The two failures were one row of `rsvp-sheet.spec.ts` still measuring the guest page's Design button, which ticket 06 removed; rewritten, the file passes (11 of 11). The flaky row, `accessibility.spec.ts:451` (dark tone), once saw a page with no `<title>` just after a comment was posted and passed on retry; repeated three times each tone, it passed every time. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 796 passed (75 files).
