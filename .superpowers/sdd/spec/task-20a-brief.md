# Task 20a: the whole M1 experience in Simplified and Traditional Chinese

The first half of ticket 20 (`.scratch/openinvites/issues/20-translations-accessibility-performance.md`), split by the controller. Task 20b does accessibility, reduced motion and performance afterwards. This half covers the ticket's first and fifth checkboxes.

## Acceptance

- [ ] Every interface string has a Simplified Chinese (`messages/zh-Hans.json`) and a Traditional Chinese (`messages/zh-Hant.json`) translation: every key in `messages/en.json` (about 465), with nothing left falling back to English. A unit test fails if any key in `en.json` is missing from either file, or if any ICU placeholder or plural/select structure differs from English.
- [ ] Traditional Chinese is written as Traditional Chinese, in Taiwan usage by default (for example 帳號 not 賬號, 電子郵件 not 郵箱, 訊息 not 信息, 設定 not 設置), not a character-by-character conversion of the Simplified file. Simplified follows mainland usage. Both read as a native product would: short, warm, not literal.
- [ ] Template names and blurbs, curated background names, and title-font names (currently English data in `src/themes/templates/*.ts`, `src/themes/backgrounds.ts`, `src/themes/title-fonts.ts`) move into the translation files, keyed by id. The data files keep ids and knobs. `src/themes/templates/README.md` tells a contributor which message keys a new template needs. Ruling: adding a language must stay "adding a file" (spec story 101).
- [ ] Dates, times, and numbers follow the locale everywhere they appear: the event page's when-line, the countdown, the guest list's reply times, the dashboard, the admin invitation list, the upload size message, and email bodies where they carry dates. Use next-intl's formatters or `Intl` with the active locale; no hand-built date strings.
- [ ] Emails sent by the instance (verification, password reset, host invitation, change email) are translated as well. They use the recipient's locale where it is known (the locale of the request that triggered them), else English.
- [ ] The preview card and the calendar file are exempt: ticket 14 wrote the card's date in English because a crawler brings no language, and the calendar file carries the host's own text.
- [ ] Browser tests run the core guest flow (open the invitation, answer Going with a plus-one, see the confirmation, add to calendar is offered) in each of the three locales. Each is chosen the way a guest's browser chooses it (`Accept-Language`), plus one test through the language switcher. Each test asserts localised text a guest sees, including a localised date.
- [ ] The maintainer reads both scripts and verifies them (spec). You cannot do that for them. List in the ticket comment the strings you were least sure of, with the reasons (tone, ambiguity, a term the glossary fixes), so their review is quick.

Glossary terms (CONTEXT.md) need a consistent Chinese rendering across the whole interface. Record your choice for each glossary term in a short table in the ticket comment (for example Host, Guest, Event, RSVP, Plus-one, Headcount, Guest list, Host invitation, Operator, Theme, Template, Background, Poster, Edit link).
