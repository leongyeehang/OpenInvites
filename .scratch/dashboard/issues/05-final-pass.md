# 05: Translations, accessibility, screenshot and docs

**What to build:** The final pass: the new dashboard and frame pass every check the rest of the app passes, read naturally in both Chinese scripts, and are in the README and the release note.

**Blocked by:** 02, 03, 04

**Status:** done

- [x] `accessibility.spec.ts`, `keyboard.spec.ts`, `locales.spec.ts` and `reduced-motion.spec.ts` cover the dashboard with no events and with events on every shelf (Next up with a pending reply, Coming up, Drafts, Past), at 390 px and at desktop width, and the open account menu.
  - Keyboard: from the top of the dashboard, Tab reaches New event, Account menu, Next up's poster link, Guests, Edit, Share, then every tile in order, each with a visible ring.
  - Locales: zh-Hans and zh-Hant by Accept-Language show the shelves' headings and chips in that script.
  - Reduced motion: nothing on the dashboard moves (`expectStill` from `e2e/still.ts`).
- [x] Every new key reads naturally in zh-Hans and zh-Hant. The maintainer reads both, so the ticket comment lists the strings the implementer was least sure of.
- [x] `pnpm screenshots` gains `dashboard.webp` (phone, 390x844 at 2x): a host on `app` with a published event that has replies and one waiting for approval, a second upcoming event, a draft and a past event, each on a different gallery poster. README shows it beside `home.webp`.
- [x] Release note: a section "Your events open as their posters" in `.scratch/m4-extras/release-note-0.5.0.md` if `v0.5.0` has not been tagged when this ticket starts, otherwise in a new `.scratch/dashboard/release-note-0.6.0.md`. It covers the dashboard, the header and account menu ("Instance settings" is now "Site settings", in the menu under your initials), and the wording change.
- [x] Full checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the full browser suite on the Docker test profile with `CI=1`, with the totals in the ticket comment.

## Notes for the implementer

- The home page's final pass (`.scratch/home-page/issues/05-translations-accessibility-docs.md`) is the model for the comment and the evidence.
- Commit subject, e.g. `Final pass: the dashboard reads in both Chinese scripts and passes every check`.

## Comments

**2026-11-06, implementing agent (inline).** Done. `pnpm lint`, `pnpm typecheck` and `pnpm test` (83 files, 871 tests) pass. The whole browser suite on the Docker test profile, rebuilt with this change, `CI=1`, two workers: **629 passed, 2 skipped, 0 failed, 2 flaky** (1.4 h). The two skipped are `desktop-editor.spec.ts`'s two widths on the mobile project, which skip themselves there by design. The two flaky (each failed once and passed on its retry) are on pages this branch does not touch: the Thread layout's approval confirmation in `accessibility.spec.ts` (axe read `.my-3` at low contrast once) and `theme.spec.ts`'s largest-paint timing on desktop; see the repeat runs below.

How it landed:
- **The checks.** `e2e/dashboard.ts` has `hostWithShelves(browser, request, label)`: a host with an approval event that has a reply waiting (Next up), a later published event (Coming up), a draft and an ended draft (Past), with `SHELVES` naming them. On both projects (390 px and 1280 px): axe on that dashboard in `accessibility.spec.ts` (the empty dashboard, `/account` and the open menu are ticket 02's); a keyboard walk in `keyboard.spec.ts` from New event through Account menu, Next up's poster, Guests, Edit and Share, to a tile on each shelf, each ringed, and Enter opens the tile's event; both Chinese scripts by Accept-Language in `locales.spec.ts` (the host's session carried into a zh-CN and a zh-TW browser: the heading, the four shelves, "1 人待批准" / "1 人待核准" and the Guests button); and `expectStill` on that dashboard, and with a tile hovered, in `reduced-motion.spec.ts`.
- **A fault the walk found.** The header's site name showed no focus ring: it is cut short with `truncate`, whose `overflow: hidden` clipped the outline every other control shows. It now has a box-shadow ring of its own (`host-header.tsx`). The walk failed on it ("no ring on <a … href="/dashboard">OpenInvites</a>") before the fix and passes after.
- **Screenshot.** `scripts/screenshots.ts` gives the host a December draft on Candlelight and takes `dashboard.webp` on the phone host's dashboard (Mei's 30th as Next up, 4 going, 1 maybe, 1 can't go). It has no reply waiting for approval, and the picnic wears the birthday's poster: approval on the birthday would change `rsvp-sheet.webp`, and the phone picture shows only Next up above the fold (ledgered). Only `dashboard.webp` is committed; the other pictures it retook were restored from git. README shows it first in the host row.
- **Docs and release note.** `upgrade-backup.md`'s "Upgrading to 0.5" gains a bullet for the dashboard, the header and Site settings. The release note's new section "Your events open as their posters" is in `.scratch/m4-extras/release-note-0.5.0.md`, since `v0.5.0` is not tagged; its Upgrading paragraph and the Home page section say Site settings.

Chinese least sure of (all new in ticket 03, read again here): `nextUp` 下一场 / 下一場, `toApprove` 人待批准 / 人待核准, `places` "{count} / # 个名额", `went` 人参加了, `firstTitle` 做你的第一张邀请函, `firstButton` 开始制作邀请函, `datePoll` 日期投票进行中; and from ticket 04, 站点设置 / 網站設定 and 本站运营者 / 本站營運者.

Repeat runs (`--repeat-each=3 --retries=0`, both projects): `theme.spec.ts:127` passed 6 of 6. The Thread check failed 2 of 6, always on the "sent" date pill (`thread-layout.tsx:165`, faint text on the veil with a backdrop blur, which axe measures against whatever the blurred photo is when it looks). Nothing on this branch touches the Thread layout or the event page's colours, so it predates this work.

Left for later tickets or noted: the Thread pill's contrast, for the maintainer (it makes a `CI=1` full run flaky).
