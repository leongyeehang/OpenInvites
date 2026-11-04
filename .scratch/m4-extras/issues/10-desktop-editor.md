# 10: The editor on a desktop

**What to build:** On wide screens the invitation stays phone-width in the centre, the toolbar floats under it, and every sheet opens as a side panel to the right without shrinking the invitation.

**Blocked by:** 06 Design sheets, 07 The Settings sheet

**Status:** done

- [x] At `lg` and up: the invitation column `max-w-[28rem]` centred; the toolbar a floating bar under it; sheets a right-hand panel (`w-[24rem]`), the invitation sliding left to stay in view, not scaled. Below `lg`, the phone behaviour.
- [x] The More menu and the share sheet behave the same at both widths.
- [x] Browser at 1280×800: each sheet opens beside the invitation and the invitation stays visible and unscaled; keyboard and accessibility rows.

## Notes for the implementer

- Commit subject, e.g. `Editor: on a desktop the sheets open beside the invitation`.

## Comments

**2026-11-04, implementing agent (Opus, in the maintainer's session).** Done.

- The sheets' side panel (`w-96`, 24rem, right) now starts at `lg` rather than `md` (`editor/sheet.tsx`); below it, the phone's sheets from the foot, with the design sheets' live copy at half size (`design-sheet:max-lg`).
- From `lg`, while any sheet is open, the invitation and its floating toolbar slide left just far enough to clear the panel, at their own size (`editor-sheet-open` variant, `translate-x-[min(0px,calc(50vw-40rem))]`): at 1280 nothing moves, at 1024 the column slides by 124 px. More and the share page behave the same at both widths (More is a sheet like the others).
- The unused `rsvp-sheet-open` variant and a stale comment about the deleted Design panel are gone from `globals.css`.

Browser: `e2e/desktop-editor.spec.ts` at 1280×800 and 1024×768: Poster, Theme, Settings, When and More each open as a panel reaching the right edge, with the invitation 448 px wide, unscaled and wholly to its left; Escape closes each and gives the focus back to its opener; axe with the Poster sheet open; closed, the invitation and the toolbar are centred again. `design.spec.ts`'s two-forms row now uses 1024 as the line. Both passed.

**2026-11-04, the browser run.** `docker compose --profile test up -d --build --wait` from the working tree of tickets 09, 10 and 11 together, then `CI=1 pnpm exec playwright test --workers=2`, every project: **566 passed, 0 failed, 0 flaky, 2 skipped** (the desktop editor's rows, which set their own viewport, run in the desktop project only) in 58.5 min. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 829 passed (80 files).
