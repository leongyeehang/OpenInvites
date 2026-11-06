# 05: Translations, accessibility, screenshot and docs

**What to build:** The final pass: the new dashboard and frame pass every check the rest of the app passes, read naturally in both Chinese scripts, and are in the README and the release note.

**Blocked by:** 02, 03, 04

**Status:** open

- [ ] `accessibility.spec.ts`, `keyboard.spec.ts`, `locales.spec.ts` and `reduced-motion.spec.ts` cover the dashboard with no events and with events on every shelf (Next up with a pending reply, Coming up, Drafts, Past), at 390 px and at desktop width, and the open account menu.
  - Keyboard: from the top of the dashboard, Tab reaches New event, Account menu, Next up's poster link, Guests, Edit, Share, then every tile in order, each with a visible ring.
  - Locales: zh-Hans and zh-Hant by Accept-Language show the shelves' headings and chips in that script.
  - Reduced motion: nothing on the dashboard moves (`expectStill` from `e2e/still.ts`).
- [ ] Every new key reads naturally in zh-Hans and zh-Hant. The maintainer reads both, so the ticket comment lists the strings the implementer was least sure of.
- [ ] `pnpm screenshots` gains `dashboard.webp` (phone, 390x844 at 2x): a host on `app` with a published event that has replies and one waiting for approval, a second upcoming event, a draft and a past event, each on a different gallery poster. README shows it beside `home.webp`.
- [ ] Release note: a section "Your events open as their posters" in `.scratch/m4-extras/release-note-0.5.0.md` if `v0.5.0` has not been tagged when this ticket starts, otherwise in a new `.scratch/dashboard/release-note-0.6.0.md`. It covers the dashboard, the header and account menu ("Instance settings" is now "Site settings", in the menu under your initials), and the wording change.
- [ ] Full checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the full browser suite on the Docker test profile with `CI=1`, with the totals in the ticket comment.

## Notes for the implementer

- The home page's final pass (`.scratch/home-page/issues/05-translations-accessibility-docs.md`) is the model for the comment and the evidence.
- Commit subject, e.g. `Final pass: the dashboard reads in both Chinese scripts and passes every check`.

## Comments
