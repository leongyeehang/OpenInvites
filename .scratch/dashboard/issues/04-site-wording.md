# 04: "Instance" becomes "site" in the interface

**What to build:** No visitor, host or operator reads the word "instance" (实例 / 實例) any more. Messages say "this site" (本站), and the settings page is Site settings everywhere.

**Blocked by:** 02 (it renames the header's item and the page's English title)

**Status:** open

- [ ] Every value in `messages/en.json` that says "instance" says "this site" or "the site" instead, keeping the sentence otherwise. The list today (grep the values, not the keys): `Home.fresh.step2.title` "Name your site"; `Auth.signUp.invitationRequired`, `invitationUnusable`; `Auth.signIn.HOST_INVITATION_REQUIRED`, `HOST_INVITATION_UNUSABLE`; `Auth.forgotPassword.noMail`, `contactOperatorUnknown`; `Auth.errors.VERIFICATION_EMAIL_NOT_ENABLED`, `HOST_INVITATION_REQUIRED`, `HOST_INVITATION_UNUSABLE`; `Host.dashboard.limitReached` and `Events.new.limitReached`; `Dashboard.operatorWelcome.nameIt` "Name your site"; `Account.passkeys.unavailable`; `Instance.registration.description`, `openHint`; `Instance.reports.description`; and any other value the grep finds. "the operator of this instance" becomes "whoever runs this site".
- [ ] Every value in `zh-Hans.json` with 实例 and in `zh-Hant.json` with 實例 (34 each today) says 本站 (此实例 / 本实例 / 这个实例 → 本站; "实例运营者" → 本站运营者), with 站点设置 / 網站設定 for `Host.header.instanceSettings`, `Instance.title` and `Instance.reports.back`, and 本站由你做主 for `Dashboard.operatorWelcome.title` in both scripts. Read each changed sentence whole: it must read naturally, not as a word swap.
- [ ] The mail bodies (`Mail.*`) and the event-page messages that said 这个实例 / the instance follow the same rule.
- [ ] A unit test in `src/locale/` (or the existing `translations.test.ts`) fails if any value in the three files contains `instance` (case-insensitive), 实例 or 實例. Keys are not checked.
- [ ] The operator docs and README name the page by its new label: "Instance settings" → "Site settings" in `docs/operator/configuration.md`, `docs/operator/upgrade-backup.md`, `docs/operator/install.md` and `README.md`. The docs keep "instance" where they mean the installation.
- [ ] Every browser spec that reads a changed sentence is updated (grep `e2e/` for "instance" in strings, "Name your instance", "Instance settings", and the Chinese ones in `locales.spec.ts` and `e2e/home.ts`).
- [ ] Browser tests: the sign-up page of an invitation-only site says "This site is invitation only" (`registration.spec.ts`); the welcome sheet's primary button reads "Name your site" and still lands on the Name field focused; a zh-Hans operator sees 站点设置 in the account menu (`locales.spec.ts`).

## Notes for the implementer

- Do not rename message keys, `src/instance/`, the `/instance` URL or any column.
- `CONTEXT.md` is the maintainer's: put the proposed sentence for its **Instance** entry in this ticket's comment, not in the file.
- Commit subject, e.g. `Wording: the interface says “site”, and “instance” stays in the code`.

## Comments
