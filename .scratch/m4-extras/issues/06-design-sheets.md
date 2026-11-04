# 06: Poster, Title, Theme and Effect sheets

**What to build:** The editor's toolbar buttons Poster, Title, Theme and Effect, each a half-height sheet of large swatches over a live, shrunken copy of the invitation. They replace the Design drawer.

**Blocked by:** 02 The gallery posters, 05 The invitation is the editor

**Status:** done

- [x] Poster sheet with four tabs. **Gallery**: occasion chips, a three-column grid; picking applies the poster's look. **Emoji**: up to three from a palette of 24 or typed (grapheme-split, pictographic only), seven background colours; drawn on a canvas in the browser and saved as an upload with `origin: "emoji"` (spec), redrawn and replaced on each change, debounced; reopening shows the saved choice. **Colour**: the nine colour posters. **Upload**: 0.4's upload with its limits, errors and "Describe your picture".
- [x] Title sheet: the four fonts, each tile showing the event's own title in it; On the poster / Below the poster.
- [x] Theme sheet: accent (Auto + six), page Auto / Dark / Light (the text tone), button style, Layout (Poster, Broadsheet, Thread).
- [x] Effect sheet: None, Sparkles, Confetti (choosing it plays it once, unless reduced motion), Doodles.
- [x] While one of these is open the invitation shrinks to a live copy above it (transform only, no reflow; none under reduced motion); a tap on the copy closes the sheet. Every choice saves at once through `changeThemeAction` with the drawer's "Saving…/Saved/failed" behaviour.
- [x] Sheets are dialogs: heading focused on open, Escape closes, focus returns to the toolbar button, `aria-expanded` on the button.
- [x] Delete `design-drawer.tsx`, `design-panel.tsx` and the drawer's message keys; the editor's Design button goes.
- [x] Browser: each tab changes the poster (assert the page's poster source and the guest view); a gallery pick changes the font and effect; the emoji poster survives a reload and shows its emoji in the sheet; a colour puts the title on the poster; the upload rows of `uploads.spec.ts` and `poster.spec.ts` move here; layout switch to Broadsheet and back. Keyboard, accessibility and reduced-motion rows for every sheet.

## Notes for the implementer

- Commit subject, e.g. `Editor: Poster, Title, Theme and Effect open on the invitation itself`.

## Comments

**2026-11-03, implementing agent (Opus, in the maintainer's session).** Done.

- `src/editor/design-sheets.tsx`: Poster (tabs Gallery, Emoji, Colour, Upload; it opens on the tab of the poster shown), Title (the four faces showing the event's title; On or Below the poster for a picture), Theme (accent, Page Auto/Dark/Light, which maps to the text tone, RSVP buttons, Layout), Effect (confetti plays once on choosing it, not under reduced motion). The shared tiles moved to `src/editor/choices.tsx`.
- Emoji posters (`src/uploads/emoji.ts`): up to three from a palette of 24 or typed (grapheme-split, pictographs and flags only), seven backgrounds, drawn on a 1200×1500 canvas, uploaded with `?emoji=&background=` and kept as an upload with `origin: "emoji"`; reopened, the sheet shows the saved choice.
- Upload: 0.4's limits, errors and "Describe your picture"; a picture put aside by a colour or gallery poster comes back with "Show your picture".
- A design sheet takes 52 dvh on a phone, and the invitation above it scales to half (`design-sheet` variant, the CSS `scale` and `translate` properties, no reflow, no transition under reduced motion); a tap on the copy closes it. From `md` it is a side panel. Toolbar buttons carry `aria-expanded`; the heading has the focus on opening, and the button has it again on closing. "Restore the look" leaves the focus on the sheet's heading as it goes.
- `design-drawer.tsx` and `design-panel.tsx` are deleted; the guest page has no designer; messages `DesignDrawer` became `Design`.
- Browser: `design.spec.ts` (each tab, the emoji poster across a reload, layout switch and back, the two forms of a sheet, confetti once) and the rows that used the drawer moved to the sheets: `poster`, `uploads`, `duplicate`, `keyboard` (a poster, a font and the restore by keyboard; the rings in the sheets), `reduced-motion`, `theme`, `rate-limits`, `sharing`, `thread`, `accessibility`, plus `perf/event-page.perf.ts` and `scripts/screenshots.ts`.

Not done here: `docs/screenshots/design-drawer.webp` and its README caption still show the drawer until `pnpm screenshots` is run again (ticket 12).

**2026-11-03, the browser run.** `docker compose --profile test up -d --build --wait` from the working tree of tickets 03, 05, 06 and 07 together, then `CI=1 pnpm exec playwright test --workers=2`, every project: **538 passed, 2 failed, 1 flaky** in 59.9 min. The two failures were one row of `rsvp-sheet.spec.ts` still measuring the guest page's Design button, which ticket 06 removed; rewritten, the file passes (11 of 11). The flaky row, `accessibility.spec.ts:451` (dark tone), once saw a page with no `<title>` just after a comment was posted and passed on retry; repeated three times each tone, it passed every time. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 796 passed (75 files).
