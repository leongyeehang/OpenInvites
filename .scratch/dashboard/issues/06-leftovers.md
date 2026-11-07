# 06: The dashboard's leftovers

**What to build:** The minors the dashboard's final review left, and the two Chinese strings the maintainer chose: a title of any length leaves a tile its shape, the Past row on a phone has room for the focus ring, the account menu works before its script and says whose it is, the banner lines up with the header, and the registration spec checks again who is signed in.

**Blocked by:** 05

**Status:** done

- [x] A tile's title stops at three lines, and Next up's at four; a long title (past `LONG_TITLE`, 28 characters, the event page's threshold, now one constant in `title-fonts.ts`) takes Next up's smaller size.
- [x] On a phone, the Past row has room above and below a tile for its 3px ring.
- [x] The event limit is asked once per request (`eventsOwnedAtLimit` in React's `cache`): the header and the dashboard both asked it.
- [x] The account menu is named by the host's name and email. Until its script has run, or where it never does, the initials are a link to the Account page, and the Account page has Sign out.
- [x] The verification banner is as wide as the header.
- [x] `registration.spec.ts` checks who is signed in (`expectSignedInAs`) where it checked only that someone was.
- [x] Chinese: `went` is 人出席, `firstTitle` 制作你的第一张邀请函 / 製作你的第一張邀請函.
- [x] The Thread's "Invitation sent" pill: looked into (below), not changed.

## Comments

**2026-11-06, implementing agent (inline).** Done, in three commits on `dashboard-leftovers`. Each change has a browser test that failed first: the Past row's ring (`dashboard.spec.ts`, 3px short of room), the long title (6 lines on a tile), the menu's name and the initials without JavaScript (`host-accounts.spec.ts`), and the banner (128px off the header at desktop width). The limit's `cache` has no test of its own: what it changes is how often a query runs, which only React's request scope decides; the limits spec covers that the pill still goes at the limit.

`pnpm lint`, `pnpm typecheck` and `pnpm test` (83 files, 873 tests) pass. On the Docker test profile, rebuilt with these commits, `CI=1`: dashboard, host-accounts, registration, instance-settings, keyboard, accessibility, locales, limits, reduced-motion and home-page specs, both widths: **223 passed, 0 failed, 0 flaky** (34 min).

**The Thread pill.** Not changed, because nothing a person sees is wrong with it. Measured on screen (text made transparent, the pill photographed with its corners squared, against its worst pixel), it reads 7.2:1 on a dark page and 11.4:1 on a light one. Over 16 runs of the Thread checks against `next dev` and 54 direct axe readings of the pill, at the top and scrolled under the sticky header, axe never failed it: in view it always says it cannot decide (the text is over the backdrop's gradient), and out of view it reads it against the body's white, which `e2e/axe.ts` already leaves out. The failure seen during ticket 05 (2 of 6 runs) has not come back here; see the repeat runs below. Turning the pill's text from faint to muted, as first planned, would have answered a guess, not a cause.

Repeat runs on the production image (`CI=1`, `--repeat-each=4 --retries=0`, both widths): "the Thread full, and its confirmations waiting for approval…" passed 8 of 8, and twice more in the run above. Ticket 05's two failures came during the whole 1.4-hour suite, under its full load; this ticket did not run the whole suite. If it comes back there, the next step is to log axe's `bgColor` for `.my-3` when it fails (the throwaway probe is described above), not to change the pill's colour.
