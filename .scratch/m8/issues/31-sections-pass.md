# 31: Sections: the arranged page is proven in three languages, by keyboard, still and fast, and 0.8.0 has its release note

**What to build:** The pass that ends the Sections part and the milestone. Every state the Sections tickets made is checked in each layout: axe, the keyboard, reduced motion and Traditional and Simplified Chinese. The Lighthouse budget is run again on event pages with an arranged page among them. The docs say how a host arranges a page and how a later feature brings a section of its own through the registry. The README shows the Arrange sheet. The 0.8.0 release note is completed over all four parts with every migration listed, and the glossary proposals of the whole milestone are collected for the maintainer. The full browser suite runs on the test profile. Ticket 30 is not needed: where it has landed, its states are already proven by its own rows and the release note names the styles; where it has not, nothing here waits for it.

**Blocked by:** 24, 25, 26, 27, 28, 29; the release note also takes the sections the passes 09, 16 and 23 wrote

**Status:** done

**Stories:** 302, 303, 304, 305, 306, 307, 308, 309, 310

**Interfaces**
- Consumes: `e2e/sections.spec.ts` and its helpers `openArrange`, `arrange`, `sectionOrder`, `setGuestList` (tickets 25, 26); `expectNoSeriousViolations` (`e2e/axe.ts:22`), `expectStill` (`e2e/still.ts:7`), `tabTo` and `expectVisibleFocus` (`e2e/focus.ts:7,34`); `perf/event-page.perf.ts` and its cases (`:43-45`); `scripts/screenshots.ts` (`pnpm screenshots`); `REGISTRY`, `SectionDrawing`, `DRAWINGS` (tickets 24, 25); `docs/adr/0008-features-are-modules.md` (ticket 01); `.scratch/m8/release-note-0.8.0.md` and `docs/operator/upgrade-backup.md`'s "Upgrading to 0.8" (tickets 09, 23).
- Produces: new rows in existing specs; one new case in `perf/event-page.perf.ts`; `docs/contributing/sections.md`; `docs/screenshots/arrange.webp`; the docs and notes below. No new code path: a fix this pass needs is the smallest change in the file of the ticket that owns it, with a row that fails without it.

