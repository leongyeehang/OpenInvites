# 06: Poster, Title, Theme and Effect sheets

**What to build:** The editor's toolbar buttons Poster, Title, Theme and Effect, each a half-height sheet of large swatches over a live, shrunken copy of the invitation. They replace the Design drawer.

**Blocked by:** 02 The gallery posters, 05 The invitation is the editor

**Status:** ready-for-agent

- [ ] Poster sheet with four tabs. **Gallery**: occasion chips, a three-column grid; picking applies the poster's look. **Emoji**: up to three from a palette of 24 or typed (grapheme-split, pictographic only), seven background colours; drawn on a canvas in the browser and saved as an upload with `origin: "emoji"` (spec), redrawn and replaced on each change, debounced; reopening shows the saved choice. **Colour**: the nine colour posters. **Upload**: 0.4's upload with its limits, errors and "Describe your picture".
- [ ] Title sheet: the four fonts, each tile showing the event's own title in it; On the poster / Below the poster.
- [ ] Theme sheet: accent (Auto + six), page Auto / Dark / Light (the text tone), button style, Layout (Poster, Broadsheet, Thread).
- [ ] Effect sheet: None, Sparkles, Confetti (choosing it plays it once, unless reduced motion), Doodles.
- [ ] While one of these is open the invitation shrinks to a live copy above it (transform only, no reflow; none under reduced motion); a tap on the copy closes the sheet. Every choice saves at once through `changeThemeAction` with the drawer's "Saving…/Saved/failed" behaviour.
- [ ] Sheets are dialogs: heading focused on open, Escape closes, focus returns to the toolbar button, `aria-expanded` on the button.
- [ ] Delete `design-drawer.tsx`, `design-panel.tsx` and the drawer's message keys; the editor's Design button goes.
- [ ] Browser: each tab changes the poster (assert the page's poster source and the guest view); a gallery pick changes the font and effect; the emoji poster survives a reload and shows its emoji in the sheet; a colour puts the title on the poster; the upload rows of `uploads.spec.ts` and `poster.spec.ts` move here; layout switch to Broadsheet and back. Keyboard, accessibility and reduced-motion rows for every sheet.

## Notes for the implementer

- Commit subject, e.g. `Editor: Poster, Title, Theme and Effect open on the invitation itself`.
