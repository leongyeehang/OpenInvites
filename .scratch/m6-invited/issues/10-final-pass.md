# 10: Translations, accessibility, docs

**What to build:** The milestone's last pass: the Chinese strings reviewed, the keyboard, locale and reduced-motion specs extended to every new screen, the docs, the glossary proposals collected, the release note, and the full browser run.

**Blocked by:** 01 to 09

**Status:** ready-for-agent

- [x] zh-Hans and zh-Hant: every key added in 01 to 09 read in context (the Invites page, the Settings sheet's Album group, the Schedule sheet, the locked page, the letter and schedule panels, the mails); the strings the implementers were least sure of listed in this ticket's comment for the maintainer.
- [x] Keyboard rows: the Schedule sheet (add, remove, the radios, Done); the locked form (email, Send, the code, Send it again); Approve and Remove in the album viewer; the Invites page's Send, Send again, Share and the letter fields. Locale rows for each new screen in one Chinese script. Reduced motion: `expectStill` with a "Now" item and with the letter panel.
- [x] Docs: `docs/operator/configuration.md` (the invitation, pass-code and photos mails among what mail sends; `RATE_LIMIT_MAIL`; the photos limit and pending photos); the host guide (invite-only and how guests get in, letters, album visibility and approval, the schedule and the freshness setting); the upgrade note.
- [x] The glossary proposals from the spec (Invite list, Invite-only, Pass, Letter, Schedule, the widened Album) collected in one comment for the maintainer's `CONTEXT.md`; not edited here.
- [x] `.scratch/m6-invited/release-note-0.6.0.md` drafted.
- [ ] The full browser suite on the Docker test profile rebuilt from the branch, `CI=1 pnpm exec playwright test --workers=2`, every project; the counts and any flake in the comment; `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes for the implementer

- CI fails on any flake (`failOnFlakyTests`): a row that passes only on retry is a bug in the wait, not in the app.
- Commit subject, e.g. `M6: translations, accessibility and docs`.

## Comments

### 2026-11-07 — Hardening batch (before 10)

The seventeen code-level minors the reviews of Tasks 1–9 deferred, in one commit. Unit evidence is
`pnpm test` (all green); browser evidence is the named specs on the Docker test profile rebuilt
from the tree, `CI=1 … --workers=2`.

1. Pass signed for its purpose — `src/invites/pass.ts` signs `pass:eventId:inviteId:expires`;
   `pass.test.ts` "is signed for its purpose" (an unprefixed signature reads as no pass).
2. Switch race — `saveRsvp` invites a new reply through no invite on an invite-only event under
   the lock (`invitesNewReply` in `src/invites/invite.ts`, unit-tested; `inviteFromRsvp`, fresh
   token, reply tied both ways, `MyRsvp.inviteToken` its token); comment above
   `inviteRepliedGuests` says so. No browser row: the race cannot be staged without timing.
3. `inviteRepliedGuests` inserts a thousand at a time (`chunks`) and ties replies back with one
   `UPDATE … FROM invite` naming no ids; covered by the 500-cap row of `invite-only.spec.ts`.
4. `MyRsvp` is a union that keeps one token at least; `planRsvp` carries the held tokens
   generically; `editLinkOf` no longer throws. `pnpm typecheck`; `plan.test.ts`, `guest.test.ts`.
5. Send on a deleted invite answers `Invites.errors.inviteGone` before the mail limit is spent
   (`src/invites/actions.ts`); `invites.spec.ts` paste row, Send from a stale tab. Saving a letter
   to a deleted invite answers the same (fix round 1).
6. A stopped invite's stop link (stopped through it or through the reply's link) says "Emails
   about this event are stopped." with no Stop button; the invite keeps its email
   (`findInviteByMailToken` returns `stopped` from `mailStopped`; new `StopMail.stopped` in three
   locales; fix round 1); `invites.spec.ts` stop rows for Mei and Ravi.
7. `listInvites` orders by `created_at` desc then id asc, so a paste keeps its order;
   `invites.spec.ts` paste row checks the three names in order.
8. "Add several" splits on `,` or `，`; `invite.test.ts` full-width row. Hint left as is.
9. The schedule's minute tick skips a refresh under 30 s after the last (`refreshDue` in
   `src/schedule/clock.ts`, unit-tested); `schedule.spec.ts` minute and reload rows green.
10. Thread schedule bubble on `bg-theme-glass`, named by its heading (`aria-labelledby`);
    `schedule.spec.ts` checks the named region; `accessibility.spec.ts` green.
11. A cancelled event shows no schedule (`scheduleFor`); `cancel-delete.spec.ts` row.
12. Approving one photo disables only its own Approve, in the grid and the viewer (`useOptimistic`
    set of ids in `album.tsx`); `album-settings.spec.ts` green. No row for two at once: timing.
13. Thumbnail Approve and Delete are named "Approve/Delete photo {n} by {name}" (new keys in all
    three locales); `album-settings.spec.ts` asserts the names.
14. Schedule and poll times are validated whole (`fieldTime` in `src/polls/poll.ts`; seconds still
    taken); `schedule.test.ts` and `poll.test.ts` "19:00junk" rows.
15. Null-token row in `invite-only.spec.ts`, through Dev's invite link (no email, so no code and no
    30-second resend wait): a third device changes his reply and keeps it on reload.
16. The page uses the gate's invite before asking `deviceInvite` again (`src/app/e/[slug]/page.tsx`).
17. `letterFor`'s comment moved onto the function; one line left on `Letter`.

### 2026-11-07 — Translations, accessibility and docs (ticket 10)

Boxes 1 to 5 done; **box 6 is not ticked and the status stays as it was**: the full run was not
clean, for a reason in this machine, not the app (below). One commit, `M6: translations,
accessibility and docs`. `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 92 files, 977 tests
passed.

**The full run.** The Docker test profile rebuilt from the committed tree, then `CI=1 pnpm exec
playwright test --workers=2`, every project (10:55 to 12:12, 1.3 h): 713 tests, **703 passed, 4
flaky, 4 failed, 2 skipped**. By project: operator 1 passed; mobile 332 passed, 2 skipped (the
desktop-editor rows, which skip themselves there); desktop 326 passed, 4 flaky, 4 failed;
fresh-instance 15, limits-instance 6, retention-instance 5, home-instance 18 passed. Of the twelve failed
desktop attempts, ten are Chromium's renderer crashing (`locator.click: Target crashed`); two read
as assertions: `guest-mail.spec.ts:109`'s first attempt (its confirmation never showed, and its
page was gone before the snapshot), and the retry of `album.spec.ts:40`, whose first attempt
crashed (after Priya deleted one of her two photos, her album showed none where one was left, at
line 84). Neither is proven a crash, but both ran beside a crash in the other worker, and both
tests pass at one worker and on mobile every time they were run today. All are in specs this
branch does not touch: `album.spec.ts:40` (failed), `capacity.spec.ts:191` and `:261`
(failed), `reactions.spec.ts:54` (failed), `announcements.spec.ts:177`, `capacity.spec.ts:48`,
`guest-mail.spec.ts:49` and `:109` (flaky). A first full run, started an hour earlier on the same
tree, crashed the same way from the same test (`album.spec.ts:40` on desktop) and was stopped.

