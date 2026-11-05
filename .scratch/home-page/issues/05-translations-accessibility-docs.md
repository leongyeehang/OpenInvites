# 05: Translations, accessibility and docs

**What to build:** The final pass: the new pages pass every check the rest of the app passes, the operator docs describe the home page, and the release note says what changed.

**Blocked by:** 02, 03, 04

**Status:** ready-for-agent

- [ ] `accessibility.spec.ts`, `keyboard.spec.ts`, `locales.spec.ts` and `reduced-motion.spec.ts` cover the home page in its three states (fresh, invitation only, open), at 390 px and at desktop width, with a light gallery poster (Balloons) and a dark one (Disco). Fresh-state rows run where an empty instance is available (`home-page.spec.ts`, before the first sign-up). The welcome sheet's rows are in ticket 04.
- [ ] Every new key reads naturally in zh-Hans and zh-Hant. The maintainer reads both, so the ticket comment lists the strings the implementer was least sure of.
- [ ] `docs/operator/install.md`, "Open your address": the home page now says the instance is ready and offers one button to create the operator account, and the welcome sheet follows.
- [ ] `docs/operator/configuration.md`: a section **The home page** under the operator section: the name (40 characters, used in the tab, the host header and account emails), the welcome line (140), More options (posters: all, picked, one; "Run by"), what a signed-in host sees, and that "Powered by OpenInvites" links to the source.
- [ ] `pnpm screenshots` gains `home.webp` (phone, 390x844 at 2x, a named instance with Candlelight), and README shows it first.
- [ ] Release note: a section "Every instance opens on an invitation" in `.scratch/m4-extras/release-note-0.5.0.md` if `v0.5.0` has not been tagged when this ticket starts, otherwise a new `.scratch/home-page/release-note-0.6.0.md`. It covers the new home page, the settings, the welcome sheet, and the upgrade note that existing operators are not greeted.
- [ ] Full checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the full browser suite on the Docker test profile with `CI=1`, with the totals in the ticket comment.

## Notes for the implementer

- Commit subject, e.g. `Final pass: the home page reads in both Chinese scripts and passes every check`.

## Comments
