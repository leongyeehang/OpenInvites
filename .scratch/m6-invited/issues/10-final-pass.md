# 10: Translations, accessibility, docs

**What to build:** The milestone's last pass: the Chinese strings reviewed, the keyboard, locale and reduced-motion specs extended to every new screen, the docs, the glossary proposals collected, the release note, and the full browser run.

**Blocked by:** 01 to 09

**Status:** ready-for-agent

- [ ] zh-Hans and zh-Hant: every key added in 01 to 09 read in context (the Invites page, the Settings sheet's Album group, the Schedule sheet, the locked page, the letter and schedule panels, the mails); the strings the implementers were least sure of listed in this ticket's comment for the maintainer.
- [ ] Keyboard rows: the Schedule sheet (add, remove, the radios, Done); the locked form (email, Send, the code, Send it again); Approve and Remove in the album viewer; the Invites page's Send, Send again, Share and the letter fields. Locale rows for each new screen in one Chinese script. Reduced motion: `expectStill` with a "Now" item and with the letter panel.
- [ ] Docs: `docs/operator/configuration.md` (the invitation, pass-code and photos mails among what mail sends; `RATE_LIMIT_MAIL`; the photos limit and pending photos); the host guide (invite-only and how guests get in, letters, album visibility and approval, the schedule and the freshness setting); the upgrade note.
- [ ] The glossary proposals from the spec (Invite list, Invite-only, Pass, Letter, Schedule, the widened Album) collected in one comment for the maintainer's `CONTEXT.md`; not edited here.
- [ ] `.scratch/m6-invited/release-note-0.6.0.md` drafted.
- [ ] The full browser suite on the Docker test profile rebuilt from the branch, `CI=1 pnpm exec playwright test --workers=2`, every project; the counts and any flake in the comment; `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes for the implementer

- CI fails on any flake (`failOnFlakyTests`): a row that passes only on retry is a bug in the wait, not in the app.
- Commit subject, e.g. `M6: translations, accessibility and docs`.

## Comments