What was found about the crashes:
- Only the desktop project, and only once both workers are on it (the run reaches it at about
  test 389): `album.spec.ts` + `capacity.spec.ts` on desktop at two workers crashed in every try
  (six, two of them with the variations below; 3 to 6 of the 14 tests each time), on mobile at two
  workers none (14 passed), and on desktop at one worker none (14 passed).
- **The base commit crashes the same way**: the test profile built from fafec4a (this branch
  before this ticket, in a worktree) gave 4 and 5 crashes in two tries of the same two specs. The
  same specs passed at two workers on this machine earlier in the day (tickets 01 to 09's runs,
  and this ticket's own rows until about 10:00).
- Not memory (no OOM in the cgroup, 10 GB available, `/dev/shm` unused), not threads (under 800 of
  7,285), not the GPU (`--disable-gpu` crashes too), not the headless shell (the full Chromium
  build, `channel: "chromium"`, crashes too). Chromium writes nothing about the renderer's end
  with `--enable-logging`.
- The five specs with a failure or a flake, rerun on desktop at one worker: **24 passed, none
  retried** (3.8 min).

So no wait was changed: none of these is a wait. A clean `--workers=2` run needs a machine where
two desktop Chromiums do not crash; that run, and ticking box 6, are left for the controller.

How it landed:

- **The carried items** (`.superpowers/sdd/m6-invited-plan/task-10-carried.md`), all eleven:
  1. A guest whose reply awaits the host's approval is no longer told to reply: the album's locked
     view carries `awaitingApproval`, and `EventPage.album.lockedPending` (a select on who sees the
     album: "Once the host approves your reply you'll see the album and can add your photos.", the
     `going` and `hosts` branches saying who sees it) in three locales. New row in
     `album-settings.spec.ts`: the line under "Guests who have replied" and under "Only the hosts",
     no Add photos, and a visitor still asked to reply.
  2. The thumbnail's icon-only Approve has `title` (its accessible name), `hover:opacity-90` (the
     accent buttons' hover), and `aria-busy` with `disabled:opacity-50` while it approves.
  3. "the site" for "the instance" in `src/album/notify-hosts.ts`, the header of
     `e2e/invite-only.spec.ts`, and one more M6 comment in `src/invites/pass-actions.ts`.
  4. `Invites.explainer` says the email and phone number the host gives are filled in where the
     event asks for them, in three locales.
  5. `LetterField` shows the letter as kept (CRLF made LF, trimmed, as `parseLetter` keeps it) once
     saved, and "Letter saved." goes as soon as the text changes; new steps in the letters row of
     `invites.spec.ts`.
  6. The phone prefill row asserts the email is in the same HTML where the phone is absent.
  7. The comments of `/m/[token]` (page and action), the proxy's stop-link branch and
     `blankEmailByMailToken` name invites (and voters) beside RSVPs; the two over-long comment
     lines in `src/invites/repository.ts` and `src/invites/actions.ts` are rewrapped.
  8. One comment on `passMail` (`src/invites/pass-actions.ts`): the pass code has no stop link and
     goes to a stopped invite, as the RSVP code does, because the guest asked for it this minute.
  9. The invite-only banner's no-mail sentence and its link are two paragraphs, joined by no
     space in any language.
  10. The redundant `page.reload()` before `reply(...)` in `invite-only.spec.ts` is gone.
  11. The hardening entry above is kept.

- **What the keyboard walks found, and fixed** (each failed its new row before the fix):
  - The Schedule sheet lost the focus when its last row was removed (the button went with it) and
    left it on Add an item, below the new row, after adding one. Add now puts the focus on the new
    row's Day; removing the last row gives it to Add an item (`flushSync`, then focus); removing
    another leaves it on the same Remove button, which then removes the row that moved up.
  - The sheet's two freshness radios, native inputs, showed no ring: they now have the sheet's
    `focus-visible:outline-ring` outline.
  - The locked page's "Send it again" showed no ring (the locked page is plain, outside the event
    page's `:focus-visible` rule): it has the outline too.
  - Send on an invite's row and Save letter lost the focus to the page, being disabled while their
    action ran. `useFocusKept` (`src/components/use-focus-kept.ts`) gives it back to the button
    once the action is done when the button had it as the form was sent, so Send becomes Send
    again under the keyboard and Space sends again.
  - Not fixed, for the maintainer: the date poll's sheet (`src/editor/poll-sheet.tsx`, M4) has the
    same add and remove-the-last-row focus behaviour the Schedule sheet had; it is not M6's.

- **Keyboard rows** (`e2e/keyboard.spec.ts`, both projects): the Schedule sheet (reached from its
  row by Tab, Add an item by Enter and by Space with the focus on the new Day, start time and title
  typed, a third row removed by its Remove with the focus on Add an item, ArrowDown to "Only when
  the page is opened", Done by Enter, the focus back on "Schedule: 2 items"); the locked form (the
  email, Tab to Send me a code, Enter, the code field focused, the code typed, Tab to Open the
  invitation, Tab to Send it again, waiting, `aria-disabled` with its seconds as description,
  Enter sends nothing, Shift+Tab and Enter opens the invitation); the album viewer (Enter on a
  waiting thumbnail, Approve by Enter with the focus to Download, ArrowRight, Delete by Space, Delete
  it by Space, the focus on the album's heading); the Invites page (Share by Enter into a stubbed
  share sheet, Send by Enter, the focus kept on Send again, Space sends again, the letter typed over
  two lines, Save letter by Enter, kept on reload). Each stop is ringed (`expectVisibleFocus`).
  Chrome steps through a date or time field a part at a time, and reading a ring blurs and
  refocuses it, back at its first part, so `tabThroughFields` reads the ring of every other stop
  and of those fields where they are first reached.
- **Locale rows** (`e2e/locales.spec.ts`): in Simplified Chinese, a host whose browser asks for
  zh-CN opens the Schedule sheet (日程: 添加日程, 添加一项, 开始时间 1, 仅在打开页面时刷新 and its
  hint), the Settings sheet's Album group (谁可以看到相册 with 回复参加的宾客, 照片须经批准才会显示)
  and turns on 仅限受邀者 in 宾客, then on the Invites page reads the banner, turns on 专属信件, sees
  任何拿到这个链接的人都能打开邀请 on a row with no email, sends an invitation (已把邀请发送给 王美。),
  and stops it from its stop link, which then reads 这个活动的邮件已经停止发送。. In Traditional
  Chinese, an invitee whose browser asks for zh-TW, on a live invite-only event: the locked page
  (一份私人邀請, 來自 …, 寄送驗證碼, the neutral sentence), the code's email in zh-Hant, her letter
  (致 Mei), the schedule (時間均依 UTC 時區顯示。, 進行中 on the item now, 已結束 hidden on the past
  one), her reply, and a photo awaiting approval (garden.jpg：已新增，等候核准, 等候核准).
- **Reduced motion** (`e2e/reduced-motion.spec.ts`): `expectStill` with the letter panel in the
  Poster, the Broadsheet and the Thread. The live schedule with a "Now" item has had its row since
  ticket 02 ("under reduced motion a live schedule is still"), by the real clock.
- **Docs.** `docs/operator/configuration.md` had the three mails, `RATE_LIMIT_MAIL` and the
  photos limit from tickets 03 to 07; this pass says the pass code carries no stop link and reaches
  a stopped invite, that the codes are the mail sent at once rather than queued, and that the
  photos-waiting mail comes from uploads, which `RATE_LIMIT_UPLOAD` bounds (it is not counted
  against `RATE_LIMIT_MAIL`, as the reply and comment emails are not). **There is no host guide**:
  hosts are addressed in the README's "What it does", which gains "Invitations for the people you
  name" (the invite list, letters, emailed invitations, invite-only and how guests get in: the code
  on each new device, the link alone for an invite without an email, only those on a site without
  mail, the switch adding everyone who replied) and "The day, as it happens" (the schedule, the
  clock, the minute's refresh and the advantages of "Only when the page is opened"), and its
  "Replies without an account" bullet gains the album's visibility and approval.
  `docs/operator/upgrade-backup.md` gains "Upgrading to 0.6" (migrations 0043 to 0045, nothing
  back-filled, the defaults: invite-only and letters off, the album to everyone who replied, no
  approval, the photos email on, a minute's refresh; the three mails and their limits; pending
  photos counted; without mail only the no-email invitees).
- **Release note**: `.scratch/m6-invited/release-note-0.6.0.md`, in the 0.5.0 note's shape.

Proposal for the maintainer: a short host guide, `docs/hosting.md`, for what hosts can do and how
guests get in, linked from the README, so the README's "What it does" can stay a list.

**Glossary proposals for `CONTEXT.md`** (from the spec; ready to paste under Language, in its
format; `CONTEXT.md` is not edited here):

```
**Invite list**:
The named people a host has made personal invite links for, each with an optional email and phone.
_Avoid_: guest list (that is the RSVPs), contacts, attendees

**Invite-only**:
A published event whose event page opens only for people on its invite list, each proven by their email on the device they use, or by their personal invite link when the invite has no email.
_Avoid_: private (Draft avoids it too), locked, restricted

**Pass**:
The mark on a guest's device that they are in on an invite-only event.
_Avoid_: session, login, token (in prose)

**Letter**:
A host's personal note to one invitee, shown on their invitation and in their invitation email.
_Avoid_: message (announcements are messages), note, greeting

**Schedule**:
The host's list of timed items for the event's day or days, shown on the event page and following the clock.
_Avoid_: timeline, agenda, itinerary, programme, run of show

**Album** (replacing the current entry):
An event's photos, open from its start to the hosts and to whichever guests the host chose; guests whose RSVPs are not pending or declined may add to it.
_Avoid_: gallery (the gallery is the posters'), media
```

**Chinese.** Every key 01 to 09 and the hardening batch added or changed (113 keys, read in the three
files side by side, on the screens they belong to) was read again in both scripts. Changed in this
pass (both scripts unless said):

- `EventPage.lockedTitle` 你受到了邀请 → 你收到一份邀请 / 你收到一份邀請: "受到了邀请" is the passive of
  the English; the Thread layout already says "You’re invited" as 你收到一份邀请.
- `InviteOnly.sent` 验证码已在路上 ("on its way") → 验证码已经发出，请查收 / 驗證碼已經寄出，請查收.
- `InviteOnly.emailHint` 就是你受邀时用的邮箱。… → 填写你受邀时使用的邮箱，我们会把验证码发送到这个邮箱。
  (Hant likewise): an instruction, not a spoken aside.
- `Invites.inviteOnlyBanner` 已开启仅限受邀者：只有这些人才能打开邀请 → 已开启“仅限受邀者”：只有名单上的
  人才能打开邀请 (Hant 「」): the setting's name quoted, and "these people" as "the people on the
  list".
- `Invites.inviteOnlyNoMail` …只有这里没留邮箱的人才能进入 → …只有名单上没留邮箱的人才能打开邀请: 进入
  ("enter") said what the page does in English; the invitation is opened everywhere else.
- `Invites.pasteHint` 用英文逗号分隔 → 格式为：名字, 邮箱, 电话（中英文逗号都可以）: since the
  hardening batch a full-width comma separates too, so the hint no longer asks for the ASCII one.
- `EventPage.album.lockedHosts` and `yoursHosts` 这个相册由主办人保管 ("the hosts keep this album") →
  这个相册仅主办人可见; `yoursHosts` 他们能看到你添加的照片 → 你添加的照片主办人都能看到 (Hant
  likewise). `yoursGoing` and `Events.form.album.going` 参加的宾客 → 回复参加的宾客 / 回覆參加的賓客,
  the guests who answered 参加, as `lockedGoing` says.
- `EventPage.schedule.inZone` 时间均为 {zone} 时间 → 时间均按 {zone} 时区显示 / 時間均依 {zone} 時區顯示:
  the zone is an IANA name ("Asia/Singapore 时间" read oddly).
- `Editor.scheduleSheet.freshReload` 仅在打开页面时 → 仅在打开页面时刷新 / 僅在開啟頁面時重新整理: a
  whole choice, matching its sibling 每分钟刷新一次; `freshReloadHint` 没有后台请求…也让本站保持安静
  ("keeps the site quiet") → 不在后台发送请求…也减轻本站的负担.
- `Events.errors.scheduleTimeInvalid` 第 {n} 项有一个时间无效 → 第 {n} 项的时间无效;
  `scheduleDayInvalid` 需要一个有效的日期 → 需要有效的日期 (the counted article dropped).
- `Mail.invitation.body` 打开你的邀请：{url} → 查看邀请：{url} / 查看邀請：{url}.
- `Invites.explainer` (carried item 4) and the new `EventPage.album.lockedPending` (carried item 1),
  in both scripts.

**The Chinese strings I am least sure of**, for the maintainer (key — en — zh-Hans — zh-Hant —
why). No ticket of 01 to 09 flagged any as least sure; ticket 05 noted only the paste hint's
英文逗号, now changed. So these are the ones that still read most like English, then the ones
this pass changed:

| Key | en | zh-Hans | zh-Hant | Why unsure |
| --- | --- | --- | --- | --- |
| `Invites.lettersEnabled` | Personal letters | 专属信件 | 專屬信件 | 信件 sounds like post; 专属 matches 专属邀请, but a host might say 给宾客的话 or 亲笔信. |
| `Invites.letter` (and `saveLetter`, `letterSaved`, `errors.letterTooLong`) | Letter | 信件 | 信件 | Same word; a bare 信 would be more natural but is thin as a field label. |
| `EventPage.letter.for` | For {name} | 致 {name} | 致 {name} | 致 is right for a letter's heading but formal on a party invitation; 给 {name} is the casual alternative. |
| `InviteOnly.title` | A private invitation | 一份私人邀请 | 一份私人邀請 | 一份 carries the English article; 私人邀请 alone, or 这是一份私人邀请, may read better as a heading. |
| `InviteOnly.from` | from {host} | 来自 {host} | 來自 {host} | 来自 is translationese for a byline; {host} 的邀请 would need the two keys merged. |
| `Events.form.guests.inviteOnly` (and `Invites.inviteOnlyBanner`) | Invite-only: only people on the invite list can open the invitation | 仅限受邀者：只有邀请名单上的人才能打开邀请 | 僅限受邀者：只有邀請名單上的人才能開啟邀請 | 仅限受邀者 is clear but stiff as a setting's name; 仅限受邀宾客 is an option (私密 is avoided, as the glossary avoids "private"). |
| `Invites.sendAll` | Send to everyone not yet sent ({count}) | 发送给所有还没发送过的人（{count}） | 寄給所有還沒寄過的人（{count}） | Kept, but "还没发送过的人" can read as the people who have not sent anything; 发给所有还没收到邀请的人 is clearer though not exactly the rule. |
| `EventPage.schedule.title` / `Editor.schedule` | Schedule | 日程 | 日程 | For a party or a wedding 流程 (活动流程) may be what a host writes; 日程 suits a weekend better. |
| `Editor.scheduleSheet.freshLegend` | Keep guests’ pages fresh | 让宾客的页面保持最新 | 讓賓客的頁面保持最新 | Literal; 宾客页面的更新方式 names the choice rather than the aim. |
| `Editor.scheduleSheet.freshReloadHint` (changed) | …keeps the site quiet… | 不在后台发送请求：…也减轻本站的负担。… | 不在背景發送請求：…也減輕本站的負擔。… | "Keeps the site quiet" became "lightens the site's load"; check it says what the operator gains. |
| `Invites.stopped` | Stopped email | 已停止接收邮件 | 已停止接收郵件 | A badge on the host's list: it is the guest who stopped; 对方已退订 is shorter but colloquial. |
| `Mail.photos.subject` | {name} added … photos to {title} for your approval | {name} 在“{title}”添加了 # 张照片，正在等待你的批准 | {name} 在「{title}」新增了 # 張照片，正在等候你的核准 | 正在等待你的批准 is correct but long for a subject; 等你批准 is shorter. |
| `EventPage.album.lockedPending` (new) | Once the host approves your reply… | 主办人批准你的回复后，你就能… | 主辦人核准你的回覆後，你就能… | New in this pass, in the shape of `comments.lockedPending`. |
| `EventPage.lockedTitle` (changed) | You’re invited | 你收到一份邀请 | 你收到一份邀請 | Now the Thread's words for the same English; it is the browser tab's title of the locked page. |
| `Invites.pasteHint` (changed) | One person per line, as Name, email, phone… | 每行一人，格式为：名字, 邮箱, 电话（中英文逗号都可以）… | 每行一人，格式為：名字, 電子郵件, 電話（中英文逗號都可以）… | The example still uses an ASCII comma after the name; a host typing in Chinese will use ，, which now works. |

Left for the controller: the full run on a machine whose desktop Chromiums do not crash, then
box 6 and the status. Left for the maintainer: the glossary entries above; a host guide (above);
the date poll sheet's focus on removing its last date (above); the Chinese list above.

**2026-11-07, implementing agent: final review fixes.** The whole-branch review's two Important and
six Minor findings, and this ticket's own review's six minors, in one round.

What changed:
- **One guest, one invite (B1).** Turning invite-only on ties a reply to the oldest unanswered invite
  with the same email, in any case, before it makes new ones (`tieRepliesToInvites`, pure, in
  `src/invites/invite.ts`; `inviteRepliedGuests` sets those invites' `rsvp_id` and, if unset,
  `opened_at`, a thousand pairs a statement, then ties every reply back by the id-free
  `UPDATE … FROM` as before). `findInviteByEmail` takes an answered invite first.
- **A host's email correction reaches the invite (B2).** `editRsvpAsHost` writes the reply's new
  email to the invite it is tied to, in the same transaction under the same lock
  (`inviteEmailAfterHostEdit`, pure, in `src/rsvps/plan.ts`); a blank one blanks the invite's, which
  then admits by the link alone. The guest list's save revalidates the Invites page.
- **The reply before the cookie (B3).** `deviceInvite` stands for the pass's invite, else the
  invite of the reply the device holds, else the invite cookie's (`standsFor`, pure, in
  `src/invites/access.ts`), so a guest who replied stays in after opening a forwarded email invite's
  link.
