# Task 15 report: translations, accessibility and performance pass, and the 0.3 notes

**Status:** DONE_WITH_CONCERNS

Branch `m2-social`, base `ff39611`. Eleven commits, all staged by path; `.scratch/`, `.superpowers/`, `.claude/`, `CONTEXT.md` and `.scratch/openinvites/decisions.md` untouched in every commit. The ticket file is updated (boxes ticked, status, dated comment) and not staged.

## Commits

| SHA | Subject | What |
| --- | --- | --- |
| `25d40c7` | Translations: everything M2 added reads in Simplified and Traditional Chinese | The Chinese review (below). zh-Hans and zh-Hant only. |
| `b007c4e` | Event page: the draft's notices say only the hosts can see it, co-hosts included | `EventPage.draftBanner`, `Events.manage.draftHint` in three languages; `events`, `broadsheet`, `thread` specs. |
| `7115a0b` | Layouts: the Thread's host offers a single plus-one as one person | `thread.askPlusOnes` gets a `=1` branch, as `Rsvp.plusOnes.hint` has (ticket 13's note); `thread.spec.ts`. |
| `7451cb1` | Sign in: the sign-in link's field is called the email for the link | `Auth.signIn.linkEmail` "Email for the sign-in link"; sign-in `getByLabel("Email")` lookups made exact (`hosts.ts`, `co-hosts`, `rate-limits`); `magic-link.spec.ts`. |
| `a6823aa` | Accessibility: each Delete says what it takes, and the focus stays on its section | Named Delete buttons; `src/components/delete-dialog-content.tsx`; heading ids in the three layouts and the announcements page; `comments`, `announcements` specs. |
| `c8f1d86` | Docs: what mail does in 0.3, and what changes for existing events | `configuration.md` Mail section; `upgrade-backup.md` "Upgrading to 0.3". |
| `7b6ac92` | Docs: the README and the contributing guides say what M2 added | README's four lines; `templates.md` lines 31, 39 (and 63); `backgrounds.md` derived tiles. |
| `cdfe2a5` | Accessibility: axe runs on every layout's comments and announcements, and on every new page | `e2e/accessibility.spec.ts` (+249 lines). |
| `84d7691` | Translations: a guest replies on the Broadsheet and in the Thread in Chinese | `e2e/locales.spec.ts`. |
| `9746f64` | Performance: the Lighthouse audit covers the Broadsheet and the Thread | `perf/event-page.perf.ts`: Supper club and Kids' party via the drawer. |
| `39f827d` | Docs: the README's screenshots show the page as M2 draws it | Five screenshots retaken with `pnpm screenshots` (test profile); alt texts. |

## The Chinese review