- [x] Chinese: read in both scripts every string tickets 25 to 29 added (`Design.sheets.arrange`, `Editor.arrange.*`, `EventPage.sections.*`, and ticket 30's `Editor.arrange.styles` and `EventPage.album.strip` if it landed) against the English and the glossary proposals (Section, Note, Links); a section is 版块 or 部分, chosen once and used everywhere; fix what is wrong; list in Comments the strings you are least sure of, with why.
- [x] Accessibility, `e2e/accessibility.spec.ts` (both widths): for each layout, a guest page arranged with Album above Comments, Comments renamed and collapsed (closed, then open), Countdown on, a Note with a link and a Links section of two: `expectNoSeriousViolations` each; the editor with the Arrange sheet open on a row with every field (Who's coming: switch, audience, heading, Collapsed), the "Add a section" group, the Note sheet and the Links sheet.
- [x] Keyboard, `e2e/keyboard.spec.ts`: the whole of Arrange without a pointer: Arrange from the toolbar, "Move Album up" by Enter with the focus staying and the live line read, Schedule's switch by Space, Comments' row opened, a heading typed, Collapsed by Space, "Dress code" added, words typed in the Note sheet, Escape back to the row that opened it, Escape to the toolbar's Arrange; on the guest page, a collapsed section's summary by Enter and by Space, and each link of a Links section reached by Tab with `expectVisibleFocus`.
- [x] Reduced motion, `e2e/reduced-motion.spec.ts`: an arranged Poster, Broadsheet and Thread with a collapsed section opened and Countdown on, `expectStill` on each; the editor with the Arrange sheet open and a row moved.
- [x] Locales, `e2e/locales.spec.ts`: a zh-Hant host reads Arrange's row names, Move buttons and "Add a section" in Traditional Chinese; a zh-Hans guest reads a collapsed section's count phrase and a Links section's "(opens in a new tab)" in Simplified Chinese.
- [x] Lighthouse: `perf/event-page.perf.ts` gains "Arranged Poster: Countdown, a Note, Links and the album collapsed"; `pnpm perf` (not CI) runs every case; each median is 90 or more, and every case's median goes in Comments beside the 0.7 figures. A case under 90 is fixed here or, if the cause is outside the Sections part, named for the maintainer.
- [x] Docs. `docs/contributing/sections.md`: what a section is; the two halves of the registry (`REGISTRY` in `src/sections/registry.ts` for what the Arrange sheet offers, a `SectionDrawing` in `src/themes/sections/` registered in `DRAWINGS` for what the page loads and draws); how a later module adds a kind, its key, its messages, its default heading per layout and a row in `defaultOrder`; why a switch that changes what the server accepts is a column; the limits. `docs/adr/0008-features-are-modules.md`: a dated paragraph under Consequences naming the registry's two halves and why (a client sheet must not bundle server loaders). `docs/operator/upgrade-backup.md`, "Upgrading to 0.8": the sections' migration (`event.sections`, `event.album_enabled`); an event never arranged looks exactly as before; "Who can see the guest list" and Comments moved from Settings to Arrange, Only the hosts now being Who's coming off. `README.md`, "What it does": a host orders the page's sections, switches them off, renames and collapses them, and adds a countdown, notes and links.
- [x] Screenshots: `scripts/screenshots.ts` gains `arrange.webp` (a phone, the editor with the Arrange sheet open on a row, the live copy above it); `pnpm screenshots`; `README.md` shows it with an alt text that says what is on screen.
- [x] Release note, `.scratch/m8/release-note-0.8.0.md`: a section "A page the host arranges" (the Arrange sheet; order, switches, renaming, collapsing; Countdown, Notes, Links and their safety; the display styles only if ticket 30 is done; an event never arranged unchanged; comments, the guest list and the album switched in Arrange, and posting refused when off); a section "Features" for ticket 01's switches, if no pass wrote one; under Upgrading, every migration of the milestone by number and name, read from `drizzle/` and `drizzle/meta/_journal.json`, with what each adds; the four parts read through once as one note, in the shape of `.scratch/m7-album/release-note-0.7.0.md`.
- [x] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`; `df -h /` and `sg docker -c 'docker builder prune -f'` first if under 15 GB free; `app` built alone, then the test profile up; `CI=1 pnpm exec playwright test --workers=2` over every project; results per project in Comments, each failure or flake named with its spec and whether it is this branch's. Comments entry with the glossary proposals below and the follow-ups; commit `Sections: the arranged page proven in three languages, by keyboard, still and fast`.

## Notes for the implementer

- Glossary proposals to collect in Comments, for the maintainer's `CONTEXT.md` (not edited here), with the words the code settled: **Section**: one part of an event page below the poster, which the host places; _Avoid_: block, module, widget. **Note**, **Links**: the sections a host writes. Then copy, unchanged, the proposals the earlier passes recorded (Size, Live photo, Caption from 09; Album vote, Award, Tie-break from 16; Backdrop from 23), so the maintainer reads one list.
- Anything tickets 24 to 30 left as a follow-up in their Comments is listed for the maintainer, not fixed silently; so are the plan rulings of this part, one line each.
- The full suite takes over an hour and a half; `perf` is separate and slower. Never kill `next-server` by name.

## Comments

**2026-11-16, implementing session (Opus 5.5).** The pass that ends the Sections part and M8. New
rows in existing specs, one new perf case, the docs, `arrange.webp`, the completed 0.8.0 release
note; the carried items below; and three faults the new rows found, each fixed in the file that
owns it with the row that failed without it.

**Faults the new rows found, and fixed.**
- **The Note's text could not be reached by Tab** (`description-editor.tsx`). In the Note's sheet
  the editable area is the last stop, and Radix's focus trap counts only elements whose `tabIndex`
  says they are in the order; a `contenteditable` without one reads -1, so Tab from Bullet list
  went back to the sheet's Close and never into the text. It now says `tabIndex={0}`. (The About
  sheet was not affected: its Done comes after the text.) RED: the keyboard row, "never reached
  getByRole('dialog', { name: 'Dress code' }).getByRole('textbox', { name: 'Note' })", at both
  widths, with the focus cycling Close, Bold, Italic, Add a link, Bullet list.
- **After a Note's or Links' sheet, closing Arrange left the focus nowhere** (`sheet.tsx`). Each
  sheet gave the focus back to what had it as it opened, which for Arrange reopened after a Note
  was nothing (the Note's sheet, gone). A sheet opened with the focus in a sheet, or nowhere, now
  takes the opener of the sheet it follows (`chainOpener`), and a sheet closing while another is
  open leaves the focus there (it used to pull it to its opener, under the new sheet's trap), so
  Escape from Arrange at the end of the chain lands on the toolbar's Arrange. RED: the keyboard
  row, `toBeFocused` on the toolbar's Arrange, "inactive", at both widths.
- The two Chinese strings below.

**Chinese.** Every string tickets 25 to 30 added (`Design.sheets.arrange`, the 81 keys under
`Editor.arrange.*`, the 10 under `EventPage.sections.*` and `EventPage.album.strip`, 93 in all,
ticket 30's `Editor.arrange.style` and `styles.*` among them) read in both scripts against the English and the
glossary proposals. A section is **板块** in zh-Hans and **區塊** in zh-Hant, each used for every
"section" in its file (9 strings each; the one 部分 in each file is "some of" the site's features,
not a section). Fixed: `Editor.arrange.heading` was 标题 / 標題, the same word as the event's Title
sheet beside it in the toolbar, so a screen reader heard "Title" for a section's heading; it is now
板块标题 / 區塊標題. `Editor.arrange.collapsedHint` said 轻点 / 輕點 where the sheet's other two tap
hints say 点按 / 點一下; it now says those. Least sure, with why:
- `Design.sheets.arrange` 排列 (both): "arrange, put in order", plain, but also the word for a
  permutation; 排版 would be "lay out", which the Theme sheet's Layout already is (版式).
- `Editor.arrange.collapsed` 折叠 / 摺疊 for the switch "Collapsed": the verb ("fold"), as switches
  in Chinese interfaces are usually named; 已折叠 would be the state.
- `EventPage.sections.note` and `kinds.note` 备注 / 備註: "remark, annotation", what a host adds;
  说明 / 說明 is the caption's word (ticket 09), so it was not reused.
- `EventPage.sections.countdown` 倒计时 / 倒數: zh-Hant 倒數 alone is natural in Taiwan; 倒數計時
  is fuller.
- `styles.strip` 横排 / 橫排 ("in a row") and `styles.mosaic` 拼贴 / 拼貼 ("collage"): neither is a
  fixed term for a layout of thumbnails.
- `moveUp` / `moveDown` "将{name}上移" with a host's Latin heading reads 将Dress code上移, with no
  space between the scripts; the album's strings keep one before 的, these do not.
- `count.comments` =0 还没有 / 還沒有 ("none yet") reads well after the heading, a little bare alone.

**Rows added** (each passed at both widths on the rebuilt profile):
- `accessibility.spec.ts`: per layout, "the {layout} arranged in every way, its renamed Comments
  collapsed and then opened" (the Album above the Comments, the Comments renamed "Guestbook" and
  collapsed, the Countdown on, a Dress code note whose last words are a link, a Registry of two
  links; a guest who replied on the Poster before the layout was chosen; two axe reads: folded,
  opened); "the editor's Arrange sheet open on Who's coming, with every field, and Add a section"
  (switch, Who sees it, Heading, Collapsed, Style, the Add a section region; one read); "the
  editor's Note sheet and Links sheet, each written in" (two reads). The arranged page is built by
  `arrangeWholePage(page, collapse)` in `e2e/events.ts`, which also holds `openRow` now (moved from
  `sections.spec.ts`) and `NOTE_LINK`.
- `keyboard.spec.ts`: "a host arranges the whole page by keyboard alone, and a guest opens a folded
  section and reaches each link": Arrange from the toolbar, Schedule's switch by Space, "Move Album
  up" by Enter (the focus stays, the live line says "Album, 6 of 9"), the Comments' row opened, its
  heading typed, Collapsed by Space, "Dress code" added, words typed in the Note's sheet, Escape back
  to Arrange with the note's row open, Escape to the toolbar's Arrange; the guest's folded Guestbook
  by Enter, Enter and Space, and each of the Registry's two links by Tab, every stop ringed. Its
  Registry and the guest's reply are made first by the usual helpers, as the other Arrange rows make
  their schedules.
- `reduced-motion.spec.ts`: "under reduced motion an arranged page is still, in the Poster, the
  Broadsheet and the Thread, and so is Arrange as a row moves" (the Guestbook opened and the
  Countdown on in each; then the editor, Arrange open, the Countdown moved down).
- `locales.spec.ts`: "a zh-TW host reads Arrange in Traditional Chinese, and a zh-CN guest reads an
  arranged page in Simplified Chinese" (the rows 專屬信件 … 倒數 and the host's own "Registry",
  將相簿上移 and 將相簿下移, the region 新增區塊 with 服裝要求 and 歌單; the folded 日程's "1 项" and
  the link's name ending （在新标签页中打开）).
- `perf/event-page.perf.ts`: "Arranged Poster: Countdown, a Note, Links and the album collapsed"
  (`arrangeWholePage(page, "Album")`).

**Carried from earlier reviews.**
1. **The flake `comments.spec.ts:118`.** Cause not found. Read: the test's `reply` (goto, Going,
   name, Send RSVP, 15 s for "You’re going!"), `rsvp-flow.tsx`, `use-rsvp-flow.ts`,
   `saveRsvpAction`, `notifyHostsOfRsvp`, `src/proxy.ts` and the page's `redrawAllowed`. Ruled out:
   a press before hydration (the name field and Send RSVP exist only once the page has hydrated, so
   a lost Going would have timed out at the field, not at the confirmation, and `goto` waits for
   `load`, which waits for the app's async scripts); the rate limits (the host's context shares the
   test's own address through Playwright's default context options, and the test makes about nine
   event-page requests, against 40 a minute; RSVP is 5 a minute and it replies once); Turnstile
   (not on `app`); a refresh of the page racing the action (nothing on that page polls: no
   schedule, no processing item); a Send RSVP press lost to a moving sheet (Playwright waits for
   the button to be stable and checks the hit target). What is left is the action's answer itself,
   which redraws the whole event page and revalidates its paths, taking more than 15 s under two
   workers' load, once; nothing here would make it so, and no sleep or retry was added. Repeated
   on the rebuilt profile, `--repeat-each=20 --workers=2 --retries=0`, mobile and desktop: 40 of 40
   passed (5.0 min), and it passed again in the full run below.
2. **The verification banner at 390px** (`verification-banner.tsx`). The Resend form is out of the
   alert's corner: below the words at a phone's width, a column of its own beside them from `sm`
   (`max-w-56`, so what Resend says wraps there). New row in `host-accounts.spec.ts`, "the
   verification banner's Resend sits clear of its words in every language, before and after it is
   pressed": in English, then zh-Hans and zh-Hant through the footer's switcher, no box the action
   draws (the button, and the "sent" line once pressed) meets the title's or the words' box. RED
   against the build before: "108px at 258" (mobile) and "108px at 1020" (desktop) over both. The
   pixel row in `site-look.spec.ts` no longer hides the button, and reads the title, the words and
   Resend before and after it is pressed, and the "Sent. Check your inbox." line.
3. **`e2e/site-look.ts`.** (a) The footer draws its links and languages on pills of the veil
   (`bg-theme-veil`, `backdrop-blur-xl`), with the footer round them bare. Those pills now carry
   `data-slot="veil"` (`page-footer.tsx`; the language form through a `slot` prop of
   `LocaleSwitcher`), and `page-footer` is no longer a surface in `BARE_CONTROLS`. RED against the
   build before: every `expectSiteLook` page listed the footer's Privacy policy, Terms of use and
   the three languages as bare. (b) The bare-controls read is `expect.poll`ed, after the "what
   moves" poll, so it reads the page once it is still and again until none is bare. A poll
   that finds none at once passes at once, so a control drawn later than the poll still goes
   unread; reading after stillness narrows that, and is said in the comment.
4. **`dbless-pages.test.ts`** follows `import("…")` (`DYNAMIC`, through `importsOf`), and leaves
   `typeof import("…")` out. RED: "importsOf is not defined"; then 7 of 7. The four pages still
   reach nothing that reads the database.
5. Ticket 23's Comments has the dated line on the hovered default `Button` in the site scope.
6. **A just-added row's disclosure and switch look unavailable** (`arrange-sheet.tsx`):
   `aria-disabled:opacity-40` and `cursor-default` on both, as the Move button. "a section just
   added waits for its add" also asserts the disclosure's `aria-disabled` and an opacity under 0.5
   on Move up, the disclosure and the switch. RED: the disclosure's opacity was 1.
7. **The mosaic's first picture fills its two rows** (`album.tsx`): the first tile is `big`, its
   picture's wrapper grows in the tile and the picture is `h-full` (its square is still what it
   gives the rows, so a mosaic of one is still square). New row "the mosaic's first picture fills
   its two rows beside waiting items" (a host's photo first, two of a guest's waiting with approval
   on, read on the host's page): the first picture's foot within 2px of the third tile's. RED:
   152 px (mobile) and 120 px (desktop) apart.
8. **A caption line only under a tile that opens** (`album.tsx`, `openable(photo)`), so none sits
   `aria-hidden` under a processing or failed video. No row: a video held in processing with a
   caption needs a held job of the kind `holdMotionPending` makes for motion, which is not cheap;
   by reading.

**For the maintainer** (follow-ups of tickets 24 to 30, the controller's deferred ones, and this
pass's; none fixed here):
- A host cannot rename a section while it is switched off (a row opens only while on, ticket 28's
  ruling; Notes and Links excepted).
- The server counts a link address's limit in UTF-16 units of the normalised address, while the
  editor's field cuts at 2,000 characters typed: an address of many non-BMP characters, or one that
  grows when normalised, can pass the field and be refused as too long.
- No test of a refused arrangement save's rollback (the optimistic list and switches put back).
- Print is unproven on the glass pages.
- Ticket 25: the editor's accessibility tests were slow for axe at two workers (split one sheet a
  test since). Ticket 26: `album-voting.spec.ts:122` timed out once on desktop under load (since
  split by ticket 23's fix pass). Ticket 28: the `comments.spec.ts:118` flake (above).
- Lighthouse (below): the uploaded photo (86 / 84) and the portrait poster (84 / 86) under 90, with
  "Improve image delivery" first for the host's picture; the Broadsheet at 89 in Simplified
  Chinese.
- No Lighthouse figures were recorded for 0.7 (M7 ran none, nor did M4 to M6); the last are M3
  ticket 11's, for cases since renamed, given beside this run's below.
- The caption line drawn only under a tile that opens (carried item 8, `openable(photo)` in
  `album.tsx`) is proven by reading only: no browser test holds a captioned video in processing.
- The plan's rulings of this part, one line each: 34, the registry is two halves (`REGISTRY`
  client-safe, the drawings on the server); 35, a move names the neighbour the sheet shows; 36,
  only the Poster was drawn from the list in ticket 25; 37, every Poster heading carries its
  kind's icon; 38, the Thread's entrance stagger counts sections; 39, the Countdown switched on
  while last moves to just after Details; 40, a link with no label shows its site's name, and an
  address without a scheme is saved with `https://`; 41, the first style of each kind is today's
  drawing.

**Glossary proposals** for `CONTEXT.md` (not edited), with the words the code settled, then the
earlier passes' proposals unchanged:
- **Section**: one part of an event page below the poster, which the host places. _Avoid_: block,
  module, widget. In code `Section`, `SectionKind`, `REGISTRY`, `SectionDrawing`, `BY_KIND`; zh
  板块 / 區塊.
- **Note**, **Links**: the sections a host writes: a Note in the About editor, under a heading of
  their own; Links, up to six buttons to addresses they give, each opening in a new tab. zh 备注 /
  備註, 链接 / 連結.
- **Size** (09): one of the forms a video plays at: its original, or a copy at 4K, 1080p or 720p,
  named by its short side. The player's **Auto** picks one for the screen and connection. _Avoid_:
  quality, resolution, rendition. In code `VideoSize`, `EventSize`, `SizePick`, `videoSizes`,
  `missingSizes`; zh 尺寸.
- **Live photo** (09): a photo that keeps a few seconds of motion, made from the clip an Android
  motion photo carries; it plays while held or from its Live mark, never by itself, and is a photo
  everywhere else. _Avoid_: motion photo (the phone's file it comes from), animated photo. In code
  `live`, `motionKey`, `LivePicture`; zh 实况照片 / 原況照片.
- **Caption** (09): the plain-text line, up to 140 characters, that whoever added an album item, or
  a host, gives it; shown under the item in the viewer and part of its name. _Avoid_: title,
  description, comment. In code `caption`, `parseCaption`, `mayCaption`, `setCaptionAction`; zh 说明
  / 說明.
- **Album vote** (16): a vote the hosts run on an event's album, in one or more awards, in which each
  person who may vote has one vote per award; started, closed, reopened and turned off from the
  Voting block. Not the date poll, whose "vote" and "voter" keep their own meaning. 相册投票 /
  相簿投票.
- **Award** (16): one thing the album vote asks (Favourite, Best video), named by the host, for
  photos, videos or both; at most eight an event. Its results are its places and, for the first
  three, ribbons and the Winners strip. 奖项 / 獎項.
- **Tie-break** (16): another round of one award's vote, among the items sharing its first place,
  started and closed by the hosts once voting has closed, with its counts hidden from guests until
  it closes; a further round is "another round", and the hosts may instead keep first place
  shared. 决胜投票 / 決勝投票.
- **Backdrop** (23): what fills a page that is not an event page: a poster's blurred copy, still.
  The glossary's Background stays the event page's.

**Docs.** `docs/contributing/sections.md` (new): what a section is, the arrangement's rules, the
registry's two halves (`REGISTRY`; a `SectionDrawing` in `BY_KIND`, with `DRAWN_KINDS`,
`loadSections` and `readySections`), the editor's `previewSections`/`previewedSections`, how a later
module adds a kind (its `Section` member, `builtIn`, `POSTER_ORDER`/`BROADSHEET_ORDER` read by
`defaultOrder`, its registry entry, drawing, messages, preview and tests), why the four switches are
columns, and `SECTION_LIMITS`. ADR-0008: a dated paragraph under Consequences on the two halves.
`upgrade-backup.md`, "Upgrading to 0.8": eleven migrations to `0064`, and a bullet on
`event.sections` and `event.album_enabled`, an unarranged page unchanged, and the guest list's
"who sees it" and Comments moved to Arrange with "Only the hosts" as Who's coming off. README: the
toolbar's Arrange, a sentence in "Event pages worth opening", and `arrange.webp` in the second row.

**Screenshots.** `scripts/screenshots.ts` takes `arrange.webp` on the phone after `poster-sheet`:
Arrange over the live copy, the Album's row open, the sheet scrolled to the Comments row above it
(only the sheet's own scroller; Playwright's press had scrolled the sheet itself and hidden its
heading, which is put back). `pnpm screenshots` ran on port 3000 (53 s). Committed: `arrange.webp`
(new, 41 kB), and `editor.webp` and `editor-desktop.webp`, whose toolbar now shows Arrange (the
README's alt for `editor.webp` says so). The other nine it rewrote were put back.

**Release note.** `.scratch/m8/release-note-0.8.0.md` read through as one note in 0.7's shape:
"Sizes, live photos and captions" (new, the media part), "Voting in the album", "Poster and glass on
every page", "A page the host arranges" (new: the Arrange sheet, order, switches, renaming,
collapsing; the Countdown, Notes and Links and their safety; the styles; one switch for each, with
posting and uploads refused when off; an unarranged page unchanged), "Features" (new, ticket 01's
switches, which no pass had written), "Also", "Upgrading" (every migration `0054` to `0064` by
number and name, read from `drizzle/` and the journal, with what each adds; the worker; what
starts from now), "Left out, and why".

**Evidence.**
- `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 123 files, 1,494 tests.
- RED, against the profile built from 7cd00b4 (`--retries=0`, mobile and desktop): 10 failed, 15
  passed: the banner rows, the mosaic row, the waiting row and the site-look banner row at both
  widths (above), and the keyboard row (the Note's text). The new accessibility, reduced-motion and
  locales rows passed there, as they read what tickets 25 to 30 built.
- GREEN, the profile rebuilt with the change: the same 25 passed but the keyboard row, which then
  failed on the toolbar's focus (above); rebuilt again with `sheet.tsx`: `keyboard`,
  `desktop-editor` and `design` at both widths 61 passed, 2 skipped and the keyboard row failed at
  its start, the focus already being on the toolbar's Arrange after its setup (now correct); with
  the row starting from a reloaded page, 3 of 3 (with the operator setup).
- The full suite on the rebuilt profile, `CI=1 pnpm exec playwright test --workers=2` over every
  project (one command, 2.6 h): **1,169 passed, 2 skipped, none flaky, none failed**. Per project:
  operator 1; mobile 552 (the 2 skipped, the desktop-only tests, as always); desktop 552;
  fresh-instance 15; limits-instance 12; retention-instance 5; album-reminder-instance 5;
  home-instance 19; worker-instance 1; features-instance 7; sizes-instance 2. Neither the known
  `instance-settings.spec.ts:69` nor `comments.spec.ts:118` recurred.
- `pnpm perf` (not CI; `sg docker`, with `TMPDIR` off the small `/tmp` for Lighthouse's Chromium
  profiles), right after the suite with nothing else running, 9.3 min: 5 cases passed, 3 failed on
  a median under 90. Medians (runs), English then Simplified Chinese, with the last recorded
  figures beside them (M3 ticket 11; M7 recorded none, and M4 renamed the cases):
  - Colour poster with sparkles: **92** (88, 93, 92) and **91** (93, 88, 91); M3 "Birthday with
    sparkles, Sheet" 91 / 91.
  - Gallery poster: **90** (89, 90, 91) and **92** (73, 92, 93); new since M3.
  - Uploaded photo: **86** (82, 86, 86) and **84** (88, 81, 84); M3 94 / 93.
  - Portrait poster: **84** (84, 80, 88) and **86** (86, 84, 87); M3 93 / 90.
  - Gallery poster, Broadsheet layout: **91** (91, 93, 90) and **89** (91, 89, 87); M3 "Supper
    club, Broadsheet" 95 / 96.
  - Gallery poster, Thread layout: **92** (92, 93, 80) and **92** (93, 91, 92); M3 "Kids' party,
    Thread" 95 / 93.
  - **Arranged Poster: Countdown, a Note, Links and the album collapsed** (new): **90** (90, 93, 90)
    and **93** (93, 90, 94); LCP the title, 3.12 s and 3.07 s, CLS 0.
  The three under 90 are pages never arranged, which draw as before. The uploaded photo and the
  portrait poster have the host's picture as their largest paint (LCP 3.77 to 3.92 s, where the
  others are 3.1 to 3.2 s), and Lighthouse's first opportunity for both is "Improve image delivery"
  (116 and 120 KiB, 600 to 800 ms of LCP): the upload's poster rendition, so the cause is probably
  outside the Sections part, which M8 changed only in comments (`src/uploads/renditions.ts`,
  `process.ts`). Probably, not proven: what would settle it is the same two picture cases, the
  uploaded photo and the portrait poster, run against v0.7.0 on this machine. Named for the
  maintainer, not fixed. The Broadsheet's 89 in Simplified Chinese is one point under, with
  runs 87 to 91 and 91 in English, TBT 245 ms; within this machine's spread, and the arranged
  Poster passes, but without a 0.7 baseline run on this machine I cannot say the Sections part
  costs nothing there. Named too.
- Disk: 31 GB free at the start, 30 GB after the three rebuilds; no prune needed.

**2026-11-16, Sections part review fixes (Opus 5.5).** The one fix pass after ticket 31's task
review and the review of the whole part (`part-sections-review.md`, findings 1 to 10 and its test
gaps), in one commit. What changed, and where it differs from the Comments of tickets 24 to 31
above:

- **A hidden guest list stays hidden.** `refusedBySwitches(switches, change)` (`@/sections`) refuses
  an `audience` change with `notOffered` while `guestListVisibility` is `hidden`, and
  `changeEventArrangement` asks it under the row lock before the change is applied. Ticket 24's
  `switchesAfter` still sets the visibility for an `audience` change; it is no longer reached while
  the list is off, so a stale sheet's "Everyone with the link" reads "That section can’t be changed
  that way." and switches nothing on.
- **Focus after a sheet closes** (`sheet.tsx`). Ticket 31's `chainOpener` is now cleared where a
  chain ends (a close with no other sheet open), so a sheet opened later with nothing focused
  (Safari, which focuses no button it clicks) has no opener and moves the focus nowhere, as before
  this part. A sheet opened with the focus nowhere *while a chain is open* still takes the chain's
  opener: closing a Note's sheet back to Arrange removes the Note's sheet, focus and all, before
  Arrange's opens (Radix mounts a portal's content a render later), so "only when the focus is in a
  sheet" would leave the end of that chain with no opener, the fault ticket 31 fixed. An opener that
  has gone (the Album's placeholder once the Album is off) gives the focus to the toolbar's button
  for the sheet, read as it opened (`[data-slot="editor-toolbar"] [aria-expanded="true"]`; the
  toolbar's `nav` carries the slot now). A sheet with no toolbar button and a gone opener (a Note's)
  still leaves the focus where Radix puts it.
- **The Links sheet.** As an address field is left, its row is checked by `safeLinkUrl`; a row the
  server would refuse is `aria-invalid`, says why under its field (`aria-describedby`), and is left
  out of what is sent, so the other rows save and a reopened sheet shows them. The alert above the
  list now shows only what the server refuses (a list posted by hand). Ticket 29's "the server
  refuses the whole list over one" is still the server's rule; the sheet no longer sends such a
  list. `Editor.arrange.errors.urlInvalid` says what to type ("That isn’t a web address. Try
  example.com/registry."). Any refused address gets this message, including one made too long by
  the `https://` the server adds (`urlTooLong`), since the sheet asks `safeLinkUrl` alone. A row
  with a label and no address is still not sent (for the maintainer).
- **A refusal in Arrange stays until the next press.** `send` clears the sheet's error at each
  press and sets it when its own save comes back unsaved, a refusal's words or, for a save that
  threw, `Editor.failed`; another change's success no longer clears it. The top bar
  (`status.tsx`, unchanged in behaviour) still shows the last save's outcome.
- **The registry is the door.** `REGISTRY[kind].feature` is a `FeatureId` and is what leaves a
  section out: `kindOffered(kind, offered)` for `sheetRows` and `previewedSections`, which take
  `OfferedFeatures` (`Partial<Record<FeatureId, boolean>>`, a feature not named is off), and
  `sectionFeature(key)` for `arrangeAction`; the three `"album"` comparisons are gone. The functions
  read `REGISTRY` itself and take none, so no unit case adds a made-up feature-bound kind; the cases
  added pin `{}` as offering no album, and `sectionFeature` by key. `PREVIEWS` is a record over the
  built-in kinds but Details, `COUNTS` over every kind (`satisfies`), and `previewedSections`' list
  a `Record<BuiltInKind, boolean>`, so a kind missing from any does not compile. `@/sections`
  (`index.ts`) names its exports: what is imported from outside, plus `OfferedFeatures`;
  `defaultOrder` and `SectionEntry` are no longer in it. `wide`'s comment says only the Thread reads
  it. `sections.md` names the steps a kind takes beyond the two halves, the five for a switch that
  is a column, and the ruling that what is stored wins across a layout change.
- **Smaller.** A Move past a neighbour still waiting for its add is an end (and its button says so,
  as at the list's ends). Add a section lands after `openRow` only when that row opens. The Note's
  sheet says "Up to 2,000 characters." under the editor (`Editor.arrange.noteHint`, from
  `SECTION_LIMITS.note`; the editor's `DescriptionEditor` takes `hint`, and its text area is now
  described by its hint, the About sheet's too). `safeHref` drops an address over `MAX_HREF`
  (2,000, `src/rich-text`; `SECTION_LIMITS.url` is now that constant), so a Note's or a
  description's link is bounded, posted or stored: a stored long one loses its link and keeps its
  words. Words: `headingTooLong` 板块标题 / 區塊標題; `tooManySections` and `full` "A page holds up
  to 10 Notes and Links sections."; `collapsedHint` "Guests see its heading, and open it with a
  tap." (宾客会看到板块标题，点按即可展开。/ 賓客會看到區塊標題，點一下即可展開。). The release note and
  the upgrade note say an unarranged page "keeps its order and everything on it" and the release
  note lists the drawn differences; "each opening Arrange at its own row" and "the caption and the
  vote" are made true. `e2e/site-look.ts` reads the bare controls once, after the set of visible
  controls has stopped changing. The Lighthouse paragraph above says "probably" and names the
  check; the caption-only-on-an-openable-tile item is listed for the maintainer.
- **Tests added** (`sections.spec.ts` unless said): a stale sheet's "Everyone with the link" while
  Who's coming is off; a refused move put back and said until the next press; a refused address
  marked while the other links save; Add a section from the Letter's placeholder; a Note switched
  off and on; a collapsed, locked Who's coming in avatars in each layout; Thread to Poster keeps
  what was stored; a Note past 2,000 characters; two windows moving from stale sheets (the same
  host in a second browser context, not a co-host); in `keyboard.spec.ts`, a sheet opened with
  nothing focused, and a sheet whose opener has gone. "Links to a registry and a playlist" now
  expects the refused row marked rather than the alert, and its Remove sends nothing. Unit:
  `refusedBySwitches`, `sectionFeature`, garbage stored values, a Note's and a description's long
  `href`, and `{}` as offering no album.
- The maintainer's item above, "No test of a refused arrangement save's rollback", is covered now by
  the refused-move test.

Evidence: `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 123 files, 1,501 tests. RED first:
unit (`refusedBySwitches` and `sectionFeature` not functions; three long-`href` cases kept the
link); browser against the profile as ticket 31 left it (desktop, `--retries=0`): the stale
audience (no alert, the server took it), the refused move (alert cleared by the next success),
the refused address and the `javascript:` row (no `aria-invalid`), the Letter's placeholder (the
Note landed after the Letter), the Note's limit (no description), both keyboard rows (the When row
focused; nothing on the toolbar's Arrange), and the reworded strings. Passing before as after, as
pins: the Note switched off, the locked avatars, Thread to Poster, two windows, the garbage
values. On the profile rebuilt with the change (`CI=1`, `--workers=2`, mobile and desktop, one
command at a time, each with the operator setup): sections 111, keyboard 53, accessibility 133,
locales 51, site-look 67, host-accounts 31, guest-list 17, description 9, duplicate 7, thread 15,
broadsheet 15 passed; features (`features-instance`, `--no-deps`) 7 passed. None flaky, none failed.
Disk: 29 GB free before the one rebuild, 28 GB after; no prune.

### 2026-11-16: Whole-branch review fixes

The review of the whole branch at 418bb01 (one Important, six Minor) and five items from the
re-review of the sections fix pass (d36142a), in one commit on top of that pass, which it keeps.

- **A. A lens is not shown beside a hidden name** (Important). Revises ticket 12's ruling that the
  exposure stays where the uploader's name is hidden: `shownDetails` now keeps only the shutter and
  the ISO there, and leaves the aperture and the focal length out on the server with the camera,
  since they are one phone's lens constants or name a camera's lens. The host, and any viewer shown
  the name, still gets all four. `configuration.md` and the release note say so. Left for the
  maintainer: the picture's size as added (4032 × 3024 against 4080 × 3072) still tells phone
  makes apart beside a hidden name.
- **B. The Voting block knows the Album is switched off in Arrange.** Revises tickets 14 and 16,
  which wrote the drafts and drew the block by the operator's switch alone: a new pure rule,
  `draftWritten`, writes neither draft while the event's album is off, and the block, told by
  `VotingSettings` from the event the page passes (`albumOff`), says "The album is switched off in
  Arrange." where it said `notYet`, gives that reason for a refused Start or Reopen, and drops
  "Tell guests voting is open". Three locales (`Voting.block.albumOff`). The voting module imports
  nothing new.
- **C. A stale Settings sheet does not switch videos off.** Revises ticket 01's rule that the
  groups kept are those the site has off when the save arrives: the sheet now names the groups it
  drew in one hidden field, `drawnGroups` ("album videos", "album" or empty), and `keptSettings`
  takes a group as posted only where the sheet drew it and the site has it on. A post naming none
  keeps every album field as stored. No browser test: `features.spec.ts` rewrites an Arrange post,
  not the Settings form, and has no second operator window for a stale sheet.
- **D. Stored copies and a live photo's motion carry no tag.** No code change: the assertion
  passes. Two fixtures were needed, as `clip-tagged.mov` (640×480 H.264) gets no copy at all:
  `clip-hevc-tagged.mov` (the 1080p HEVC clip with the iPhone tags and a location) and
  `motion-photo-tagged.jpg` (the motion photo made again with its clip tagged as an Android phone
  tags one), both recorded in `e2e/fixtures/README.md`. `probeServedTags` (`e2e/instances.ts`,
  beside `probeServed`) reads the served 1080p copy (made from the clip as sent), the original, the
  720p copy (made from the stored original) and `motion.mp4`: every tag left is the container's own.
- **E.** `RATE_LIMIT_VOTE` defaults to 600 in ten minutes (was 120), revising ticket 12's default:
  config, its unit test, `configuration.md`, `upgrade-backup.md`, `deploy/.env.example` and the
  release note. The test profile keeps its `10/1m`.
- **F.** The 0.8 upgrade note names enum types (no value added to an existing one), all three
  dropped things, that 0.7 cannot run on a migrated database, and what becomes of a video being
  processed as the app is replaced. `configuration.md`: while the Album is off only the operator can
  remove an item and the files are still answered; a live photo's motion is made under unticked
  Allow videos, and the Videos switch stops it.
- **G.** `export` dropped from 23 of the 25 names the review lists, each used only in its own file and by no test (checked by `git grep`). Kept: `videoWork` (a `pgEnum`
  drizzle-kit reads from the schema's exports) and `EventSize` (used nowhere at all; unexported it
  is an unused-type lint warning, and deleting it is beyond this item).
- **H.1** (re-review) A saved link is never lost to a typo: each row keeps its last accepted
  address, and a refused row is sent with it (left out only when it has none); the field keeps what
  was typed, marked. **H.2** The refusal is said through the sheet's live line as the field is left.
  **H.3** A change that failed on the network and is saved by the top bar's Try again clears the
  Arrange sheet's error, unless the host pressed since (a press counter in `send`); a refusal still
  stays until the next press, as d36142a made it. **H.4** `expectSiteLook` waits for three reads of
  the controls half a second apart to agree (no page marks its hydration, so it is a window, and the
  comment says so). **H.5** The release note says a caption in the grid shows only when an item is
  opened.
- Not in this pass, as ruled: finding 7, the picture size beside a hidden name, Delete while an
  album is off, `CONTEXT.md`, the version, tag, push and CI, the 0.7 migration rehearsal.

Evidence: `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 123 files, 1,507 tests. RED first:
unit (`shownDetails` gave the whole exposure beside a hidden name; `draftWritten` wrote both drafts
with the album off; `keptSettings` took the undrawn groups as posted; the vote's default was 120);
browser on the profile built from d36142a's code with the new tests (desktop): the hidden name's
details held `f/` (A), the block had no "switched off" line (B), the sheet's error stayed after Try
again (H.3), the live line was empty (H.2), and "Our list" was gone from the guest's page after the
typo (H.1, run once with the live-line line held out). D passed there as it does now. On the
profile rebuilt with this change: `album-voting`, `album-upload`, `album-settings`, `sections`,
`keyboard` and `site-look` at desktop, 171 passed; then the whole suite once (`CI=1`,
`--workers=2`, every project), 1,197 passed, 2 skipped (the two mobile skips of
`desktop-editor.spec.ts`, there since 0.5), 2 flaky: `album.spec.ts:129` at both widths, the
host's viewer still open after Escape following an empty caption save, passing on retry; seen
since ticket 11 and in code this pass does not touch. No failure. Disk: 28 GB free before the two
rebuilds, 26 GB after; no prune.

### 2026-11-16: Last fixes

The last fix dispatch, on top of 29b0f4a: the cause of the caption test's flake, the re-review's
five minors, and the rehearsal's corrections to the upgrade document.

- **The flake (`e2e/album.spec.ts:129`, the host's viewer still open after Escape following the
  empty caption save).** Cause: the viewer's Escape handler was one render behind just after a save.
  - Radix calls `onEscapeKeyDown` through `useCallbackRef`, which takes the newest handler in a
    passive effect.
  - A caption's save answers outside any event, so the render that ends the writing commits in a
    default lane, and React 19 runs its passive effects in a later Scheduler task.
  - An Escape in between met the old handler, which still saw `editing` true. It prevented the
    dismissal and ended writing that had already ended.
  - Measured with a stand-in React DevTools hook, the gap was 1.4 to 36 ms on this machine, up to
    62 ms under load and 152 ms with the page's CPU slowed 6×. So a person on a slow phone can meet
    it too.
  - Fix: Escape reads `writing.current`, set from `editing` in a layout effect, which runs inside
    the commit (`src/themes/sections/album.tsx`).
  - New test, "Escape pressed as a caption's save lands closes the viewer": presses Escape the
    instant the field leaves the page, inside the gap by construction. Failed 6/6 on 29b0f4a,
    passes 6/6.
  - The caption test itself, 30 per width, two workers, no retries: 30/30 and 30/30 before (the
    race was not caught in 100 natural runs, under load or slowed either); 30/30 and 30/30 after.
- **Minor 1** and **rehearsal 3.3(a)**: a video being processed as the app is replaced "is taken
  again about ten minutes after the old app took it or last renewed its hold on it, give or take a
  minute".
- **Minor 2**: a links row's address left empty forgets its last accepted one, so a typo after it
  does not bring back the cleared link. New test, "a saved link's address cleared and then
  mistyped does not bring the link back".
- **Minor 3**: the links sheet's live line is emptied and filled on the next tick, so a second
  refusal is heard. The refused-address test asserts the line goes `""` then the message.
- **Minor 4**: `form.test.ts`'s two site-off cases pass `BOTH` as drawn, so the site's switch is
  tested alone; a mutation that ignores it now fails them.
- **Minor 5**: `expectNoPhoneTags` asserts the served bytes hold no `+35.6895+139.6917`.
- **configuration.md**, Album off: deleting the event, or a host deleting their account, still
  removes its items.
- **Rehearsal 3.1**: `upgrade-backup.md` has a new section, Going back to an older release, linked
  from both "go back" sentences. Its steps: stop the app, set the image back, empty the database
  with `dropdb`/`createdb`, `pg_restore` (which must end without "errors ignored on restore"), the
  uploads, and up. Anything added after the backup is lost.
- **Rehearsal 3.2**: the matching-pair backup stops the app and archives the uploads with
  `compose run … --entrypoint tar`, and says to check that neither file is empty.
- **Rehearsal 3.3(b)**: 0.7 on a migrated database looks healthy while every event page fails, so
  changing only the image back is not a way back.

Evidence: in `.superpowers/sdd/m8-plan/last-fix-report.md` (RED and GREEN for each item, the probe
logs and traces under `test-results/`, and every check).

**2026-11-16: Going back checks the backup first.** The re-review of 6005ec1 found that "Going back
to an older release" (`docs/operator/upgrade-backup.md`) emptied the database before anything had
looked at the dump it then loads, so an empty or cut-off dump left an operator with no site at all.
The steps now check both backup files and read the dump with `pg_restore --list` before anything is
removed (tried against a good, an empty and a cut-off dump: exit 0, 1, 1), tell the operator to stop
and stay on the newer release if that fails, and keep a dump of the site as it is so that going back
can be undone. Also: a worker container is stopped with the app for a matching pair of backups;
`pg_restore --clean` "fails part-way", not "stops"; files added to `uploads` after the backup stay in
the volume. Docs only.
