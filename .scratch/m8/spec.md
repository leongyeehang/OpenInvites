# OpenInvites M8: the album's sizes and votes, glass on every page, and a page the host arranges

Written 2026-11-10 (Fable 5.2) from the maintainer's answers of the same day, `CONTEXT.md`, the M4, M6 and M7 specs, the home page and dashboard specs and what they built, and a read of the album, theme, editor and host-area code. Choices the maintainer made are marked **(maintainer, 2026-11-10)**. Where nobody decided, the choice is marked **(decided here)** and the maintainer may overrule it before the ticket that carries it starts.

The earlier specs stay binding for everything they cover. This spec adds to them and changes six things they settled:

1. A video may have more than one lighter copy (M7 listed that as out of scope).
2. HDR clips are converted properly in their copies (M7: "HDR comes out flatter: a known limit").
3. An item may keep some of its upload's details, when the host says so (M7: "the original keeps nothing of the clip's metadata"). The stored files still keep nothing.
4. Album items take votes (M7 listed reactions on items as out of scope).
5. The host area is no longer light only, and the locked and report pages are no longer plain (dashboard spec, "The frame of every signed-in page"; M6).
6. The order of an event page's sections is the host's, not the layout's (M4, "The guest page").

## Problem Statement

With 0.7.0 tagged, the maintainer tried the build and found four gaps:

1. **Plain pages.** The home page and event pages wear a poster, its blur, glass and grain. Sign-in, sign-up, the password screens, Account, Site settings, an event's guests, invites and share pages and every notice page sit on flat white or flat lilac. The site changes character the moment a visitor presses Sign in.
2. **No choice of video size.** The player offers "Lighter copy" and "Original quality", and only when a copy was needed, so an ordinary 1080p clip offers nothing. Nothing names a size. A 4K clip from an iPhone cannot be played at all in some browsers, an HDR clip looks washed out in its copy, and nothing of when or how a picture was taken survives.
3. **No way to pick favourites.** After a party the hosts want guests to choose the best photos and videos. There is no vote, and every item shows who added it, so a vote would go to the person.
4. **A fixed page.** Every event page has the same sections in the same order. A host cannot move the album above the comments, drop a section, or add a note about the dress code or a link to the registry.

Constraints: guests never have accounts; nothing leaves the instance (ADR-0005); files are read and written only through the storage interface (ADR-0003); ffmpeg is the image's one binary (ADR-0007) and no player library is added; the UX bar is Apple Invites and Partiful; text stays readable on every backdrop, proven by `legibility.ts`; CI fails on any flake, so every wait in a browser test is on the page's state.

## Solution

**(maintainer, 2026-11-10)** One milestone, M8, in four parts, built in this order on branch `m8`. Each part ends in a state that could be released.

1. **Album media.** Every video offers Auto, its original under its real size, 1080p and 720p. Auto picks for the viewer's screen and connection and steps down if playback stalls; the player remembers the last pick on the device. The operator may have a 4K copy made that plays in every browser. HDR copies are converted to standard colour and the original wears an HDR badge. The viewer shows a line of technical facts; the host may keep the capture time, the camera and the exposure; whoever adds an item may caption it.
2. **Album voting.** The host starts a vote. Each person has one vote per award; the host names the awards, says who may vote and may set a closing time. Counts and, by default, uploader names stay hidden from guests while voting is open, and each guest sees the album in a different order. Closing shows the winners; a tie for first can go to a tie-break round.
3. **Poster and glass everywhere.** Every page sits on a blurred poster with frosted panels. Each page wears the poster of its own subject, and a host may pick their own for their signed-in pages.
4. **A page the host arranges.** An Arrange sheet in the editor reorders the page's sections, switches them on and off, renames them, collapses them, gives some a display style, and adds Notes, Links and a Countdown.

Implementation is by Opus 5.5 subagents, one ticket at a time, with this session reviewing each part **(maintainer, 2026-11-10)**.

## User Stories

Numbered on from M7's 271.

### Album media

