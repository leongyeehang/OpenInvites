# 04: "Instance" becomes "site" in the interface

**What to build:** No visitor, host or operator reads the word "instance" (实例 / 實例) any more. Messages say "this site" (本站), and the settings page is Site settings everywhere.

**Blocked by:** 02 (it renames the header's item and the page's English title)

**Status:** done

- [x] Every value in `messages/en.json` that says "instance" says "this site" or "the site" instead, keeping the sentence otherwise. The list today (grep the values, not the keys): `Home.fresh.step2.title` "Name your site"; `Auth.signUp.invitationRequired`, `invitationUnusable`; `Auth.signIn.HOST_INVITATION_REQUIRED`, `HOST_INVITATION_UNUSABLE`; `Auth.forgotPassword.noMail`, `contactOperatorUnknown`; `Auth.errors.VERIFICATION_EMAIL_NOT_ENABLED`, `HOST_INVITATION_REQUIRED`, `HOST_INVITATION_UNUSABLE`; `Host.dashboard.limitReached` and `Events.new.limitReached`; `Dashboard.operatorWelcome.nameIt` "Name your site"; `Account.passkeys.unavailable`; `Instance.registration.description`, `openHint`; `Instance.reports.description`; and any other value the grep finds. "the operator of this instance" becomes "whoever runs this site".
- [x] Every value in `zh-Hans.json` with 实例 and in `zh-Hant.json` with 實例 (34 each today) says 本站 (此实例 / 本实例 / 这个实例 → 本站; "实例运营者" → 本站运营者), with 站点设置 / 網站設定 for `Host.header.instanceSettings`, `Instance.title` and `Instance.reports.back`, and 本站由你做主 for `Dashboard.operatorWelcome.title` in both scripts. Read each changed sentence whole: it must read naturally, not as a word swap.
- [x] The mail bodies (`Mail.*`) and the event-page messages that said 这个实例 / the instance follow the same rule.
- [x] A unit test in `src/locale/` (or the existing `translations.test.ts`) fails if any value in the three files contains `instance` (case-insensitive), 实例 or 實例. Keys are not checked.
- [x] The operator docs and README name the page by its new label: "Instance settings" → "Site settings" in `docs/operator/configuration.md`, `docs/operator/upgrade-backup.md`, `docs/operator/install.md` and `README.md`. The docs keep "instance" where they mean the installation.
- [x] Every browser spec that reads a changed sentence is updated (grep `e2e/` for "instance" in strings, "Name your instance", "Instance settings", and the Chinese ones in `locales.spec.ts` and `e2e/home.ts`).
- [x] Browser tests: the sign-up page of an invitation-only site says "This site is invitation only" (`registration.spec.ts`); the welcome sheet's primary button reads "Name your site" and still lands on the Name field focused; a zh-Hans operator sees 站点设置 in the account menu (`locales.spec.ts`).

## Notes for the implementer

- Do not rename message keys, `src/instance/`, the `/instance` URL or any column.
- `CONTEXT.md` is the maintainer's: put the proposed sentence for its **Instance** entry in this ticket's comment, not in the file.
- Commit subject, e.g. `Wording: the interface says “site”, and “instance” stays in the code`.

## Comments

**2026-11-06, implementing agent (inline).** Done. `pnpm lint`, `pnpm typecheck` and `pnpm test` (83 files, 871 tests) pass. On the Docker test profile rebuilt with this change (`CI=1`, two workers): the `home-instance` chain (43 passed, after `registration.spec.ts`'s refusal sentence was updated too), and `legal-and-analytics`, `reports`, `custom-link`, `co-hosts`, `turnstile`, `locales`, and the report, co-host, legal and home rows of `keyboard`, `reduced-motion` and `accessibility` on both projects (98 passed; one Turnstile code-mail scenario passed on its retry, a mail-timing wait this change does not touch).

How it landed:

- **The guard.** `translations.test.ts` gains "the words a reader sees": no value in any of the three files may contain `instance`, 实例 or 實例, once `{instance}` placeholders (the account emails' name, ticket 03 of the home page) are taken out. It failed first in all three languages (29 English keys, 34 in each Chinese script), then passed.
- **English.** "this instance" → "this site"; "the operator of this instance" → "whoever runs this site"; "from its operator" → "from whoever runs it"; "Name your instance" → "Name your site"; "your instance’s" / "the instance’s" → "your site’s" / "the site’s". Sentences that say "the operator" on their own keep it.
- **Chinese.** 此实例 / 本实例 / 这个实例 → 本站; 此实例的运营者 / 实例运营者 → 本站运营者; 为你的实例命名 → 为本站命名; 实例设置 → 站点设置 (zh-Hant: 網站設定); the welcome sheet's title 本站由你做主 in both scripts. Each changed sentence was read whole: 本站 takes no 上 after 在 (在本站创建主办人账号), and the retention mail's 这是实例对所有活动的规定 became 这是本站对所有活动的规定.
- **Docs.** `configuration.md` names **Site settings** and where it is (the account menu, under the initials) and says once that the interface says "site" where the docs say "instance"; `upgrade-backup.md` and the README name the page Site settings.
- **Specs.** Every quoted sentence that changed, in English and both Chinese scripts (`e2e/home.ts`'s fresh steps too). New: `locales.spec.ts`, the operator switches to 简体中文 and opens 站点设置 from the account menu.

Not changed: the legal placeholders (`src/legal/placeholders.ts`), written for the operator who replaces them, and the test operator's own policy in `compose.yaml` ("What this instance keeps"), which is the operator's words.

For the maintainer's `CONTEXT.md`, under **Instance**: "In the interface, say 'site' (本站) or the site's name; 'instance' is for the code and the operator docs."