- **Turnstile on the locked page (B4).** The locked form carries the widget when it is configured,
  and each of its posts (Send me a code, Open the invitation, Send it again) waits for it; `passAction`
  runs `checkTurnstile` after the RSVP limit and before the mail limit, as `saveRsvpAction` does, and
  a failed check answers "Please complete the check and try again." (`InviteOnly.errors.checkFailed`,
  three locales). The operator docs list the locked page among the checked forms.
- **The title (B5).** An invite-only event's page title is "You're invited" for everyone but its
  hosts. **B6** comment rewrapped. **B7** the no-mail row turns invite-only on and reads the no-mail
  banner. **B8** `AUTH_SECRET`'s row says rotating it voids every guest's pass.
- **A1** `saveLetterAction` returns the letter as kept; the field takes it only while it still holds
  what was sent (`adoptSaved`, `src/lib/adopt-saved.ts`). **A2** the locked keyboard row checks the
  waiting state after Enter and counts the mail after the next round trip. **A3** the viewer's first
  stop is asserted (Approve). **A4** the album row covers `going`; the schedule keyboard row removes a
  middle row and keeps the focus on "Remove item 2". **A5** "Send to everyone not yet sent" is
  `aria-disabled`, focusable and inert once nobody is left, and keeps the focus. **A6** the release
  note says Share appears where there is a share sheet, beside Copy, until the guest replies.

Evidence:
- Unit RED: 11 failed (`tieRepliesToInvites`, `standsFor`, `inviteEmailAfterHostEdit` not functions;
  `./adopt-saved` missing). GREEN: those four files 65 passed. `pnpm lint`, `pnpm typecheck` clean;
  `pnpm test` 93 files, 990 passed.
- Browser RED, the new rows against the profile built from 6dfcfc4, desktop, no retries: the
  invitee's title (B5), the switch row (4 invites, not 3: B1), the correction row (old email on the
  row: B2), the send-all row (focus lost: A5), the Turnstile locked-page row (no bot check: B4)
  failed; the viewer, locked keyboard, schedule and album rows passed (behaviour already there).
- Browser GREEN, rebuilt from the tree, `CI=1`, two workers, both widths: invite-only, invites,
  keyboard, album-settings, schedule, turnstile 124 passed; one desktop "Target crashed" in the
  switch row, passed on retry, and `invite-only` alone at one worker then passed 15 of 15. The
  no-mail spec needs the docker group to recreate its instance; under `sg docker` 7 passed.
