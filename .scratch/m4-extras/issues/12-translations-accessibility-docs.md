# 12: Translations, accessibility, docs and 0.5

**What to build:** The final pass over M4: every new string in both Chinese scripts, every new page and sheet through the accessibility, keyboard, locale and reduced-motion specs in every layout, the docs and screenshots updated, and the 0.5.0 release note drafted.

**Blocked by:** 01–11

**Status:** done

- [x] zh-Hans and zh-Hant for every key added in M4; `translations.test.ts` passes; a list of the strings least sure of, for the maintainer.
- [x] The whole browser suite under `CI=1` on the Docker test profile; the a11y/keyboard/locales/reduced-motion specs cover the editor, each sheet, the poster-first page, reactions, polls, the album, passkeys.
- [x] `README.md` and `docs/screenshots/` reshot (the editor, the poster sheet, the guest page, the album); `docs/operator/*` for passkeys and the photos limit; `docs/contributing/posters.md`.
- [x] Release note draft `.scratch/m4-extras/release-note-0.5.0.md`: what hosts will notice first (the editor), the features, that templates became gallery posters, the upgrade (no theme migration needed; drafts may now have no date).
- [x] The CONTEXT.md proposals (Poster, Background, Template, plus Reaction, Date poll, Album, Passkey) listed in this ticket's comment for the maintainer.

## Notes for the implementer

- Commit subject, e.g. `Final pass: M4 reads in both Chinese scripts, every new page passes the checks, and the 0.5 notes are written`.

## Comments

**2026-11-04, implementing agent (Opus, in the maintainer's session).** Done.

- **Translations.** Every key added in M4 is in zh-Hans and zh-Hant; `translations.test.ts` passes (7). The strings least sure of, for the maintainer:
  - zh-Hant **通行金鑰** for "passkey" (`Account.passkeys.*`, `Auth.signIn.passkey`). Apple's Taiwan term is 通行密鑰 and Google's 密碼金鑰; zh-Hans 通行密钥 matches Apple's mainland term. Worth settling on one.
  - "If need be" as **勉强可以 / 勉強可以** (`EventPage.poll.ifNeedBe`, `Editor.poll.ifNeedBe`); 如有需要 reads as a condition rather than an answer.
  - The reaction names (`EventPage.comments.reactions.names`): 庆祝/慶祝 for 🎉, 惊讶/驚訝 for 😮, and zh-Hant 讚 for 👍 (zh-Hans 点赞). Only screen readers hear them.
  - "Album" as **相册 / 相簿**, and "photos per event" (`Instance.limits.maxPhotosPerEvent`).
  - The date poll's mail (`Mail.dateSet.body`), the one new email: 「{title}」 with corner brackets in both scripts.
- **Checks.** The whole suite on the Docker test profile passed after tickets 09–11 (566 passed, 0 failed, 0 flaky; ticket 11's comment). Coverage of M4's new surfaces: the editor and each sheet (`editor`, `design`, `keyboard`, `accessibility`, `desktop-editor`, `reduced-motion`), the poster-first page (`rsvp-sheet`, `accessibility`, `reduced-motion`), reactions (`reactions`: keyboard and axe in every layout; `reduced-motion`), date polls (`polls`: keyboard, axe, zh-Hans; `reduced-motion`), the album (`album`: keyboard, axe, zh-Hant; `reduced-motion`), passkeys (`passkeys`: keyboard and axe). New here: a reduced-motion row for a reaction's six, the album's viewer, a sheet beside the invitation at 1024 px, and the vote's sheet (passed, 9 with the spec's other rows).
- **Docs.** `README.md`: the feature list (the editor, emoji posters, reactions, polls, the album, passkeys, the photos limit) and the screenshots, retaken with `pnpm screenshots` against the test profile: the guest page, the reply sheet and the album on a phone; the editor and its Poster sheet on a phone; the night market as a guest sees it; the editor with the Poster sheet beside it on a desktop; the guest list. `design-drawer.webp` is gone. `docs/operator/configuration.md`: Passkeys (ticket 08), the photos limit, `MAX_UPLOAD_MB` for album photos, and the album's files; `docs/operator/upgrade-backup.md`: "Upgrading to 0.5", and the albums' photos in the backups table. `docs/contributing/posters.md`, `backgrounds.md` and `translations.md`, and the code's comments, no longer send anyone to the Design drawer (the 0.3 upgrade notes keep it: they describe that version).
- **Release note:** `.scratch/m4-extras/release-note-0.5.0.md`.
- **CONTEXT.md proposals**, for the maintainer to accept or change (the glossary is theirs, so it is not edited here):
  - **Poster** (changes): the invitation's picture at the top of the event page, from the gallery, an emoji pattern, a colour, or the host's upload, with the title on it or beneath it. _Avoid_: cover image, flyer, card image, background (the blurred copy behind it is not the poster).
  - **Background** (narrows): only a colour poster's gradient, or the blurred copy of the poster that fills the page behind it; no longer chosen on its own.
  - **Template** (retires): what 0.4 shipped; now a **gallery poster** and its **look** (title font, title placement, effect, button style). Proposed: **Gallery poster**: one of the posters that ship with the software, each bringing a look; picking one again restores its look. _Avoid_: template, preset.
  - **Reaction**: one of six emoji a guest who may comment, or a host, gives a comment; one of each per person per comment. _Avoid_: like, emote.
  - **Date poll**: the candidates a host offers in place of a date, two to six, which guests vote Yes, If need be or No on; it closes for good when the host picks one. _Avoid_: survey, doodle, vote (for the whole).
  - **Voter**: someone who voted on a date poll, by name, with an optional email; voting makes no RSVP. _Avoid_: respondent.
  - **Album**: an event's photos, open from its start to the hosts and to guests whose replies are approved. _Avoid_: gallery (the posters'), media.
  - **Passkey**: a credential on a host's device that signs them in without their password, made for the instance's domain. _Avoid_: security key, biometric login.


**2026-11-04, maintainer's answers (via the implementing agent).** All accepted: zh-Hant "passkey" is now **通行密鑰** (Apple's term, beside zh-Hans 通行密钥); 勉强可以 / 勉強可以 stays; guests who answered Can't go keep the album; the glossary entries above are in `CONTEXT.md`; the release note's album line no longer reads as if hosts need approval.