272. As a guest, I want to choose the size a video plays at, by name, so that I get 4K on a big screen and 720p on the train.
273. As a guest, I want Auto to choose for me and to drop a size by itself when the video keeps stalling.
274. As a guest, I want the player to remember my last choice on this device.
275. As a guest with a browser that cannot play an iPhone's 4K, I want to be told, to watch at 1080p, and still to download the 4K file.
276. As a host, I want to choose which sizes my event's videos get, to save space.
277. As the operator, I want to decide whether 4K clips also get a 4K copy every browser plays, knowing what it costs.
278. As the operator, I want videos added before 0.8 to get the new sizes when I ask, without leaving the album while they are made.
279. As a guest, I want an HDR clip's smaller sizes to look natural, and to know which size is the HDR one.
280. As a guest, I want to see a video's size, frame rate, length and file size when I open it.
281. As a host, I want to keep when each photo and video was taken, and to order the album by it.
282. As a host, I want to keep the camera and exposure of each item, for a party of photographers.
283. As a guest, I want my location never to reach other guests, whatever the host keeps.
284. As a guest or host, I want to caption what I add, and to change the caption later.

### Voting

285. As a host, I want to start a vote on the album and close it when enough people have voted.
286. As a host, I want to name awards, each for photos, videos or both.
287. As a host, I want to say who may vote: everyone who sees the album, only guests who are going, or only guests I invited personally.
288. As a host, I want voting to close by itself at a time I set, and guests to see that time.
289. As a host, I want to tell guests that voting is open, and later who won, with a message already written for me.
290. As a host, I want to choose whether guests see who added each item: always, after voting closes, or never.
291. As a host, I want to see the counts while voting is open.
292. As a host, I want a tie for first place settled by another round among the tied items, or left shared, as I choose.
293. As a guest, I want one vote in each award, and to move it while voting is open.
294. As a guest, I want not to see counts or names while I vote, so that I judge the picture.
295. As a guest, I want to see the winners and every count once voting closes.
296. As a guest whose photo is in the vote, I want an early upload to have no advantage over mine.

### Glass

297. As a visitor, I want sign-in and every notice page to look like the invitation that sent me there.
298. As a host, I want my dashboard, my account and each event's pages to wear a poster, and forms to stay easy to read on it.
299. As a host, I want to pick the poster behind my own pages.
300. As the operator, I want Site settings and the signed-out pages to wear the posters I chose for the home page.
301. As anyone, I want nothing on these pages to move, and every word to stay readable.

### Sections

302. As a host, I want to put my page's sections in the order I choose.
303. As a host, I want to switch a section off, and for guests then not to be able to post to it.
304. As a host, I want to add notes of my own, such as Dress code or Getting there.
305. As a host, I want to add buttons that link to a registry, a playlist or a map.
306. As a host, I want a countdown to the event as a section of its own.
307. As a host, I want to rename a section, collapse it, and choose how the album, the comments and the guest list are drawn.
308. As a host, I want to see my sections in the editor as guests will.
309. As a guest, I want a collapsed section to show what it holds and to open with one tap.
310. As a host with an event made before 0.8, I want its page to look exactly as it did until I arrange it.

## Implementation Decisions

### Architecture

- **No new runtime dependency for playing, dragging or streaming (decided here).** Sizes are progressive MP4 files chosen by the browser's own player; reordering is by buttons. One small pure-JavaScript EXIF reader may be added for photos' details if `sharp`'s metadata proves insufficient; the ticket that needs it says so.
- **Migrations from 0054, in ticket order.** New enum types are created in the migration that first uses them; values are never added to an existing enum in the same migration as their first use (M7 plan ruling).
- **Pure rules, tested in Vitest; flows tested in the browser.** The two seams of every earlier milestone stand.
- **The app and the worker container are updated together**: a 0.7 worker would write a column 0.8 has dropped. The upgrade note says so.

### Album media

