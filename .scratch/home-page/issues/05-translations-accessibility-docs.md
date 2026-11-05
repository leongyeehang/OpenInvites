# 05: Translations, accessibility and docs

**What to build:** The final pass: the new pages pass every check the rest of the app passes, the operator docs describe the home page, and the release note says what changed.

**Blocked by:** 02, 03, 04

**Status:** done

- [x] `accessibility.spec.ts`, `keyboard.spec.ts`, `locales.spec.ts` and `reduced-motion.spec.ts` cover the home page in its three states (fresh, invitation only, open), at 390 px and at desktop width, with a light gallery poster (Balloons) and a dark one (Disco). Fresh-state rows run where an empty instance is available (`home-page.spec.ts`, before the first sign-up). The welcome sheet's rows are in ticket 04.
- [x] Every new key reads naturally in zh-Hans and zh-Hant. The maintainer reads both, so the ticket comment lists the strings the implementer was least sure of.
- [x] `docs/operator/install.md`, "Open your address": the home page now says the instance is ready and offers one button to create the operator account, and the welcome sheet follows.
- [x] `docs/operator/configuration.md`: a section **The home page** under the operator section: the name (40 characters, used in the tab, the host header and account emails), the welcome line (140), More options (posters: all, picked, one; "Run by"), what a signed-in host sees, and that "Powered by OpenInvites" links to the source.
- [x] `pnpm screenshots` gains `home.webp` (phone, 390x844 at 2x, a named instance with Candlelight), and README shows it first.
- [x] Release note: a section "Every instance opens on an invitation" in `.scratch/m4-extras/release-note-0.5.0.md` if `v0.5.0` has not been tagged when this ticket starts, otherwise a new `.scratch/home-page/release-note-0.6.0.md`. It covers the new home page, the settings, the welcome sheet, and the upgrade note that existing operators are not greeted.
- [x] Full checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the full browser suite on the Docker test profile with `CI=1`, with the totals in the ticket comment.

## Notes for the implementer

- Commit subject, e.g. `Final pass: the home page reads in both Chinese scripts and passes every check`.

## Comments

**2026-11-05, implementing agent.** Done. `pnpm lint`, `pnpm typecheck` and `pnpm test` (82 files, 856 tests) pass. The whole browser suite on the Docker test profile, rebuilt with this change, `CI=1`, two workers: **604 passed, 2 skipped, 0 failed, 0 flaky** (1.1 h). The two skipped are `desktop-editor.spec.ts`'s two widths on the mobile project, which skip themselves there by design.

How it landed:
- **The checks on the home page.** `e2e/home.ts` holds what the specs share about the home page: `openHome(page, "Balloons" | "Disco")`, `homeByKeyboard(page, ways)`, `HOME_COPY` and `expectHomeIn(page, locale, state)`. The page picks its poster at random on each visit, and no spec on the shared `app` may narrow the pick. So `openHome` intercepts the browser's request for `/` and fetches `/` again (`route.fetch`) until the server sends a page with that poster. The browser then gets that response unchanged. Its odds of failing are about one run in 30,000. The keyboard check is now in `e2e/focus.ts` (`expectVisibleFocus`, `tabTo`, moved from `keyboard.spec.ts` unchanged) and the reduced-motion check in `e2e/still.ts` (`expectStill`, moved from `reduced-motion.spec.ts`), so `home-page.spec.ts` can run them too.
- **Open** (`app`, no name), under Balloons and Disco on both projects (390 px and desktop): axe in `accessibility.spec.ts`; a keyboard walk in `keyboard.spec.ts` (the bar's links in order, then on to the last control of the footer with every stop ringed, back to Create an account, and Enter reaches `/sign-up`); both Chinese scripts by Accept-Language in `locales.spec.ts`; and `expectStill` in `reduced-motion.spec.ts`.
- **Fresh and Invitation only** need `app-fresh`, so `home-page.spec.ts` runs them through `passesTheChecks`. That covers axe, the keyboard walk (to `/sign-up` or `/sign-in`), reduced motion, and zh-Hans and zh-Hant, at 390 px (phone context: `isMobile`, `hasTouch`) and 1280 px, under both posters. The fresh row comes just before the operator signs up, and the Invitation only row just after.
- **Docs.** `install.md` step 4 now describes the setup page and the welcome sheet, and links to the new section. `configuration.md` has **The home page** after the operator section. `upgrade-backup.md`'s "Upgrading to 0.5" gains a bullet for the home page, and its "no new settings" now says "no new environment variables". README: `home.webp` comes first (the rows are now four and three at 200 px), the instance feature mentions the home page, and "Run it locally" says **Create the operator account**. Step 3 there still described 0.4's form and Design drawer, so it now describes the editor.
- **Screenshot.** `scripts/screenshots.ts` signs in as `app`'s operator, names the instance "Orchard Lane Supper Club" with a welcome line and Always the same poster: Candlelight, then takes `home.webp` on a phone. In a `finally` it clears both texts and sets the posters back to All. Only `home.webp` is committed; the other pictures it retook were restored from git.
- **Release note.** The section "Every instance opens on an invitation" is in `.scratch/m4-extras/release-note-0.5.0.md`, since `v0.5.0` is not tagged. "Upgrading" says the Home page card starts empty and that an existing operator is not greeted.

Chinese changed (both scripts):
- `Dashboard.operatorWelcome.title`: 这个实例属于你 → **这个实例由你做主** / 這個實例由你做主. "属于你" read flat and literal. "由你做主" carries "yours" as "you decide", which is what the description says next. It keeps 实例 because `CONTEXT.md` lists "site" under _Avoid_ for Instance, and the sheet's own button and the header say 实例.
- `Dashboard.operatorWelcome.limits.kept` and `keptForever`: 每位主办人 # 个活动 → **# 场活动**, the measure word the Limits card and `limitReached` already use.
- `Instance.homePage.showOperator`: 用我的显示名称标明"运营者" → **显示"由……运营"，署上我的显示名称** / 顯示「由……營運」，署上我的顯示名稱. The old label quoted "运营者", which the page never shows; the page says 由 {name} 运营.
- `Instance.homePage.description`: 访客在本站地址上看到的内容 → **访客打开本站网址时看到的页面** / 訪客開啟本站網址時看到的頁面. 网址 is the word the fresh page's step uses, and the card describes a page.
- Kept as they were: `notNow` 暂不设置 / 暫不設定, `Mail.resetPassword.body`, `postersMode.all`, and the home page's own strings.

Least sure of, for the maintainer: the new `showOperator`; `operatorWelcome.title` 由你做主; `Home.poweredBy` 由 OpenInvites 驱动 / 驅動 (some Taiwanese sites write 技術支援); `Home.how.title` 使用方式; `notNow` 暂不设置, since the sheet never comes back.

Decisions and things to know:
- The ticket names the four specs. Only Open can run on `app`, so the fresh and Invitation only rows are in `home-page.spec.ts`. Each of the four specs has a comment pointing there.
- The image the suite ran on had 这个网站属于你 as the welcome title, a draft replaced before the commit. No spec reads that string, and `translations.test.ts` passes with the final one.
- Glossary note for the maintainer: the English interface says "site" ("This site is yours", "whoever runs this site"), while `CONTEXT.md` lists "site" under _Avoid_ for Instance. Either the glossary allows "site" in a visitor's words, or those strings change.

Left for later tickets or noted: nothing.

Evidence: the Open rows passed alone first (15 passed, both projects), then `home-page.spec.ts` under `home-instance` (18 passed), then the whole suite as above.