Read: all 197 keys M2 added or changed (`git diff 51453b1..HEAD -- messages/`), side by side in the three files (a script printed each key's English, Simplified and Traditional), against every ticket's "least sure of" list (01 to 14) and the M1 strings' register. Terms checked for one word per concept: announcement 公告, reminder 提醒, comment 留言, co-host 共同主办人 / 共同主辦人, co-host link 共同主办人链接 / 共同主辦人連結, edit link 修改链接 / 修改連結, sign-in link 登录链接 / 登入連結; the stop link has no UI name (its pages say 这个链接 / 不再接收…). Plurals are folded to `other` (with `=0` / `=1` kept where the wording differs), and every placeholder kept (`translations.test.ts` green).

Changed (both scripts unless noted):
1. `Events.manage.duplicateHint` (zh-Hans): 评论 → 留言, the only place "comment" was 评论.
2. `EventPage.thread.askName`: 耶！ → 太好了！ (M1's name step also says 太好了).
3. `EventPage.thread.askNameCant`: 请问你是哪位？ → 你是哪位呀？ (a friend's chat, not a phone call).
4. `EventPage.thread.skipped`: 这题我先跳过 → 这个我先跳过 (also answers the email turn).
5. `DesignDrawer.effects.sparkles.name`: 闪光 / 閃光 → 星光 (闪光 reads as a camera flash).
6. `Announcements.audience`: 邮件发给回复以下状态的宾客 → 邮件发给哪些宾客 / 郵件寄給哪些賓客.
7. `CoHostLink.expired` (zh-Hant): 已失效 → 已過期, as host invitations and the sign-in link say.

New or changed by the copy fixes, in all three languages: `draftBanner` / `draftHint` (主办人和共同主办人 …), `thread.askPlusOnes` (`=1` 可以带一位。), `Auth.signIn.linkEmail` (接收登录链接的邮箱 / 接收登入連結的電子郵件), `EventPage.comments.deleteLabel` (删除 {name} 在 {time} 的留言), `Announcements.deleteLabel` (删除 {time} 发布的公告).

Still in doubt, for the maintainer: `Events.duplicate.copySuffix` （副本） after an ASCII space; 色彩晕染 for Colour wash; 主办人的话 for "From the host"; `StopMail.stop` 不再接收 vs 停止接收; "details" as 详情 (`Rsvp.edit`, `ballot.amend`) vs 资料 (`thread.edit`) in zh-Hans; the Thread lines that are not literal (好呀, 记下你啦, 可能吧，我先看看, 你是哪位呀 beside M1's 请问你是？); 生成 a co-host link vs 创建 a host invitation; `Events.manage.opened`; the draft notices' length; zh-Hant 倒數; 特效 and the OS setting names in `effectHint`. English worth a look (ticket 13): `thread.askEmail`, `thread.skipped`. Full list in the ticket comment.

## Accessibility

- Findings: none. The whole `accessibility.spec.ts` (33 tests, 408 axe readings) found nothing at any impact, critical to minor, on any view old or new. The event pages' text over gradients is axe's "incomplete", as `e2e/axe.ts` documents; that is `legibility.ts`'s.
- The collected accessibility fixes from earlier tickets are in `a6823aa`: distinguishing Delete names (ticket 03, 06), focus to the section heading after a delete (ticket 06), the sign-in link field label (ticket 07, `7451cb1`).
- Not read: the announcements page's disabled boxes on an instance without mail. `app-no-mail` is the fresh instance `registration-without-mail.spec.ts` signs its operator up on first; signing a host up there from the mobile/desktop projects would race that spec.
- `keyboard.spec.ts` already completes the Broadsheet ballot and the Thread chips by keyboard; `reduced-motion.spec.ts` already covers the three effects, the sticker, the Broadsheet stamp and the Thread's pacing. Verified, unchanged.

## Definitive run (Docker test profile, final tree)

`docker compose --profile dev stop`, then `docker compose --profile test up -d --build --wait` (all eight containers healthy; the image served "Email for the sign-in link"), `pnpm screenshots`, then `CI=1 pnpm exec playwright test --reporter=line,json` (2 workers by default on 4 CPUs, one retry, `failOnFlakyTests`). 385 tests, 45.2 min:

| Project | Passed | Failed | Flaky |
| --- | --- | --- | --- |
| operator | 1 | 0 | 0 |
| fresh-instance | 12 | 0 | 0 |
| mobile | 186 | 0 | 0 |
| desktop | 182 | 2 | 2 |

- Failed, both attempts at the 180 s timeout: `accessibility.spec.ts` "the RSVP flow in the Inline style…" and "…Sheet style…" (desktop; unchanged tests; the retry ended "session closed").
- Flaky: `questions.spec.ts` "a guest answers the host's questions…" and `uploads.spec.ts` "the host describes the picture…" (desktop; the two ticket 09 saw fail under two workers).
- The VM had 60 MB free and its 1 GB swap full during the run.
- **Load**: the four alone, `--project=desktop --workers=1 --retries=0`: 5 passed (1.1 min), then 5 passed again (57.9 s).
- The cases the production-build loop could never run all passed in both projects: `social-login.spec.ts` (3 each), the operator-command test, `magic-link.spec.ts`'s no-mail case, and `registration.spec.ts` / `registration-without-mail.spec.ts` on the fresh instances (12/12).

## S3 smoke

`docker compose --profile s3 up -d --wait && pnpm test:s3`: 1 file, 1 test passed (1.9 s). Then `docker compose --profile test stop` and `docker compose --profile s3 stop`; no volumes removed.

## Lighthouse medians

`pnpm exec playwright test --config playwright.perf.config.ts` against the test profile's `app` right after the suite, nothing else running. Median (runs), English then Simplified Chinese:
- **Birthday with sparkles, Sheet style: 93 (94, 93, 93) and 94 (94, 95, 88).** Inline style: 90 (94, 90, 87) and 94 (94, 96, 93).
- **Supper club, Broadsheet: 94 (94, 93, 94) and 95 (95, 95, 92).**
- **Kids' party, Thread: 94 (94, 94, 93) and 95 (95, 95, 93).**
- Uploaded photo: 94 and 94. Portrait poster: **89 (89, 83, 91)** and 93, the one median under 90, which failed that test in this run (TBT 220 ms). Rerun alone straight after: 91 (92, 91, 91) and 91 (91, 91, 92), TBT 96 ms. Ticket 11 measured it at 93 and 91: it sits near the line on this machine, and the run-to-run spread (83 to 92) is larger than its margin.
- The largest paint is the title in every run (the Broadsheet's in its masthead, the Thread's on its card), or the poster. CLS 0.005 on the Broadsheet, 0 elsewhere.

## Other checks

- `pnpm lint`, `pnpm typecheck` (after `rm -f tsconfig.tsbuildinfo`), `pnpm test` (64 files, 526 tests): clean on the final code commit.
- Production-build loop (`pnpm build`, standalone server on :3000, Compose dev profile, `--workers=2`): comments + announcements 19/19; magic-link, rate-limits, co-hosts, events 59/59; locales 15/15; accessibility 33/33 (JSON).
- Mutation: `DeleteDialogContent`'s close handler returning early fails the four focus checks (Poster comments, Broadsheet, Thread, announcements page) with "Expected: focused, Received: inactive". Restored; `src` matched HEAD.

## Files changed

`README.md`, `docs/screenshots/*.webp` (5), `docs/contributing/backgrounds.md`, `docs/contributing/templates.md`, `docs/operator/configuration.md`, `docs/operator/upgrade-backup.md`, `messages/en.json`, `messages/zh-Hans.json`, `messages/zh-Hant.json`, `src/components/delete-dialog-content.tsx` (new), `src/themes/sections/comments-section.tsx`, `src/themes/poster-layout.tsx`, `src/themes/broadsheet-layout.tsx`, `src/themes/thread-layout.tsx`, `src/app/(host)/events/[id]/announcements/page.tsx`, `e2e/accessibility.spec.ts`, `e2e/locales.spec.ts`, `e2e/comments.spec.ts`, `e2e/announcements.spec.ts`, `e2e/events.spec.ts`, `e2e/broadsheet.spec.ts`, `e2e/thread.spec.ts`, `e2e/magic-link.spec.ts`, `e2e/rate-limits.spec.ts`, `e2e/co-hosts.spec.ts`, `e2e/hosts.ts`, `perf/event-page.perf.ts`.

## Self-review

- `outline-none` sits on every Poster `SectionLabel` and Broadsheet `Section` heading, not only the one that takes the focus; on headings that cannot be focused it does nothing, so I kept the class unconditional rather than add a branch.
- If `DeleteDialogContent` cannot find its trigger at opening (it always has in the tests, including Never mind returning the focus), a cancel would send the focus to the heading rather than the button: a mild fallback, not a loss.
- The delete names carry the time to the minute; two items in one minute share a name (noted in the ticket).
- The upgrade note first said nothing changes on a live page until the host chooses; that was false for effects (every M1 event stored its template's effect, Birthday's sparkles included), so it now says effects are the exception and how to turn them off.
- The README first said "reminded a week and a day before", which reads as eight days; reworded.
- My first accessibility helper used `isVisible()` (no wait) to decide whether to open the Thread's bubble, which raced the comment box in the dark-tone Poster run; it now waits for the box, and the Thread test opens its bubble explicitly.

## Concerns

- The full suite on this 4 GB VM took 45 min with swap full and lost four desktop tests to load; CI (more memory) should be the judge of the suite's health, and the two RSVP-flow axe tests may want a longer timeout if this machine stays the definitive loop.
- The portrait-poster Lighthouse case (not one of the three this ticket names) had an English median of 89 in the full audit and 91 rerun alone; it sits near the 90 line on this machine, as ticket 11 found (93, 91).
- Same dropped focus after removing a co-host, revoking a link, or removing a guest (outside the ticket); `DeleteDialogContent` fits each.
- Ticket 05's note (sign-up from a co-host link does not carry `next`) is a behaviour change outside the ticket; left.
- `CONTEXT.md` proposals (co-host link, sign-in link, stop link, mail token, owner, background) are in the ticket comment.

---

# Fix report, round 1

**Status:** DONE

Commit `ad115d9` Docs: the 0.3 note says when a late reminder still goes (new commit; the eleven reviewed commits are untouched).

1. **Important, fixed: `docs/operator/upgrade-backup.md` contradicted the reminder rule.** The old sentence claimed turning reminders on less than a week (or a day) out sends no week (or day) reminder. `remindersDue` sends any reminder whose time is at most a day past and that falls after publishing; when reminders were turned on is not recorded. New text: "A reminder goes out only within a day of its time, a week before the start for Maybe and a day before for Going, so turning reminders on, or setting up mail, more than a day after a reminder's time sends none: less than six days before an event, no "in a week" reminder goes, though the day reminder can still go during the event's last day." Same register as the note around it.
2. **Minor, fixed: "the hosts" rendered two ways in Chinese.** `EventPage.draftBanner` and `Events.manage.draftHint` now say 只有主办人 / 只有主辦人, matching `Events.form.commentsEnabledHint`, `EventPage.hostedBy` and the hosts page title. Every English string with "hosts" was listed; each file now renders "the hosts" as 主办人 / 主辦人. Flagged for the maintainer in the ticket.

Checks: `pnpm test` 64 files / 526 tests, `pnpm lint`, `pnpm typecheck` (after `rm -f tsconfig.tsbuildinfo`) pass. `e2e/events.spec.ts`, `broadsheet.spec.ts`, `thread.spec.ts`, `locales.spec.ts`: 63 passed (2.9 min), production-build loop (`pnpm build`, standalone server on :3000, Compose dev profile, two workers). No spec asserts the Chinese draft notices; `translations.test.ts` is green inside `pnpm test`.

Workspace: port 3000 free; the dev, test and s3 profiles stopped (`stop`, never `down -v`); the build's copied `public`, `.next/static` and `drizzle` removed from `.next/standalone`. Ticket comment updated with a dated fix entry; the maintainer's doubt line on the draft notices updated to the new wording.
