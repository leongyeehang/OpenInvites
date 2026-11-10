# M7, the album's videos and its storage: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Each task's requirements are its ticket; the steps are the ticket's checkboxes.

**Goal:** guests add videos to the album as they add photos; every limit is on a screen and counts at once; the operator sees and bounds the site's storage; albums are emptied by people, reminded and never deleted on a timer.

**Architecture:** One upload protocol for every album item (ask, parts, finish) so no file is ever held in memory whole; a Postgres queue with a committed lease runs ffmpeg one clip at a time in the app container or a worker container that is the same image in a worker role; the storage interface (ADR-0003) learns to stream, stat and list, and the uploads route serves byte ranges; limits live in `instance_settings` and are read at the moment they are checked; the hourly sweep that runs retention gains two steps, the album reminders and the removal of abandoned uploads.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind 4 + shadcn/ui, Drizzle on Postgres 18, Better Auth, next-intl, Radix (`radix-ui`), sharp, nodemailer, Playwright, Vitest, and ffmpeg in the image (ADR-0007, the only runtime dependency this milestone adds).

**Spec:** `.scratch/m7-album/spec.md`. Each task's requirements are its ticket under `.scratch/m7-album/issues/`. The ticket binds for its task, the spec binds where the ticket is silent, and the M6, dashboard, home page, M4, M3, M2 and M1 specs, in that order, bind where both are silent. The three planning reports the tickets were written from are summarised in the tickets; the tickets carry every file and line they need.

Branch: `m7-album`, off `main` at f000d72 (M6 merged, unreleased), in the main checkout. Tasks run one at a time, in order. 01–03 (limits, sizes, the Storage card) come first because the video tickets check against them; 04–08 are the video pipeline; 09–10 are clearing up; 11 is the final pass.

## Global Constraints

