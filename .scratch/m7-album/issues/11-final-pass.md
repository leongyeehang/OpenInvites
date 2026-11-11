# 11: Translations, accessibility, docs, the full run

**What to build:** The milestone's Chinese strings reviewed together; keyboard, locale and reduced-motion rows for every new screen; the operator docs and the upgrade note complete; the release note; the glossary proposals collected for the maintainer; the full browser suite on the Docker test profile.

**Blocked by:** 01 to 10

**Status:** done

- [x] Chinese: read every `zh-Hans` and `zh-Hant` string this milestone added (`Instance.limits`, `Instance.storage`, `Events.form.album`, `Events.album`, `Host.dashboard.albumReminders`, `EventPage.album`, `Mail.photos`, `Mail.albumReminder`, `Mail.albumCleared`, the errors) against the English and the glossary's words; fix what is wrong; list in Comments the strings you are least sure of, with the reason, for the maintainer to check (M6's ticket 10 is the model).
- [x] Accessibility and keyboard: axe rows (`expectNoSeriousViolations`) for Site settings with the Storage card, its stray list and a confirm open; the Limits card's new fields; the Album settings group; the manage page with the reminder notice; the dashboard with the reminders block; the album with video, Processing and failed tiles; the viewer with the player and the quality control. Keyboard: the quality control is reachable and operable by keyboard; the reminder select and Empty the album confirm by keyboard; the stray list's Remove confirm by keyboard.
- [x] Locale rows (`e2e/locales.spec.ts`): zh-Hant for the album's label and the Processing tile, the Limits card's new labels, the Storage card's headings, the reminder notice. Reduced motion (`e2e/reduced-motion.spec.ts`): the Processing tile and the player still.
- [x] `docs/operator/configuration.md`, the full pass: the Limits bullet (`:57-68`) with every limit, its default and range, "Photos and videos per event", "Remind hosts about albums after"; a `### Storage` subsection: the card's figures, the processing switch, the videos line, Clear the album, the stray check, the overshoot of at most one batch when two albums fill the site together, the one-time measuring after the upgrade and that an old photo's size is what is stored; `## Uploaded pictures` becomes `## Uploaded pictures and videos`: the video files and what each is for, metadata dropped, `/tmp` needs about three times the largest video, the site runs one app container, the retired `MAX_UPLOAD_MB` row; `VIDEO_PROCESSING` and the worker (`deploy/compose.yaml`'s commented service, memory about 300 MB while a clip converts, ffmpeg 6 or later, how a missing ffmpeg shows); the Mail section's three emails (items waiting now naming videos, the album reminder, the operator's clearing); the `RATE_LIMIT_UPLOAD` row.
- [x] `docs/operator/upgrade-backup.md`: `### Upgrading to 0.7` before `:38`, in 0.6's shape: what the release adds; the migrations `0046` to `0051` run at start; the image is larger (the ADR's figure) because it carries ffmpeg; the one-time measuring runs in the background after the first start and the Storage card says so until done; `MAX_UPLOAD_MB` is read once into Largest photo and then ignored, and a site that never set it starts at 40 MB where it had 10; existing events have no album reminder and keep every setting as events behaved before; no new environment variable is required, `VIDEO_PROCESSING` is optional; `compose.yaml` gains no service unless the operator adds the worker.
- [x] README "What it does": the album takes videos, played at two qualities; storage and every limit on Site settings; albums emptied by hosts and reminders. `deploy/.env.example` checked for the two lines tickets 01 and 08 added.
- [x] `.scratch/m7-album/release-note-0.7.0.md`, in the shape of `.scratch/m6-invited/release-note-0.6.0.md`: videos; limits on screens; storage; clearing up; the upgrade note's points; the ADR.
- [x] A Comments entry "Glossary proposals for CONTEXT.md" copying the spec's six (Album widened, Video, Original quality and Lighter copy, Processing, Album reminder, Storage) with any wording the code settled; CONTEXT.md itself is not edited.
- [x] The full browser suite: `docker compose --profile test up -d --build --wait`, then `CI=1 pnpm exec playwright test --workers=2` over every project; results per project in Comments, every failure or flake named with its spec and whether it is this branch's; `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes for the implementer

- Anything a ticket left as a follow-up in its Comments is listed here for the maintainer, not fixed silently.
- Commit subject, e.g. `M7: translations, accessibility and docs`.

## Comments

### 2026-11-09 — Translations, accessibility and docs (ticket 11)

One commit, `M7: translations, accessibility and docs`. `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 108 files, 1,081 tests. The full run's results are under "The full run" below.

**Chinese.** Every string the milestone added was read in both scripts against the English and the glossary (the dump is in the session's workspace). Fixed: "Never" for the album reminder was 永不 in Traditional Chinese where the Limits card and the rest say 從不 (the select and the reminder email now agree); the worker's "last seen" line put the relative time after 于/於, which reads wrongly with "3 分钟前", so it is now "最近一次报告：{time}"; a video's tile label was "{name} 的视频 {n}" against a photo's "{name} 的第 {n} 张照片", now "{name} 的第 {n} 段视频" in both scripts, pending variant included; "stray files" was 多余文件 (superfluous), now 残留文件 / 殘留檔案 (left behind), which is what they are. Least sure, for the maintainer:
1. 残留文件 / 殘留檔案 for "stray files" (Site settings): 孤立文件 (orphaned) is the other common term.
2. 轻量副本 / 輕量副本 for "Lighter copy" (the player and Album settings): 精简版 was the alternative; 轻量 reads as "light" in the sense of weight, which is the English's sense.
3. 工作容器 for "worker container" (the Storage card): a literal rendering; 后台处理容器 would say what it does.
4. 原始画质 / 原始畫質 for "Original quality": 画质 is picture quality, which is what the choice is about.
5. 处理中 / 處理中 for the Processing tile, and 无法处理 / 無法處理 for a failed one: short, as a tile needs.
6. The Limits card's "Remind hosts about albums after" is a sentence in Chinese (活动结束多少天后提醒主办人处理相册), long for a label but clear; a shorter one would lose the "after the event".

**Accessibility and keyboard.** Axe rows added: the album with a clip processing and the viewer with the player (`album-video.spec.ts`; the `video-caption` rule alone is set aside there, since a guest's clip has no captions track and no page can make one: `expectNoSeriousViolations` takes `except` for that, named in the row); the dashboard with the reminders block and the manage page with the reminder notice (`album-reminder.spec.ts`); Site settings with the stray list and with its confirmation open (`limits.spec.ts`). The Limits card's new fields and the Album settings group are read by the existing rows for the instance settings page and the editor's Settings sheet. Keyboard rows: the quality control is reached from the player by Tab and worked by the arrows, which the control did not answer before (it was buttons with `role="radio"` and no arrow handling): `video-player.tsx` now keeps the chosen quality in the tab order and moves and chooses with the arrows, passing over a quality that cannot play, as a radio group does; Keep it and Empty the album by Tab and Enter, the reminder's select by the arrows (`album-reminder.spec.ts`); the stray list's Remove by Enter and its confirmation by Tab and Enter (`limits.spec.ts`). Reduced motion: the processing tile and the player hold still (`album-video.spec.ts`). Locale: a zh-TW guest adds a video and opens it (the picker's label, the status line, the Processing tile, the tile's label, the viewer's title and Download); the operator reads the Limits and Storage cards in Traditional Chinese after switching (`locales.spec.ts`); the reminder's notice and the dashboard's heading in Traditional Chinese (`album-reminder.spec.ts`). A failed tile's browser row came with the final review's fix pass (below): a clip asked for without a length and over the cap once probed.

**Docs.** `configuration.md`: the Storage subsection says what the card shows, including the videos line, the overshoot and the measuring; "Uploaded pictures" became "Uploaded pictures and videos", with a video's files, the metadata dropped, when the copy is made, ffmpeg 6, the memory a clip takes, `/tmp`, one app container and `VIDEO_PROCESSING`; the Mail section's list gained the album reminder and the operator's clearing, and names videos in the approval email. `upgrade-backup.md` gained "Upgrading to 0.7" (migrations 0046 to 0052, the image's size, the measuring, `MAX_UPLOAD_MB`, existing events, the two emails, no new variable). The README's "What it does" gained a bullet for photos and videos with the limits, the Storage card and the clearing up, and the operator's bullet names the new limits. `deploy/.env.example` carries the two lines tickets 01 and 08 added. The release note is at `.scratch/m7-album/release-note-0.7.0.md`.

**A finding on the test profile.** `recreate()` now empties app-fresh's uploads volume whenever `db-fresh` is recreated: the volume ticket 08 added so the worker sees the app's files outlives a recreated database, and the stray check found the files of every earlier run on the instance, as it should. A fresh database is a fresh instance again.

**The full run (2026-11-10).** `CI=1 pnpm exec playwright test --workers=2` over every project, on the test profile rebuilt with this ticket's changes: 758 tests, 756 passed, 2 skipped, none failed, none flaky, in 1.6 h (06:39 to 08:12 UTC). Per project: mobile 351, desktop 351, home-instance 18, fresh-instance 15, limits-instance 11, retention-instance 5, album-reminder-instance 5, worker-instance 1, operator 1 (the sign-in setup). The two skipped are `desktop-editor.spec.ts`'s two viewport rows on the mobile project, which skip themselves there by design, as before this branch. After it, `pnpm lint` and `pnpm typecheck` clean, `pnpm test` 108 files, 1,081 tests.

### Glossary proposals for CONTEXT.md

As the spec proposed, with the words the code settled; CONTEXT.md is the maintainer's to edit.

- **Album**: widen to "An event's photos and videos, open from its start to the hosts and to guests whose RSVPs are not pending or declined." _Avoid_ stays: gallery, media.
- **Video**: a clip in an album, kept at original quality with its metadata dropped, and with a lighter copy for slow connections when one is needed. _Avoid_: movie, clip (in the interface), media.
- **Original quality**: the video as recorded, rewrapped. **Lighter copy**: the 1080p or 720p H.264 copy the site makes. _Avoid_: transcode, rendition, stream (in prose).
- **Processing**: what happens to a video between its upload and its first play; a clip is "processing", then "ready", or "couldn't be processed". _Avoid_: encoding, conversion (in the interface).
- **Album reminder**: the email and notice, on the day the host chose, that ask a host to empty the album or keep it. _Avoid_: expiry, cleanup, purge.
- **Storage**: what a site's uploads take, counted as uploaded; the Storage card. _Avoid_: quota (in the interface), disk (except for the volume).
- **Stray file** (new, ticket 10): a file in storage that no photo, video or host's picture names, older than an hour. _Avoid_: orphan, garbage.
- **Worker** (new, ticket 08): the second container, from the same image, that processes videos when `VIDEO_PROCESSING=worker`. _Avoid_: job runner, daemon.

### Follow-ups the tickets left for the maintainer

- Ticket 07: the approval path for videos is the photos'; only photos are browser-tested under approval.
- Ticket 09: the redate rule that takes the reminder's mark off is covered by the unit-tested rule and the repository line, not a browser row.
- Ticket 10: the stray removal trusts a key's shape, not that the check listed it (the operator's own page sends it); `findStrayFiles` loads every item id and lists storage whole on the operator's press.
- Plan ruling 10: the stray-file check is a button on the Storage card, where the spec said a script in the image.


### 2026-11-10 — The final review and its fix pass

The whole-branch review (Fable, against the plan's twelve Review Focus items and the ledger's rulings; report in the plan's workspace, deleted with it) found no Critical, five Important and thirteen Minor findings, and judged the branch ready with fixes. Re-graded by what a person gets, six were fixed in one pass, each from a test watched failing first against the image of the reviewed commit; the rest are deferred for the maintainer and listed in the final message.

Fixed, with migration `0053_touched_at_failure` (`album_upload.touched_at`, `photo.failure`):
- **The hosts' email about photos waiting was lost when a batch's last finish was a video or a refused file.** The email now goes when the batch's last *photo* is finished or refused, whichever comes last (`deleteUpload` returns it as a finish does, under the event's lock); a video's own email, once processed, is unchanged. Row: `album-settings.spec.ts`, a photo with a junk file after it.
- **A job that crashed the processor was retried every hour for ever.** A job claimed more times than there are tries (`crashedOut`, unit-tested) is failed and its clip as sent deleted, with the log saying so.
- **An ask with no bytes behind it held the site's storage for a day, unseen.** The sweep now also drops a batch that has received nothing for an hour (every part writes `touched_at`; a moving batch keeps every upload of it, so a large batch on a slow connection is safe); the Storage card shows "Uploads in progress" on its own line. Row: `limits.spec.ts`, an ask backdated two hours and the app restarted.
- **A reload mid-upload re-sent every part.** A resumed upload asks which parts arrived before sending. Row: `album-video.spec.ts`, parts aborted, a reload, the same file picked again, only the rest sent. With it, **a part shorter than its share was recorded as received**, which the resume would then have skipped for ever: it is refused (400) and not counted. Row: `album-upload.spec.ts`.
- **Review Focus 2 was not pinned, and a failed tile gave no reason.** The reason is kept on the item (`photo.failure`); a clip over the length cap once probed reads "Couldn't be processed: longer than {cap}", other failures stay "Couldn't be processed" (the spec's words). Row: `album-upload.spec.ts`, `clip-long.mp4` asked for without a length under a one-minute cap.
- **A video refused at the ask for its size named the photo cap** (the host had lowered Largest video under what the page knew). The refusal now carries the cap applied (`max`, bytes or milliseconds) and the line names it; "Add up to ten photos or videos at a time" when videos are allowed. Row: `album-video.spec.ts`.

Docs: the Storage subsection (uploads in progress, the idle hour), the video paragraph (what fails at once, the tries, the crash), the Largest photo memory note; the upgrade note and the release note count eight migrations.
