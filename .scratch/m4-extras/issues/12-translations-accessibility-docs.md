# 12: Translations, accessibility, docs and 0.5

**What to build:** The final pass over M4: every new string in both Chinese scripts, every new page and sheet through the accessibility, keyboard, locale and reduced-motion specs in every layout, the docs and screenshots updated, and the 0.5.0 release note drafted.

**Blocked by:** 01–11

**Status:** ready-for-agent

- [ ] zh-Hans and zh-Hant for every key added in M4; `translations.test.ts` passes; a list of the strings least sure of, for the maintainer.
- [ ] The whole browser suite under `CI=1` on the Docker test profile; the a11y/keyboard/locales/reduced-motion specs cover the editor, each sheet, the poster-first page, reactions, polls, the album, passkeys.
- [ ] `README.md` and `docs/screenshots/` reshot (the editor, the poster sheet, the guest page, the album); `docs/operator/*` for passkeys and the photos limit; `docs/contributing/posters.md`.
- [ ] Release note draft `.scratch/m4-extras/release-note-0.5.0.md`: what hosts will notice first (the editor), the features, that templates became gallery posters, the upgrade (no theme migration needed; drafts may now have no date).
- [ ] The CONTEXT.md proposals (Poster, Background, Template, plus Reaction, Date poll, Album, Passkey) listed in this ticket's comment for the maintainer.

## Notes for the implementer

- Commit subject, e.g. `Final pass: M4 reads in both Chinese scripts, every new page passes the checks, and the 0.5 notes are written`.
