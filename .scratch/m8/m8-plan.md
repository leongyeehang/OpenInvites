# M8, the album's sizes and votes, glass on every page, and a page the host arranges: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Each task's requirements are its ticket; the steps are the ticket's checkboxes.

**Goal:** every album video offers named sizes with Auto, HDR and 4K handled properly; items keep chosen details, captions and a live photo's motion; hosts run a vote with awards and tie-breaks; every page sits on a poster with glass panels; hosts arrange their event page's sections; and the operator switches the optional features on or off.

**Architecture:** Features become modules inside the app (ADR-0008): a feature list with the operator's switches, voting in a folder of its own with one public entry and three named hooks, and the event page drawn from a registry of sections that features register with. Video sizes are progressive MP4 copies made by M7's queue, one encode per claim after the item is ready, and chosen in the browser by pure rules. Kept details live in the database, never in the stored files. Pages outside event pages wear a still backdrop through a server component and a CSS token scope that turns shadcn's surfaces to the glass `legibility.ts` already solves. An event's arrangement is one JSON column read through a tolerant parser, with every switch that changes what the server accepts kept as a column.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind 4 + shadcn/ui, Drizzle on Postgres 18, Better Auth, next-intl, Radix (`radix-ui`), sharp, nodemailer, Playwright, Vitest, and ffmpeg 8 in the image (ADR-0007; its `zscale` and `tonemap` filters were confirmed present on 2026-11-11). No player, drag-and-drop or streaming library is added.

**Spec:** `.scratch/m8/spec.md`. Each task's requirements are its ticket under `.scratch/m8/issues/`. The ticket binds for its task, the spec binds where the ticket is silent, and the M7, M6, dashboard, home page, M4, M3, M2 and M1 specs, in that order, bind where both are silent, except for the seven things the M8 spec changes (listed at its top).

Branch: `m8`, off `main` at dba88bd (v0.7.0), in the main checkout. Tasks run one at a time, in order: they share `src/db/schema.ts`, the migration numbers, `messages/*` and one Docker test instance. 01 is the groundwork every later ticket obeys; 02 to 09 are album media; 10 to 16 are voting; 17 to 23 are glass; 24 to 31 are sections. Each part ends in a state that could be released. Tickets 15 (tie-break) and 30 (display styles) may follow in a later release without holding the others.

**Who does what (maintainer, 2026-11-10):** each ticket is implemented by an Opus 5.5 subagent, test first, in one commit. The session that wrote this plan (Fable 5.2) reviews the diff after each part (after tickets 09, 16, 23 and 31), runs one fix pass, and does the whole-branch review at the end. Merge, push, CI and the tag are the maintainer's.

## Global Constraints