- **Menu (maintainer).** Auto, the original under its real size with "Original" after it, then 1080p and 720p where they exist. No 480p. The group shows when a video has two or more sizes.
- **Auto (maintainer): a smart pick on the same files, no HLS.** Chosen once when the video opens: the smallest playable size that fills the screen (its shorter side times the device's pixel ratio, no larger than the video), capped by the connection where the browser reports one (data saver or 2G: the smallest; 3G: 720p at most; a reported downlink under 10 Mbit/s: a size whose bit rate is within 70% of it). Three stalls in a minute, or one lasting six seconds, step down one size, with a short reload at the same position. Auto never steps up within a video. The option reads "Auto · 720p".
- **Remembered pick (maintainer).** Kept on the device under `openinvites.videoSize`; M7's key is read once ("original" stays the original, "copy" becomes Auto). A remembered size a video lacks gives the nearest below, else the nearest above. Only a choice the person makes is remembered, never Auto's step-down.
- **Sizes made (maintainer: the host's choice; rules decided here).** The host ticks 1080p and 720p per event; both by default; an event that chose 720p in 0.7 keeps 720p alone. Each ticked size is made when M7's rule says a copy is needed at that size, and skipped when it would be the same size as one already made. Nothing is upscaled. Labels round down to standard names (2160 and over "4K", 1440, 1080, 720, 480, 360, otherwise the side itself).
- **A video is ready as soon as it can play (decided here).** Only the one copy an original needs to play everywhere (when it is not H.264) is made before the item is ready; the other sizes follow as jobs of their own, one encode per claim, behind every new upload. A size that fails is dropped and logged; the item stays ready.
- **Lease (decided here).** Ten minutes, renewed every two while a job runs; a renewal that finds the job gone stops ffmpeg. This closes M7's deferred minor M5.
- **4K copy (maintainer).** A site switch, off by default: "Also make a 4K copy that plays everywhere". When on, a 4K original that is not H.264 also gets a 4K H.264 copy in standard colour, listed as "4K". The Storage card states the cost.
- **Make missing sizes (decided here).** A Storage card button queues every ready video that lacks a size its event asks for. Items stay ready. Copies an event no longer asks for are never deleted by it. Changing an event's sizes affects only what is processed afterwards.
- **HDR (maintainer).** An original whose transfer is HLG or PQ is HDR. Its copies are tone-mapped to BT.709. The start-up check learns whether the image's ffmpeg has the filters; where it has not, copies are made as in 0.7 and the Storage card says so. The original's option carries "HDR". A checked-in HDR clip proves the conversion and records what the rewrap does to an iPhone's Dolby Vision; if the Dolby Vision record is lost and can be kept by a flag, the ticket keeps it.
- **Details (maintainer: "more metadata is better; let the host choose").** The stored files keep nothing, as in M7, so a download never carries a detail. What is kept is read while processing and stored on the item: the frame rate and HDR kind always (they are the picture's, not the person's); the capture date and time, and the camera with its lens and exposure, each only while the host's switch for it is on, both off by default. A detail read under a switch that is later turned off stops being shown; it is not erased.
- **Location is never read (decided here).** No switch offers it.
- **Technical line (maintainer).** Under an open item: size, frame rate, HDR, length and file size for a video; size and file size for a photo.
- **Order (decided here).** With capture time kept, the host may order the album by when items were taken, falling back to when they were added.
- **Captions (maintainer).** Up to 140 characters of plain text, written while adding or afterwards by the item's uploader or a host, shown under the item and in its accessible name. Changing one is rate-limited as a comment is.
- **Storage** still counts uploads as sent only (M7). The configuration doc says a video may now have up to three copies.

### Voting

- **Shape (maintainer).** Off, open or closed per event. One vote per person per award; a second tap in an award moves the vote; a tap on the voted item takes it back. Nobody votes for their own upload. Only approved items in the award's scope take votes.
- **Awards (maintainer).** At least one; a new vote starts with "Favourite" for photos and videos. The host adds, renames, reorders and removes awards, each for photos, videos or both, with suggestions (Best photo, Best video, Funniest, Best group shot). Removing an award deletes its votes after a confirmation. **(maintainer, 2026-11-11)** While an award for photos only or for videos only is chosen, the album shows only those items, for voting and for its results; nothing is dimmed.
- **Who may vote (maintainer).** Everyone who sees the whole album (the default), only guests who are going, or only guests who replied through a personal invite link. Hosts always may.
- **Closing (maintainer).** By the host, or at a time the host sets, shown to guests. **(decided here)** No timer runs: once the time has passed, pages and the vote action treat voting as closed.
- **What guests see while open (maintainer).** No counts. The album in an order shuffled per guest, stable for that guest. **(decided here)** Hosts see counts and the usual order.
- **Uploader names (maintainer).** Always shown, shown after voting closes (the default), or never shown to guests. Hosts and an item's own uploader always see its name. **(decided here)** "After voting closes" hides names only while voting is open, so an event that never votes shows names as it always did. A hidden name is left out on the server: it is in no markup, label or payload.
- **Results (maintainer).** On closing, every item shows its count and each award shows ribbons for places first to third, with shared places on ties (12, 12, 9: first, first, third). A Winners strip heads the album.
- **Tie-break (maintainer).** When an award's first place is shared, the host may start a tie-break: a new round among the tied items only, a fresh vote each, counts hidden. Closing it puts the tied items in order among themselves by that round's votes, in the places they shared (two items that shared first become first and second); every other item keeps its place from the first round. If the top is still level, the host chooses another round among those still level, or a shared first. **(decided here)** A tie-break is offered for first place only.
- **Announcements (maintainer; decided here that the host sends them).** Starting a vote and closing one each offer an announcement already written, which the host may edit and sends through the existing Announcements page. Nothing is sent by itself.
- **Turning voting off (decided here)** deletes the event's votes after a confirmation that gives their number. Closing and reopening keep them.
- **Safety (decided here).** The vote action has its own rate limit (120 in ten minutes by default, since a party shares one address), checks again who may vote and what the viewer may see, and gives or moves the vote under the event's row lock, so a vote and the host's closing cannot cross.
- **Known limit, in the docs:** a person who replies under two names has two sets of votes; approval and personal invite links are the host's remedy.
- A duplicated event copies the awards and settings; voting starts off.

### Glass

- **Look (maintainer): poster and glass on every page**, signed-in pages included, as mock-up B.
- **`SitePage` (decided here).** A server component beside `ThemedPage`: the backdrop every event page has, drawn still, the theme's variables, and a scope in `globals.css` that points shadcn's tokens at the glass surfaces `legibility.ts` solves. Cards, fields, alerts and tables become glass by that scope, not page by page. Dialogs and menus, which are drawn outside it, stay opaque.
- **Which poster (maintainer: the page's own subject, and the host may pick their own).**
  - Sign-in, sign-up, the password screens, verify email, the co-host link: one poster from the site's home-page set, the same on every visit.
  - The locked page, report, retired link and stop-mail pages: the site's set, never the event's theme, so they read the same whatever the host chose (M6's reason stands).
  - Not found, too many requests, privacy, terms: the whole gallery, chosen without the database.
  - Site settings and reports: the site's set.
  - Dashboard, Account, New event: the host's pick; else the poster of their next event, as the dashboard's glow used; else the site's set.
  - An event's guests, invites, share, co-hosts and announcements pages: that event's theme.
- **The host's pick (maintainer; shape decided here).** A Backdrop card in Account: Automatic, or a gallery poster from big live swatches. Stored apart from the auth library's `user` table. It applies to the host's own pages, not to an event's management pages.
- **Still (decided here).** No drift, sparkles, doodles or entrances outside event pages.
- **Legibility (decided here).** Two inks are solved per backdrop, for danger and for attention. No text sits on the bare backdrop: headings sit on the veil, everything else in glass. A fixed backdrop makes axe report contrast as unmeasured, so the guarantee is `legibility.test.ts` over every backdrop, tone and accent, with pixel checks in the browser for the header, a field, a table row and a focus ring.
- **Dashboard.** Shelves and the empty state become glass panels; the glow goes; poster tiles are unchanged.
- The editor is not touched by this part.

### Sections

- **Storage (decided here).** `event.sections`, one JSON value holding the order and, per section, whether it is collapsed, its heading, its style and, for Notes and Links, its content. Absent means never arranged, which draws today's page exactly in each layout. It is not part of the Theme, which is the look.
- **One switch, one truth (decided here).** A switch that changes what the server accepts is a column. Comments (`commentsEnabled`) and Who's coming (`guestListVisibility`) move from the Settings sheet to Arrange and keep their columns; the album gains `albumEnabled`. With a section off, posting to it is refused.
- **Sections.** Letter, Details, Schedule, Who's coming, Announcements, Comments, Album, Countdown, and any number of Notes and Links up to ten. The poster, title, host line and reply bar are fixed. Details is always on. The Letter's switch is the Invites page's.
- **Per layout (decided here).** Each layout draws the placed list in its own idiom. In Broadsheet, Details is the description, with When and Where staying in the header. In Thread, Details is the description, When and Where bubbles together; the card stays first and the composer last; announcements move as a group.
- **Arrange sheet (maintainer; controls decided here).** A sixth editor tool. Each row has a switch and Move up and Move down buttons that name the section and announce its new place. A row opens for its heading, Collapsed, and styles as large swatches. Add a section offers Note or Links with suggestions. No drag and drop in 0.8.
- **The editor shows the sections (decided here).** In order, as glass placeholders that say what guests will see; Notes and Links are drawn in full and open their sheets.
- **Styles (maintainer).** Album: grid, mosaic (the first item large), strip (swiped sideways). Comments: list, bubbles. Who's coming: names, avatars.
- **Collapsed (maintainer).** A native disclosure showing the heading and a count.
- **Countdown (decided here).** Off by default. On, it replaces the countdown inside When.
- **Links (decided here).** `http` and `https` only, checked on save and on drawing; opened in a new tab without a referrer; the host name shown under the label; no icon fetched, nothing unfurled, no redirect through the site (ADR-0005). Six to a block.
- **Limits.** Headings 40 characters, a Note 2,000, a link's label 40.
- A duplicated event copies its sections.

### Glossary proposals (for the maintainer's `CONTEXT.md`; the tickets do not edit it)

- **Size**: one of the files a video can be played from, named by its height. _Avoid_: quality, resolution, rendition.
- **Album vote**: the hosts' contest on an album's items. _Avoid_: poll (the date poll's), like, reaction.
- **Award**: one thing an album vote chooses a winner for. _Avoid_: category, prize.
- **Tie-break**: a further round among the items sharing first place in an award.
- **Caption**: the line its uploader writes under an album item.
- **Section**: one part of an event page below the poster, which the host places. _Avoid_: block, module, widget.
- **Note**, **Links**: the sections a host writes.
- **Backdrop**: what fills a page that is not an event page: a poster's blurred copy, still. The glossary's Background stays the event page's.

### Repository

- Branch `m8` from `main` at dba88bd. Spec, plan and tickets under `.scratch/m8/`. Release note at `.scratch/m8/release-note-0.8.0.md`.

## Testing Decisions

- **Unit**: the size rules (what is made, labels, the pick, Auto, stepping down, reading the old key); the voting rules (state with a closing time, who may vote and for what, places with ties, the tie-break's first place, what is shown to whom, the shuffle being stable per viewer and different between two); the arrangement (defaults equal to today's order in each layout, tolerant parsing, limits, link safety, every change); the site look (stable per area, the fallback without a database); legibility over every backdrop with the new inks.
- **Browser, per ticket**, on the Docker test profile. New fixtures: a two-second 1920x1080 HEVC clip and a two-second HDR clip, each with a note of how it was made. New specs: `album-voting`, `site-look`, `sections`. A guest's page is read as HTML to prove a hidden name and count are absent.
- **Existing specs each part must keep green or update** are named in the tickets; the largest are `album-video`, `album-upload`, `album-settings`, `album`, `accessibility`, `keyboard`, `reduced-motion`, `dashboard`, `invites`, `thread`, `broadsheet`, `guest-list`, `comments`.
- **Each part ends with a pass**: three locales, axe in every new state, keyboard, reduced motion, docs, and for Glass the README screenshots.
- The Lighthouse budget on event pages is run again after Sections.

## Out of Scope

- Adaptive streaming (HLS or DASH); sizes below 720p; an HDR copy; hardware encoding.
- Location in any form; editing a detail by hand; details in a downloaded file.
- Comments or emoji on album items; votes on anything but album items; more than one vote per award; automatic emails about voting.
- A dark and light switch; drifting or animated backdrops outside event pages; a host's own picture as their backdrop.
- Drag and drop; two-column arrangements; sections shown only to some guests; embedded maps, players or forms.
- An access check on `/uploads/{id}/{file}`; downloading a whole album; the eleven minors M7 deferred, except M5.

## Further Notes

- The maintainer's answers of 2026-11-10, in order: four parts as one milestone; a menu of sizes, then "just 4K, 1080p and 720p" with Auto following the last pick; Auto as a smart pick after asking for the difference from streaming; a favourites contest; ties sharing a place; names shown after voting closes by default and changeable in settings; every Arrange extra offered "and more customisation"; look B after asking for a demo; the page's own subject's poster with the host able to pick their own; then, on reading the plan, all four voting extras, "one vote each person" in place of several, and a further contest for a tied first place; another round or a shared first if still tied; a 4K copy as an operator switch; HDR converted in the copies with a badge; capture time, camera and exposure kept at the host's choice, a technical line and captions.
- The plan at `m8-plan.md` orders the tickets: media 01 to 07, voting 08 to 14, glass 15 to 21, sections 22 to 29. Tickets 13 (tie-break) and 28 (styles) are placed so either can follow in a later release.
- The mock-up the maintainer chose from is at https://claude.ai/artifact/WqS8ugi7GrAxsB9XzfZGrq.