- This is Next.js 16 with breaking changes. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. `src/proxy.ts` is what older Next.js called middleware. `cookies().set` works only in Server Functions and Route Handlers. `getTranslations` and `after()` work only inside a request: background work uses `translatorFor(locale)` (`src/locale/messages.ts`) and calls the mail worker directly.
- `docs/contributing/`, the M6 tickets under `.scratch/m6-invited/issues/` and the M4 tickets are the model for how the repository works (sources of truth, the testing seams, the Compose test profile, the browser test loop).
- Node 22 and pnpm are in `~/.local/opt/node/bin`, which is not on PATH. Prefix commands with `PATH=$HOME/.local/opt/node/bin:$PATH`. Docker commands run as `sg docker -c '…'`.
- Never kill `next-server` by name: it also kills the Docker test app mid-run. Start a dev server on a port of its own and stop it by that port. ffmpeg is not installed on this machine: anything that needs it runs in the Docker test profile, and fixtures are made in a throwaway `node:22-alpine` container with `apk add --no-cache ffmpeg`.
- Match the surrounding code: its comment density and voice (plain full sentences that say what a thing is for, citing the spec or a ticket where existing comments do), naming and idioms. Use `CONTEXT.md`'s words in code, and the spec's glossary proposals for the new ones: "photos and videos", "original quality", "lighter copy", "processing", "album reminder", "storage". Never "media" in the interface. Touch only what the ticket needs.
- Two testing seams only: the browser (Playwright against the real app, real Postgres, Mailpit) and pure rules called directly (Vitest). A test observes what a visitor, host or operator can observe. Test first where the logic is a pure rule. Browser tests wait on the page's state, never on time; `page.clock` is not used in this milestone.
- Every interface string lives in `messages/en.json`, and every key added there is added, translated, to `zh-Hans.json` and `zh-Hant.json`, so that `translations.test.ts` stays green at every commit; its "no instance" rule means every string says "site". A client component reads only namespaces its page passes, and a passed namespace must be read (`client-messages.test.ts`).
- In the interface, "site" never "instance"; the host area is light only; colours are tokens in `src/app/globals.css`, not literals in components; sizes read as "40 MB" and "1.5 GB", lengths as "15 min" and "1:05", through `src/lib/sizes.ts` (ticket 01), never as raw bytes. Units are binary (1 MB = 1,048,576 bytes), as `src/instance/env.ts` had them; the interface writes MB and GB.
- Migrations take the next free number in `drizzle/` when the ticket starts (`pnpm db:generate --name <tag>`, then the repo's leading comment), and `docker compose --profile test up -d --build --wait` rebuilds the test app after a schema change or a Dockerfile change. A migration that adds enum values stands alone and no migration of this release uses the new values (the 0030 precedent: Postgres cannot use an enum value in the transaction that adds it, and drizzle applies pending migrations in one transaction).
- No new runtime dependency beyond ffmpeg in the image (ADR-0007, ticket 05). Nothing leaves the instance (ADR-0005). Files are read and written only through the storage interface (ADR-0003). Mail is plain text through the outbox; host mail carries no stop footer, guest mail does.
- Commit only the files the change touches, staged by path. Never stage `CONTEXT.md`, `.claude/` or `.superpowers/`, and never `git add -A`, `git add .` or `git commit -a`. Never push or tag.
- Commit style: a subject of the form `<Area>: <what is now true, in plain words>`, a body saying what was missing and what changed, wrapped near 100 columns, and the trailers the session's attribution reminder gives (for example `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
- Checks before reporting done: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the browser specs the ticket names plus any existing spec the change could affect, against the Docker test profile rebuilt with the change (`CI=1`, `--workers=2` on this two-core machine; the full suite takes over an hour and is ticket 11's). The test profile's upload limit is 3 a minute per address: a spec that asks for more than three uploads in a minute from one page gets "too fast". If `pnpm typecheck` reports missing next-intl keys that exist, delete `tsconfig.tsbuildinfo` and rerun.
- After the work, append a dated entry under `## Comments` in the ticket (the M6 tickets are the model: how it landed, decisions and things to know, what is left for later tickets, evidence), tick the boxes met, and set `**Status:** done` only when every box is ticked. Commit the ticket with the work: this tracker is in git.

## Rulings made while planning

Where the code made the spec's letter impossible or unwise, the plan decides as follows. Each ruling is marked **(plan)** in the ticket that carries it; the maintainer may overrule before that ticket starts.

1. **One upload protocol for photos and videos** (ticket 06). The spec's photo post of ten files held in memory becomes 800 MB at a 40 MB cap. Photos join the ask, parts, finish protocol built for videos; a photo under the part size is one part. One file is in memory at a time. The upload rate limit counts the ask, once per batch.
2. **The Storage card links to the event page, not the manage page** (ticket 03). The operator cannot open another host's editor (`findHostEvent` is scoped to the host). Each row shows the title, the hosts' names and emails and the use, and links to the public event page, as the Reports page shows an event.
3. **The event's cap is combined with the site's at check time** (ticket 05), never refused at save. Refusing a value above the site's would make every later settings change fail once the operator lowers the site cap. The effective cap is the smaller of the two; the field's hint names the site's.
4. **Largest photo covers the host's poster picture too** (ticket 01), since `MAX_UPLOAD_MB` covered both; posters count toward the site's storage and obey the free-disk rule (ticket 02).
5. **The free-disk refusal is proven by unit tests only** (ticket 02): a browser test would need a test-only knob on a shared instance that also serves the poster uploads of other specs. The pure rule and the `statfs` reader are unit-tested; the refusal message is the same mechanism as the site limit's, which is browser-tested.
6. **Storage limits are stored in whole megabytes; the GB fields accept decimals down to 0.01 GB** (ticket 01), so the limits instance can test them with files of a few megabytes.
7. **Existing events start with no reminder after the upgrade** (ticket 09). The spec gives the site's default to new events only; a backfill would email the hosts of every past album at the first sweep.
8. **The reminder's mark stays after Empty the album** (ticket 09): no second email; the notice returns only if items are added again. Changing the reminder days, or redating the event, clears the mark when the new due day is in the future, as retention clears its mark on a redate. Keep it sets the reminder to never.
9. **The album reminder setting and Empty the album live outside the Settings sheet's form** (ticket 09), as `lettersEnabled` lives outside it: the form posts every field on every change, including on clicks, and would undo Keep it or fire a save on the button. The reminder is not in `EventInput`; it has its own action.
10. **The stray-files check is a button on the Storage card, not a script** (ticket 10). A script in the image cannot reuse the storage code (no TypeScript toolchain, bundled S3 client); the maintainer asked for everything on screens; the operator confirms the removal. It skips keys younger than an hour, read from the uuidv7 id, so an upload in progress is never a stray.
11. **The enum values `processing` and `failed` go in a migration of their own** (ticket 05) and are referenced only in code.
12. **ffmpeg 6 or later is required** (ticket 05): a phone's rotation survives a stream copy only from ffmpeg 6. Older, or missing, means the site refuses videos and the Storage card says why. Pinning the base image's Alpine release is the maintainer's call; the ADR notes the floating tag.
13. **A lighter copy is decided by the short side** (ticket 06): a portrait 1080×1920 clip is 1080p, not "taller than 1080p". The copy is made when the codec is not H.264, the short side is over the quality's, or the bit rate is over one and a half times the quality's.
14. **The browser's length check falls back to the server** (ticket 07): headless Chrome cannot read an HEVC clip's length; the server's ffprobe enforces the cap and marks the item failed with the limit named.
15. **The part size is 5 MB, with a test-only `UPLOAD_TEST_PART_BYTES`** on the test profile's `app` (ticket 06), so a small fixture spans several parts and a dropped part can be tested. A third fixture just over a minute long tests the length refusal.
16. **The picker accepts `image/jpeg,image/png,image/webp,image/avif,video/*`** (ticket 07), not `image/*`, so iPhones keep handing over JPEG rather than HEIC, which stays out of scope.
17. **Temporary files live under `os.tmpdir()/openinvites`** (ticket 06): parts and ffmpeg scratch. The deploy docs say the site runs one app container and that `/tmp` needs about three times the largest video free.
18. **The worker container is the standalone server in a worker role** (ticket 08), launched by `scripts/video-worker.mjs`, because a plain script cannot import the app's TypeScript. The app shows the worker's heartbeat on the Storage card.
19. **Processing tiles refresh the page every five seconds while one is shown** (ticket 07), the pattern of the guests page's `RefreshWhileWatching`.
20. **An item deleted while it is processing**: the processor finishes only `where status = 'processing'` and removes what it stored when no row answers (ticket 06).

## Review Focus

Inputs the spec implies but a ticket's tests could miss. Each line names the ticket that owns the test.

1. A host lowers Largest video below a clip whose upload is in progress: the reservation stands, the clip finishes, the next ask is refused with the new limit (ticket 06).
2. A clip whose length the browser could not read turns out to be over the cap: the item ends failed with "Videos can be up to 15 min", its bytes are released, nothing is emailed (ticket 06).
3. A video deleted by its uploader while it is processing: the processor stores nothing for it and the stray check finds no file (tickets 06, 10).
4. An event duplicated: Allow videos, both caps and the quality are copied; items and the reminder mark are not (ticket 05).
5. A portrait HEVC clip from a phone: the poster is upright, the stored original holds no location string, and the player says the original is not playable in headless Chrome and plays the copy (ticket 07).
6. Reduced motion with a Processing tile and the player on screen: nothing animates; switching quality keeps the position (ticket 07).
7. Two albums uploading at once near the site's limit: the overshoot is at most one batch each; the docs say so (ticket 02).
8. Keep it on the manage page, then an unrelated settings change in the sheet: the reminder stays never (ticket 09).
9. The upgrade: existing items get sizes from the one-time measuring and the Storage card shows "measuring" until it is done; existing events have no reminder (tickets 02, 09).
10. An event emptied while a video is processing and another is uploading: the finished video is not re-added and the upload's finish is refused (tickets 06, 09).
11. The operator's Clear the album on an event with a pending video: the job goes, the hosts' email names the counts as they were (ticket 10).
12. Without ffmpeg: the picker offers photos only, an ask with a video is refused with a message, the Storage card says videos need ffmpeg (tickets 05, 07).

---

## Task 1: Every limit on Site settings, in effect at once

Ticket: `.scratch/m7-album/issues/01-site-limits.md`. Model: Opus 5.5.

## Task 2: Every upload records its size, and the room check counts bytes

Ticket: `.scratch/m7-album/issues/02-sizes-and-room.md`. Model: Opus 5.5.

## Task 3: The Storage card

Ticket: `.scratch/m7-album/issues/03-storage-card.md`. Model: Opus 5.5.

## Task 4: Storage streams, and the uploads route serves byte ranges

Ticket: `.scratch/m7-album/issues/04-streams-and-ranges.md`. Model: Opus 5.5.

## Task 5: ffmpeg in the image, the video schema, and the event's video settings

Ticket: `.scratch/m7-album/issues/05-ffmpeg-schema-settings.md`. Model: Opus 5.5.

## Task 6: The upload protocol, the queue and the processing

Ticket: `.scratch/m7-album/issues/06-upload-queue-processing.md`. Model: Opus 5.5.

## Task 7: Videos in the album: the picker, the tiles and the player

Ticket: `.scratch/m7-album/issues/07-album-ui.md`. Model: Opus 5.5.

## Task 8: A worker container for the processing

Ticket: `.scratch/m7-album/issues/08-worker.md`. Model: Opus 5.5.

## Task 9: Empty the album, and the album reminder

Ticket: `.scratch/m7-album/issues/09-empty-and-reminder.md`. Model: Opus 5.5.

## Task 10: The operator clears an album, and finds stray files

Ticket: `.scratch/m7-album/issues/10-operator-clearing.md`. Model: Opus 5.5.

## Task 11: Translations, accessibility, docs, the full run

Ticket: `.scratch/m7-album/issues/11-final-pass.md`. Model: Opus 5.5.