- This is Next.js 16 with breaking changes. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. `src/proxy.ts` is what older Next.js called middleware. `cookies().set` works only in Server Functions and Route Handlers. `getTranslations` and `after()` work only inside a request: background work uses `translatorFor(locale)` (`src/locale/messages.ts`) and calls the mail worker directly.
- `docs/contributing/`, the M7 tickets under `.scratch/m7-album/issues/` and the M6 tickets are the model for how the repository works (sources of truth, the testing seams, the Compose test profile, the browser test loop).
- Node 22 and pnpm are in `~/.local/opt/node/bin`, which is not on PATH. Prefix commands with `PATH=$HOME/.local/opt/node/bin:$PATH`. Docker commands run as `sg docker -c '…'`.
- Never kill `next-server` by name: it also kills the Docker test app mid-run. Start a dev server on a port of its own and stop it by that port. ffmpeg is not installed on this machine: anything that needs it runs in the Docker test profile, and fixtures are made in a throwaway `node:22-alpine` container with `apk add --no-cache ffmpeg`, with the command recorded beside the fixture.
- The disk is 60 GB and test-profile rebuilds fill it. Check `df -h /` before a rebuild and prune the build cache (`sg docker -c 'docker builder prune -f'`) when less than 15 GB is free. Build `app` alone first (`docker compose --profile test build app`), then `up -d --build --wait`: building everything at once has been killed for memory.
- **Modules (ADR-0008, ticket 01).** A new feature lives in its own folder with one public entry file (`src/features`, `src/voting`, `src/sections`). It touches the rest of the app only through the hooks its ticket names. Nothing outside a module imports its other files; lint enforces this. No ticket adds a file outside `src/album` that imports album internals: the count is 25 and must not grow, and `src/features/boundaries.test.ts` (ticket 01) fails `pnpm test` when it does.
- Playwright's single-instance projects run in a chain. Ticket 01 adds `features-instance` after `worker-instance` and ticket 03 adds `sizes-instance` after it; a later ticket that needs an instance of its own chains its project after the last one then in `playwright.config.ts`.
- Match the surrounding code: its comment density and voice (plain full sentences that say what a thing is for, citing the spec or a ticket where existing comments do), naming and idioms. Use `CONTEXT.md`'s words in code, and the spec's glossary proposals for the new ones: "size" (never quality or resolution), "album vote", "award", "tie-break", "caption", "live photo", "section", "note", "links", "backdrop". Never "media" in the interface. "Voter" and "vote" alone belong to the date poll: no type is named `Voter` outside `src/polls`. Touch only what the ticket needs.
- Two testing seams only: the browser (Playwright against the real app, real Postgres, Mailpit) and pure rules called directly (Vitest). A test observes what a visitor, host or operator can observe. Test first where the logic is a pure rule. Browser tests wait on the page's state, never on time.
- Every interface string lives in `messages/en.json`, and every key added there is added, translated, to `zh-Hans.json` and `zh-Hant.json`, so that `translations.test.ts` stays green at every commit; its "no instance" rule means every string says "site". A client component reads only namespaces its page passes, and a passed namespace must be read (`client-messages.test.ts`).
- In the interface, "site" never "instance"; colours are tokens in `src/app/globals.css`, not literals in components; sizes of files read as "40 MB" and "1.5 GB" and lengths as "15 min" and "1:05" through `src/lib/sizes.ts`. The host area is **no longer light only**: from ticket 18 every page outside an event page wears a still backdrop, and text never sits on the bare backdrop.
- Nothing on a page outside an event page moves: no drift, sparkles, doodles or entrances. Motion a person starts (a live photo, a video) is theirs to start, and under reduced motion nothing starts by itself.
- Migrations take the next free number in `drizzle/` when the ticket starts (`pnpm db:generate --name <tag>`, then the repo's leading comment); the first of this milestone is 0054. `docker compose --profile test up -d --build --wait` rebuilds the test app after a schema or Dockerfile change. A migration that adds enum values stands alone and no migration of this release uses the new values (the 0030 precedent). A new enum type may be used by the migration that creates it.
- The app and the worker container are updated together: a 0.7 worker would write a column 0.8 drops. The upgrade note says so (ticket 09).
- No new runtime dependency, with one allowance: a small pure-JavaScript EXIF reader if ticket 07 finds `sharp`'s metadata insufficient. Nothing leaves the site (ADR-0005). Files are read and written only through the storage interface (ADR-0003). Mail is plain text through the outbox; host mail carries no stop footer, guest mail does. Location is never read from an upload, under any setting.
- What a guest must not see is left out on the server, never hidden in the browser: an uploader's name, a count, a detail whose switch is off. A browser test reads the page's HTML to prove it.
- Commit only the files the change touches, staged by path. Never stage `CONTEXT.md`, `.claude/` or `.superpowers/`, and never `git add -A`, `git add .` or `git commit -a`. Never push or tag.
- Commit style: a subject of the form `<Area>: <what is now true, in plain words>`, a body saying what was missing and what changed, wrapped near 100 columns, and the trailers the session's attribution reminder gives (for example `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
- Checks before reporting done: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the browser specs the ticket names plus any existing spec the change could affect, against the Docker test profile rebuilt with the change (`CI=1`, `--workers=2` on this two-core machine; the full suite takes over an hour and a half and belongs to the passes). The test profile's upload limit is 3 a minute per address. If `pnpm typecheck` reports missing next-intl keys that exist, delete `tsconfig.tsbuildinfo` and rerun.
- After the work, append a dated entry under `## Comments` in the ticket (the M7 tickets are the model: how it landed, decisions and things to know, what is left for later tickets, evidence), tick the boxes met, and set `**Status:** done` only when every box is ticked. Commit the ticket with the work: this tracker is in git.

## Rulings made while planning

Where the code made the spec's letter impossible or unwise, or left a choice a person will notice, the plan decides as follows. Each is marked **(plan)** in the ticket that carries it, with the smaller, code-level rulings beside it; the maintainer may overrule any before its ticket starts.

Groundwork and media

1. **Feature switches are rows, and a feature with no row is on** (ticket 01): table `instance_feature`, so a later feature brings its switch without touching the settings row.
2. **A switched-off feature keeps the event's stored settings** (ticket 01). The Settings sheet hides the feature's group and saving keeps those fields as they were; otherwise switching the album off and saving would turn approval off and approve every waiting photo.
3. **The album's outside dependents number 25, not 24** (ticket 01): `src/instrumentation.ts` imports the album dynamically. The ADR records 25 and a unit test holds it.
4. **With the album off, album reminders wait** (ticket 01): none is sent or marked sent, so one that is due goes out when the album is back on.
5. **`2160p` arrives through a new enum type, `video_size`, which replaces `video_quality`** (ticket 02), so no value is ever added to an existing enum. The queue's `video_work` type is created with `process`, `sizes` and `motion` at once (ticket 03) for the same reason.
6. **A host may tick neither size** (ticket 02): an original that is not H.264 then still gets a 720p copy before it is ready, so that it plays everywhere.
7. **A size is skipped only when it would match a copy, never the original** (ticket 03): a too-heavy 1080p H.264 original still gets a lighter 1080p copy.
8. **Later sizes are made from the stored original** (ticket 03), smallest first, because the clip as sent is deleted once the item is ready.
9. **The 4K copy is 16 Mbit/s** (ticket 04), at most about 115 MB a minute, only for originals of 2160 or more on the short side that are not H.264, and never the copy made before the video is ready. A copy's timeout grows with the clip.
10. **An HDR clip's poster and thumbnail are converted too** (ticket 05). `zscale` with `tonemap` is used, not `libplacebo` (which wants a GPU).
11. **Dolby Vision is unproven without a real clip** (ticket 05): the rewrap adds `-strict unofficial` when ffprobe reports the record, and whether it survives needs an iPhone clip from the maintainer. Until then the docs say it is untested.
12. **Stepping down goes to the next smaller size** (ticket 06): a stalling 4K original goes to 1080p, not to a 4K copy. Auto's choice is fixed for the open video, and a wait caused by scrubbing is not a stall.
13. **No EXIF library is added** (ticket 07): the album reads the TIFF structure itself and never follows the GPS pointer, so location cannot be read by accident.
14. **A capture time with no offset is read in the event's time zone** (ticket 07); times before 2000 or more than a day in the future are dropped.
15. **A live photo's motion is made by the video queue** (ticket 08), as a job of its own, at most 3 seconds and 720p, silent. It is kept while the site's Videos feature is on and ffmpeg is usable; the event's "Allow videos" does not affect it, since a live photo is a photo.
16. **The iPhone note shows to iPhones and iPads only** (ticket 08), judged in the browser.
17. **A caption shows in the viewer and in every accessible name, not under grid tiles** (ticket 09). While adding, each file's status line has a caption field, because files are sent as soon as they are picked.

Voting

18. **Voting imports nothing from the album** (ticket 10): it restates the album's "open to this viewer" rule and reads items as rows, so the 25 does not grow. M9's album entry replaces the restatement.
19. **The Favourite award is created when first needed** (ticket 10). At most eight awards an event, at least one (ticket 13).
20. **Starting a vote needs the album open; reopening ends any tie-break and deletes its votes** (ticket 10).
21. **With Voting switched off for the site, names show as before 0.8** (ticket 11), whatever the names setting says, and return to it when Voting is switched on.
22. **The chosen award lives in the URL** (`?award=`, ticket 12), so switching awards costs no request.
23. **Changing an award's scope keeps votes for items it no longer shows, uncounted** (ticket 13); changing it back restores them.
24. **"Invited personally" means the reply has an invite** (ticket 14), which includes every reply on an invite-only event.
25. **A vote stays until its voter takes it back, the item or the reply is deleted, or voting is turned off** (ticket 14). A guest who voted while Going and then changes to Maybe under "only going" keeps the vote counted and cannot move it.
26. **Drafts reach the Announcements page as `?draft=voting` or `?draft=winners`** (ticket 14) and fill its form. The closing time is entered in the event's zone; a past time is refused.
27. **During a tie-break names stay as they were at close** (ticket 15), and it has no closing time: the host closes it.
28. **The shuffle is proven by unit tests** (ticket 16); a browser test that two guests' orders differ would be flaky. The winners announcement names items by kind and uploader, never by number.

Glass

29. **Site pages are solved over extra surfaces** (ticket 17), for the glass on glass only they stack; an event's management pages may be a shade more tinted than its event page. The inks start from red-600 and amber-600.
30. **The token scope sits outside every CSS layer** (ticket 18), after `.dark`, or shadcn's own utilities would beat it.
31. **The ground rule is deleted with the host frame** (ticket 20), not with the scope (ticket 18), so no host page sits on white between the two.
32. **The verification banner also shows on Site settings and reports** (ticket 20), which had none.
33. **A host's backdrop is chosen, then saved with a Save button** (ticket 22), from the gallery's pictures drawn large; a saved poster that leaves the gallery reads as Automatic.

Sections

34. **The registry is two halves** (ticket 24): a client-safe `REGISTRY` in `src/sections/`, and the server drawings in `src/themes/sections/drawings.ts`, so the Arrange sheet never bundles server loaders.
35. **A move names the neighbour the sheet shows** (ticket 24), so a row the sheet hides never swallows a press.
36. **Only the Poster is drawn from the list in ticket 25**; Broadsheet and Thread follow in 27, and nothing breaks between.
37. **Every Poster heading carries its kind's icon** (ticket 25), so Announcements gains one.
38. **Thread's entrance stagger counts sections, not bubbles** (ticket 27): the order is unchanged, the timing shifts slightly.
39. **Switching Countdown on while it is last moves it to just after Details** (ticket 28).
40. **A link with no label shows its site's name; an address typed without a scheme is saved with `https://`** (ticket 29).
41. **The first style of each kind is today's drawing** (ticket 30), so pages never styled are unchanged.

## Review Focus

Inputs the spec implies that a ticket's first draft did not test. Lines 1 to 13 now have a step in the ticket named; 14 to 17 cannot be made into a steady test and are checked by reading the code in the part's review.

1. The Album switched off while a guest's upload is half sent: the next part and the finish are refused, nothing stored is deleted (ticket 01).
2. A browser with no connection facts, or that refuses storage: Auto picks by the screen alone, and the pick lasts for the page (ticket 06).
3. Scrubbing a video on a slow connection under Auto does not step it down (ticket 06).
4. Capture time switched on after items were added: older items show none and sit by when they were added (ticket 07).
5. A Pixel's Ultra HDR motion photo, whose clip is the third item in its directory, still keeps its motion (ticket 08).
6. Voting switched off by the operator during an open vote set to Never: names show; switched on again, the vote and its votes are as they were (ticket 12).
7. A guest who voted while Going changes to Maybe under "only going": the vote stays counted and cannot be moved (ticket 14).
8. A winner deleted after voting closes: the strip and ribbons follow (ticket 16).
9. An event deleted while its guests page is open, and a poster changed in the editor: one backdrop and one footer on the not-found page, and the new poster at once (ticket 21).
10. Forced colours (Windows high contrast): text and focus rings stay visible on glass (ticket 23).
11. Two hosts arranging at once, and headings of spaces, CJK or emoji: no section is lost, and lengths are counted the same in the browser and on the server (ticket 24).
12. An arrangement made on Poster, then the layout changed to Thread: the order holds and Thread's default collapse does not return (ticket 27).
13. Notes and Links on an undated draft and on a cancelled event (ticket 29).
14. New uploads are processed before queued `sizes` jobs, so a guest's clip is ready while Make missing sizes works through many videos (tickets 03, 04; by reading `claimJob`).
15. An item deleted during a `sizes` or `motion` encode: ffmpeg stops at the next renewal, nothing is stored, the stray check finds nothing (tickets 04, 08; by reading).
16. A host closing voting while a guest's vote is in flight: the row lock places the vote wholly before or after (ticket 12; by reading `setVote`).
17. A party on one shared address: the vote limit is shared and each vote redraws the page; the next vote over the limit shows "too fast", never a broken page (ticket 12; by reading, with the limit's browser row).

---

## Task 1: The operator switches features, and new features live apart

Ticket: `.scratch/m8/issues/01-features-groundwork.md`. Model: Opus 5.5.

## Task 2: An item keeps several sizes, and the host ticks 1080p and 720p

Ticket: `.scratch/m8/issues/02-sizes-schema.md`. Model: Opus 5.5.

## Task 3: Processing makes every size, and a video is ready after the first

Ticket: `.scratch/m8/issues/03-processing-sizes.md`. Model: Opus 5.5.

## Task 4: Leases are renewed, missing sizes are made on request, and a 4K copy may be made

Ticket: `.scratch/m8/issues/04-lease-missing-sizes-4k.md`. Model: Opus 5.5.

## Task 5: HDR copies come out in standard colour

Ticket: `.scratch/m8/issues/05-hdr-copies.md`. Model: Opus 5.5.

## Task 6: The size menu, Auto, the remembered pick and stepping down

Ticket: `.scratch/m8/issues/06-size-menu-and-auto.md`. Model: Opus 5.5.

## Task 7: The technical line, and the details a host may keep

Ticket: `.scratch/m8/issues/07-details-from-uploads.md`. Model: Opus 5.5.

## Task 8: Live photos

Ticket: `.scratch/m8/issues/08-live-photos.md`. Model: Opus 5.5.

## Task 9: Captions, and the media pass

Ticket: `.scratch/m8/issues/09-captions-and-media-pass.md`. Model: Opus 5.5. The full browser suite runs here. **Part review (Fable) follows this task.**

## Task 10: The voting module: tables, rules, and the host's start, close, reopen and turn off

Ticket: `.scratch/m8/issues/10-voting-module.md`. Model: Opus 5.5.

## Task 11: Uploader names left out on the server

Ticket: `.scratch/m8/issues/11-uploader-names.md`. Model: Opus 5.5.

## Task 12: Voting in the album, with one award

Ticket: `.scratch/m8/issues/12-voting-in-the-album.md`. Model: Opus 5.5.

## Task 13: Awards and the award picker

Ticket: `.scratch/m8/issues/13-awards.md`. Model: Opus 5.5.

## Task 14: Who may vote, the closing time, and the "Voting is open" draft

Ticket: `.scratch/m8/issues/14-who-votes-and-closing.md`. Model: Opus 5.5.

## Task 15: Tie-break rounds

Ticket: `.scratch/m8/issues/15-tie-break.md`. Model: Opus 5.5. May follow in a later release; task 16 does not need it.

## Task 16: The Winners strip, the winners draft, the shuffled order, and the voting pass

Ticket: `.scratch/m8/issues/16-winners-and-voting-pass.md`. Model: Opus 5.5. The full browser suite runs here. **Part review (Fable) follows this task.**

## Task 17: Site look rules and the two new inks

Ticket: `.scratch/m8/issues/17-site-look-rules.md`. Model: Opus 5.5.

## Task 18: The backdrop, the site page, the token scope, and the notice pages

Ticket: `.scratch/m8/issues/18-site-page-and-notices.md`. Model: Opus 5.5.

## Task 19: Signed-out pages

Ticket: `.scratch/m8/issues/19-signed-out-pages.md`. Model: Opus 5.5.

## Task 20: The host frame and the dashboard

Ticket: `.scratch/m8/issues/20-host-frame-and-dashboard.md`. Model: Opus 5.5.

## Task 21: An event's management pages in the event's theme

Ticket: `.scratch/m8/issues/21-event-management-pages.md`. Model: Opus 5.5.

## Task 22: The host's own backdrop

Ticket: `.scratch/m8/issues/22-host-backdrop.md`. Model: Opus 5.5.

## Task 23: The glass pass

Ticket: `.scratch/m8/issues/23-glass-pass.md`. Model: Opus 5.5. The full browser suite runs here. **Part review (Fable) follows this task.**

## Task 24: The arrangement model and the section registry

Ticket: `.scratch/m8/issues/24-arrangement-model.md`. Model: Opus 5.5.

## Task 25: Storage, the action, the Arrange sheet, and the Poster drawn from the list

Ticket: `.scratch/m8/issues/25-arrange-sheet-poster.md`. Model: Opus 5.5.

## Task 26: Comments, Who's coming, the Album and the Letter are switched in Arrange

Ticket: `.scratch/m8/issues/26-switches-to-arrange.md`. Model: Opus 5.5.

## Task 27: The Broadsheet and the Thread draw the host's order

Ticket: `.scratch/m8/issues/27-broadsheet-thread-sections.md`. Model: Opus 5.5.

## Task 28: Collapse, rename, Countdown

Ticket: `.scratch/m8/issues/28-collapse-rename-countdown.md`. Model: Opus 5.5.

## Task 29: Notes and Links

Ticket: `.scratch/m8/issues/29-notes-and-links.md`. Model: Opus 5.5.

## Task 30: Display styles

Ticket: `.scratch/m8/issues/30-display-styles.md`. Model: Opus 5.5. May follow in a later release; task 31 does not need it.

## Task 31: The sections pass, the 0.8.0 release note, the glossary proposals

Ticket: `.scratch/m8/issues/31-sections-pass.md`. Model: Opus 5.5. The full browser suite runs here. **Part review (Fable) follows this task**, then the whole-branch review and the finishing menu.
