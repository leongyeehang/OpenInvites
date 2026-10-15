# Task 20a report: the whole M1 experience in Simplified and Traditional Chinese

**Status:** DONE_WITH_CONCERNS (the concerns are decisions for the maintainer, listed at the end; nothing in the brief is unfinished except the maintainer's own reading)
**Commit:** `2924e93` Languages: every screen and email reads in Simplified or Traditional Chinese, and any page can switch (one commit on `m1-remaining`, 42 files, +1792 / -147)

## What I implemented

### The two translation files

- `messages/zh-Hans.json` (mainland usage) and `messages/zh-Hant.json` (Taiwan usage) carry all 492 messages `en.json` has (465 before this task, plus 27 new: the data names and `Legal.notPublished`). Each was written for its own script, not converted from the other: Traditional uses 帳號, 電子郵件, 設定, 登入/登出, 連結, 儲存, 建立/新增, 自訂, 範本, 版面, 行事曆, 列印, 檔案, 螢幕閱讀器, 隱私權政策, 透過, 聯絡, 字元, 收件匣, Taiwan's 「」 quotes and its 、 between quoted items; Simplified uses 账号, 邮箱, 设置, 登录/退出登录, 链接, 保存, 创建/新建, 自定义, 模板, 日历, 打印, 屏幕阅读器, “” quotes. A scripted scan found no character of the other script in either file.
- Register: 你 throughout (not 您), short sentences, the glossary's renderings everywhere (table below). Localised examples rather than literal ones: “Ah Ma’s house, 3rd floor” → 奶奶家三楼 / 阿嬤家三樓, “e.g. Priya Nair” → 例如：王小明, “Soup, Salad, Neither” → 汤，沙拉，都不要.
- `src/locale/fallback.ts` is untouched: it still protects a message added in English only.

### The completeness and structure test (test first)

- `src/locale/translations.ts` (pure): `translationProblems(english, translation, locale)` returns one sentence per slip. It parses each message with `@formatjs/icu-messageformat-parser` (added as a dev dependency; it is the parser `intl-messageformat`, next-intl's runtime, uses) and reports: a message missing, a message English does not have, a group where a message should be (or the reverse), an empty message, a message that does not parse, a placeholder lost or renamed, a placeholder used another way (plain, number, date, plural, select, tag), a select whose branches differ from English's, a plural that drops `#`, and a plural branch the language never uses.
- **Plurals, as the brief asked:** a plural must keep `other` (the parser requires it), and each of its other branches must be an exact number (`=0`, `=1`, any) or one of the language's own CLDR plural categories (`Intl.PluralRules(locale).resolvedOptions().pluralCategories`). So a Chinese plural collapsed to `other` alone passes (a unit test says so, with a plural that folds `=1` into `other` and one that keeps `=0`), a future Russian file may add `few` and `many` that English lacks, and a `one` branch in Chinese, which Chinese never selects, is refused. In the files, `=0`/`=1` survive only where the sentence changes (`{count, plural, =0 {还没有人} other {预计 # 人}}`, `=1 {你可以带一位同伴。}`).
- `src/locale/translations.test.ts`: six tests of the rule on small trees, and one test per non-English locale in `resolve-locale.ts`'s `locales`, reading `messages/<locale>.json`, so a new language's file is checked from the day it is listed.
- **RED** (before any translation; `translations.test.ts` against the files as they were): the rule's own tests passed, both file tests failed:
  ```
  FAIL  the translation files > give zh-Hans every English message, with its placeholders and branches
  FAIL  the translation files > give zh-Hant every English message, with its placeholders and branches
  AssertionError: expected [ 'Home.signIn is missing', …(15) ] to deeply equal []
  + "Home.signIn is missing", "Home.signUp is missing", "Auth is missing", "Host is missing",
  + "Account is missing", "Instance is missing", "Mail is missing", "Events is missing",
  + "EventPage is missing", "DesignDrawer is missing", "Guests is missing", "Rsvp is missing",
  + "NotFound is missing", "TooFast is missing", "Footer is missing", "Legal is missing"
  Tests  2 failed | 5 passed (7)
  ```
- **GREEN** after the translations: `Test Files 1 passed (1), Tests 7 passed (7)`.
- **Mutation checks**, each rule disabled in turn and the suite run: select branches unchecked, plural categories unchecked, `#` unchecked, extra keys unchecked, tags not descended, kinds not compared, empty accepted: each made exactly one of the rule's tests fail; the file was restored byte for byte (`diff -q` against a copy).

### Template, background and title-font names are messages

- New keys under `DesignDrawer` (the only screen that shows them), keyed by id: `templateNames`, `templateBlurbs`, `backgroundNames`, `fontNames` (the font names are in `src/themes/fonts.ts`, not `title-fonts.ts` as the brief guessed). The data files keep ids and knobs only: `name`/`blurb` left the six template files, `name` left `backgrounds.ts` and `fonts.ts`.
- `Template.id` is now `TemplateId = keyof typeof en.DesignDrawer.templateNames`, and the gallery is typed `CuratedBackground[]` whose id is a key of `backgroundNames` (the upload's own pseudo-background keeps `id: "upload"`, so `Background.id` stays a string). A data file whose id English does not name does not compile; checked by renaming `quiet` and `slate` and seeing `tsc` refuse both, then restoring. `templates.test.ts` and `backgrounds.test.ts` check that English names exactly the templates and backgrounds that ship; the translation test covers the other languages. `themeReadout` returns the template's id (its test now expects `"birthday"`), and the drawer names it with `t(\`templateNames.${id}\`)`. `legibility.test.ts` labels use ids.
- `src/themes/templates/README.md` has a new section, "Its name and blurb", with the two keys every file in `messages/` needs, the background's key, and the adding steps reordered (messages first, then `pnpm typecheck` and `pnpm test`). Adding a language stays adding a file for all of this.
- Font names stay Latin in the Chinese files: they are the typefaces' own names.

### Dates, times, numbers

Already `Intl` in the active locale everywhere the brief lists: `formatWhen` (event page when-line, dashboard), `formatDateSticker`, `ViewerTime`, the countdown (plural `#`), `formatMoment` (guest list reply times), the invitation list's days (plural), the upload size (`{max, number}`). Nothing was hand-built. One thing was: lists of plus-one names were joined with `", "`. They now use next-intl's `format.list` (Intl.ListFormat conjunction) on the guest's confirmation and the host's guest list, which gives “Arjun和Mei” in Chinese and changes English from “Bringing Arjun, Mei.” to “Bringing Arjun and Mei.” (`rsvp-sheet.spec.ts` updated). The preview card and the calendar file are untouched (exempt).

### Emails

The four emails (verification; change email, which Better Auth sends as the verification email to the new address; password reset; host invitation) already take their text from `getTranslations` inside the request that sends them, which resolves the locale from that request's cookie or `Accept-Language`, else English. With the files filled they are translated. No email body carries a date; the host invitation carries a number of days. A browser test checks the verification email arrives in Simplified Chinese for a host signing up from a `zh-CN` browser, and that its link works.

### The language switcher, in every page's footer

Story 61 is a guest's: the page in their language, with a switcher that remembers. The only switcher was on the home page, which a guest never sees, so the "one test through the language switcher" had nothing to drive on an event page. `LocaleSwitcher` is now a compact form in `PageFooter`, under the privacy and terms links: a globe icon and three buttons, each named in its own language with `lang`, the current one `aria-current="true"` and bolder. It takes the themed footer's veil pill on an event page and the plain muted text elsewhere; the form is named by `LocaleSwitcher.label` (`aria-label`). It still works without JavaScript. The home page's own switcher is gone, so no page has two (the home test still clicks 简体中文, now in the footer). On an event page the switch is one of the page's own actions and its redraw counts once against the event page limit, like any other.

### Smaller things found while reading every screen in Chinese

- **Question choices** may be separated by 、 and ， as well as `,` (`choicesFrom` in `src/questions/question.ts`, used by the editor): a host typing with a Chinese IME got one long choice. Test first: RED with the old ASCII-only split (`"汤，沙拉、都不要"` came back as one), GREEN after.
- **Legal placeholders** (ticket 18 left their language to ticket 20): the sentence for the reader ("The operator of this instance has not published a privacy policy yet.") is now a message, `Legal.notPublished.privacy`/`.terms`, shown in bold in the reader's language when the page is the placeholder; the Markdown under it is the operator's guidance and stays English, like `docs/operator/`. The English page reads exactly as before.
- **Lines shortened** where a character sat alone on the last line at 390px (CJK characters are all one em wide, so this holds across fonts): the Poster layout note, the retired-link text, the registration description and hint. The dialogs' "Never mind" is 算了 rather than a cancel-specific phrase, as the delete and reset dialogs share it.
- `playwright.config.ts` pins `locale: "en-US"`: now that nothing falls back to English, a machine whose system language is Chinese would otherwise fail every English spec.
- README: removed "The host screens are English only until the translation pass."

## Test results

- `pnpm lint`: clean. `pnpm typecheck`: clean (after `rm -f tsconfig.tsbuildinfo`, per the known quirk).
- `pnpm test`: 41 files, **329 tests passed** (319 before; 10 new: 7 in `translations.test.ts`, `choicesFrom`, English names for templates, English names for backgrounds). The only output besides results is Vitest's pre-existing warning about `vitest.config.ts` and Vite's native config loader.
- **Browser, definitive run** against the production image: `fuser -k 3000/tcp` (my dev server), `docker compose --profile test up -d --build --wait` (exit 0, all services healthy), then `pnpm exec playwright test`: **220 passed (4.2m), exit 0**, 0 failed, 0 flaky. That includes `e2e/locales.spec.ts` at 390px and desktop (5 scenarios × 2):
  - a guest whose browser sends `en-US`, `zh-CN` or `zh-TW` opens the invitation and sees `html[lang]`, the long date (`/Saturday, March 6, 2027/`, `/2027年3月6日\s?星期六/`) and the countdown (`/^\d+ 天后开始$/`, `/^\d+ 天後開始$/`) in their language, answers Going (参加 / 參加) with a named plus-one, and reads the plus-one hint, the confirmation heading, the summary (“Priya，另带 1 位同伴。”, “Priya，另外帶 1 位同伴。”), the plus-one line and the calendar offer (添加到日历 / 加入行事曆, twice: the confirmation and the page's card, pointing at `calendar.ics`) in it;
  - a guest with an English browser switches the invitation to 繁體中文 from the footer, does the same flow in Traditional Chinese, reloads, and the page is still Traditional with 繁體中文 current;
  - a host signing up from a `zh-CN` browser (Chinese labels) gets “王小明，你好：…请打开下面的链接，确认这是你的邮箱地址。” and its link verifies the address.
- **One failure on the first definitive run, fixed:** `sharing.spec.ts` "a draft neither unfurls nor draws a card" asserted the draft's page source does not contain its title, “Quiet”. Every page carries all its messages to the browser (ticket 10's note), and “Quiet” is now a template name among them. The test now uses a title no message contains (“A surprise for Mei”, with a comment saying why); the second full run above is all green.
- App log over the run: only React's pre-existing “The destination stream closed early” (nine times); no next-intl missing-message warnings.
- In the dev loop, two desktop scenarios of `locales.spec.ts` once timed out waiting for "Published" while the dev server compiled under seven workers; they passed on rerun and in both production runs.

## Reading every screen at 390px

A scratch Playwright harness (not committed) drove the dev server in each script and saved screenshots: home, sign-up, sign-in and its error, forgot password and its sent message, reset without token, verification failed, not-found, too-fast, privacy, the unverified dashboard and create screen, account, the event page as guest (inline flow, every step, confirmation, guest list), the sheet flow, dashboard, new-event form, manage page, cancel/delete/reset dialogs, cancelled page, draft as host and as guest, retired link, share page, guest list and its edit form, the Design drawer section by section (and at 1280px), instance settings with a new host invitation; plus the verification email text. What it changed is listed above (line lengths, 同伴：{names} rather than a spaced 带上 {names}, 算了). Everything else read as intended; the fonts' fallbacks give the right regional glyphs because `html[lang]` is `zh-Hans`/`zh-Hant`.

## Files changed

- Translations: `messages/en.json` (new `DesignDrawer.templateNames`, `templateBlurbs`, `backgroundNames`, `fontNames`, `Legal.notPublished`), `messages/zh-Hans.json`, `messages/zh-Hant.json`.
- Locale: `src/locale/translations.ts` and `translations.test.ts` (new), `src/locale/locale-switcher.tsx`.
- Themes: `src/themes/templates/{template,index,birthday,vows,supper-club,kids-party,festival,quiet}.ts`, `templates.test.ts`, `README.md`; `src/themes/backgrounds.ts`, `backgrounds.test.ts`, `fonts.ts`, `changes.ts`, `changes.test.ts`, `resolve.ts`, `resolve.test.ts`, `legibility.test.ts`.
- Screens: `src/app/e/[slug]/design-panel.tsx`, `src/app/e/[slug]/rsvp-flow.tsx`, `src/app/(host)/events/[id]/guests/guest-row.tsx`, `src/app/(host)/events/questions-editor.tsx`, `src/app/page.tsx`, `src/components/page-footer.tsx`, `src/legal/legal-page.tsx`, `src/legal/placeholders.ts`.
- Questions: `src/questions/question.ts`, `question.test.ts`.
- Tests and tooling: `e2e/locales.spec.ts` (new), `e2e/home.spec.ts`, `e2e/rsvp-sheet.spec.ts`, `e2e/sharing.spec.ts`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml`, `README.md`.
- Not staged, as the rules say: `.scratch/openinvites/issues/20-translations-accessibility-performance.md` (fifth box ticked, Status left, dated comment appended); `CONTEXT.md` and `decisions.md` untouched.

## Glossary renderings

| Term | Simplified | Traditional |
| --- | --- | --- |
| Host | 主办人 | 主辦人 |
| Guest | 宾客 | 賓客 |
| Operator | 运营者 | 營運者 |
| Host invitation | 主办人邀请 | 主辦人邀請 |
| Instance | 实例 | 實例 |
| Event / Event page / Event link | 活动 / 活动页面 / 活动链接 | 活動 / 活動頁面 / 活動連結 |
| Question | 问题 | 問題 |
| Draft / Published / Cancelled | 草稿 / 已发布 / 已取消 | 草稿 / 已發布 / 已取消 |
| RSVP | 回复 | 回覆 |
| Going / Maybe / Can’t go | 参加 / 待定 / 无法参加 | 參加 / 待定 / 無法參加 |
| Plus-one | 同伴 | 同伴 |
| Headcount (“# people expected”) | 预计 # 人 | 預計 # 人 |
| Guest list | 宾客名单 | 賓客名單 |
| Edit link | 修改链接 | 修改連結 |
| Theme / Template / Layout | 主题 / 模板 / 版式 | 主題 / 範本 / 版面 |
| Background / Poster | 背景 / 海报 | 背景 / 海報 |
| Pending (host invitation state) | 待使用 | 待使用 |

## Strings I was least sure of

(Also in the ticket comment, for the maintainer's read.)

- **RSVP → 回复/回覆**: one word for the record and the verb; many Chinese products keep “RSVP”.
- **Going / Maybe / Can’t go → 参加 / 待定 / 无法参加**: they read the same on the guest's buttons and the host's list; warmer ones (会去 / 可能 / 去不了) take the guest's side only.
- **Confirmation headings**: 期待你的到来！ / 那就先待定吧。 / 可惜你来不了。 (not literal), and “{name}，就你自己。” for a guest bringing nobody, which may read flat.
- **Host → 主办人**, “Hosted by {name}” → 主办人：{name} (alternatives 主人, 发起人).
- **Operator → 运营者 / 營運者** (not 管理员, the glossary avoids “admin”; 站长 is common in Chinese self-hosting). **Instance → 实例 / 實例** is technical; Taiwan's fediverse software says 伺服器 or 站台.
- **Plus-one → 同伴** in both; Taiwan event pages often say 攜伴.
- **Template names**: Vows → 婚礼/婚禮, Supper club → 晚餐聚会, Kids’ party → 儿童派对, Festival → 节庆, Quiet → 静谧/靜謐. **Backgrounds**: Golden hour → 黄金时刻, Bokeh → 光斑 / 散景 (the Taiwan photographers' word), Slate → 石板灰. **Swatches** (screen reader only): Marigold → 金盏黄, Periwinkle → 长春花蓝.
- **Details → 更多选项** (not 详情, which the event page uses for About); **Sheet → 面板**, **Inline → 内嵌**.
- **Eyebrow 诚邀你参加**: a little formal, but it is how Chinese invitations open. 你 everywhere; Taiwanese emails often use 您.
- **Email → 邮箱** on Simplified labels (电子邮箱 is longer).
- Traditional **Home.status** changed from 此實例正在運行 to 此實例正常運作中 (`home.spec.ts` updated).

## Self-review and concerns

- **The host invitation email keeps the operator's language** (the request that sends it). The brief says the recipient's language where known, else English, and defines known as the triggering request's; for this one email the triggering request is the operator's. I kept ticket 04's behaviour: an operator writing in Chinese most likely invites Chinese speakers. If the maintainer prefers English for it, it is one line in `src/instance/emails.ts` (`getTranslations({ locale: "en", namespace: … })`).
- **Scope beyond strings, each small and noted:** the switcher moved into every footer (needed for story 61 and the brief's switcher test; the home page's own one went); plus-one names use the locale's list format, which changes one English sentence; Chinese commas split question choices; the legal placeholder's first sentence became a translated message. Each is in the commit body and the ticket comment.
- **The first ticket box stays unticked**: it requires the maintainer to read both scripts. Everything else it asks is done. The fifth box is ticked.
- Not done here and noted for 20b: every page still ships every namespace (three full languages' worth of one); the footer switcher's small targets and focus ring on the veil were not audited; no CJK family is named in the body font stack (the browser's default for `lang` is used), and the Latin-subset title fonts fall back for a Chinese title.
- Also noted: the CLDR long date in Simplified puts the zone before the time (“GMT+8 19:00–22:00”) and the sticker's day reads “6日”, both `Intl`'s own output; time zone choices are IANA ids in every language; the questions editor re-joins choices with “, ”; adding a language still needs its locale in `resolve-locale.ts` and a `Locales` name in every file (pre-existing); README's first paragraph is otherwise stale (ticket 21).
- A glossary note, not a change: the Chinese words for RSVP, reply and reply's verb are one (回复/回覆), so the glossary's _Avoid_ list for RSVP ("response, reply") has no Chinese counterpart to avoid.
