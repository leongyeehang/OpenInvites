# OpenInvites M7: the album's videos and its storage

Written 2026-11-09 (Fable 5.1) from the maintainer's answers of 2026-11-08, `CONTEXT.md`, the M4 and M6 specs and what they built, and a read of the album, storage, limits and retention code. Choices the maintainer made are marked **(maintainer, 2026-11-08)**. Where nobody decided, the choice is marked **(decided here)** and the maintainer may overrule it before the ticket that carries it starts.

The M1 to M6 specs and the home page and dashboard specs stay binding for everything they cover. This spec adds to them and changes three things they settled: the album takes videos as well as photos; the largest upload is no longer only an environment setting; and the image gains its first binary dependency, ffmpeg, which gets an ADR of its own.

## Problem Statement

With M6 merged, the album takes photos from guests who replied, from the event's start, under the host's visibility and approval rules. Four things are missing once a party's clips are videos:

1. The album refuses videos. Guests record the toast on their phones and have nowhere on the site to put it.
2. The only size limit is `MAX_UPLOAD_MB` in the container's environment, 10 MB, for the host's picture and every photo alike. Changing it means editing the container's settings and restarting; a host whose guest is refused can do nothing on the spot.
3. Storage is counted in photos, 300 an event. Once a file can be hundreds of megabytes, a count says nothing about the disk, and the operator has no way to see how full the site is or which events fill it.
4. Files leave the site only with their photo, their reply, their event or the host's account, or when retention deletes the event a year after it ends. A host cannot empty an album in one step, nobody is reminded that an old album is still taking space, and the operator cannot reclaim space without deleting events.

Constraints: guests never have accounts; nothing leaves the instance (ADR-0005), so no outside service processes or hosts a video; the storage interface (ADR-0003) stays the one way files are read and written, on local disk or S3; the UX bar is Apple Invites and Partiful, with settings out of the way; CI fails on any flake, so every wait in a browser test is on the page's state.

## Solution

**(maintainer, 2026-11-08)** One milestone, M7, released as 0.7.0:

1. **Videos in the album.** Guests and hosts add videos as they add photos. Every clip is kept at original quality, with the phone's location and device details dropped, and a lighter 1080p copy is made on the server for slow connections. The player offers both qualities and remembers each viewer's choice on their device. Processing happens on the server with ffmpeg built into the image, in a background queue, one clip at a time, so the site stays responsive; clips that are already in the common format are only rewrapped, which is instant. Uploads are checked in the browser before a byte is sent and go up in parts that resume after a dropped connection.
2. **Limits on screens, in effect at once.** The operator sets the largest photo (40 MB), the largest video (750 MB), the longest video (15 minutes), the storage per event (50 GB) and the storage for the site (50 GB) on Site settings, where a change counts from the moment it is saved. A host allows or refuses videos for an event and caps their length and size under the site's, in Album settings, so a refused guest can be let in at once.
3. **Storage that is counted and seen.** Every upload records its size as sent; copies, posters and thumbnails never count. A Storage card on Site settings shows what the site uses, what is free on the disk, and the events that use the most. Uploads stop before the disk fills.
4. **Clearing up by people, never by a timer.** A host empties an album in one confirmed step. A reminder, at a time the host chooses after the event, asks the host to empty the album or keep it. The operator can clear an event's album from the Storage card, with a confirmation, and the hosts are told. A command finds files no item names. Retention of whole events stays as it is.

## User Stories

Numbering continues from the M6 spec, which ended at 250.

### Videos

251. As a guest, I want to add a video from my phone to the album, so that the party's clips are kept with its photos.
252. As a guest, I want to be told the moment I pick a clip that is too long or too large, before it uploads, so that I do not wait for nothing.
253. As a guest on a phone network, I want a large clip to go on uploading after my connection drops, so that it arrives.
254. As a guest, I want to see my clip in the album as soon as it is uploaded, marked as processing until it plays, so that I know it was taken.
255. As a guest, I want to play a video in the viewer and choose between original quality and the lighter copy while it plays, with my choice remembered on my device, so that it plays well on my connection.
256. As a guest, I want to download a video at original quality.
257. As a host, I want videos to follow the album's approval and visibility rules exactly as photos do, so that there is one set of rules.
258. As a guest, I want my clip's location and device details never to reach other guests, as with photos.
259. As a host, I want to choose the lighter copy's quality, 1080p or 720p, so that the album suits my guests.

### Limits

260. As the operator, I want to set the largest photo, the largest video, the longest video, the storage per event and the storage for the site on Site settings, taking effect at once.
261. As a host, I want to allow or refuse videos for my event and cap their length and size under the site's, and to change that at once when a guest is refused.
262. As a guest refused for a limit, I want to be told which limit it was and its value, in plain units.

### Storage

263. As the operator, I want to see how much the site uses, how much of the disk is free, and which events use the most, so that I know what to clear.
264. As the operator, I want uploads to stop before the disk fills, so that the site keeps running.
265. As the operator, I want videos processed without the site slowing, and the choice to move processing to a second container.
266. As the operator, I want the numbers right after upgrading, without doing anything.

### Clearing up

267. As a host, I want to empty an event's album in one confirmed step, so that the space is freed.
268. As a host, I want to be reminded, a chosen time after the event, to empty the album or keep it, so that old albums do not fill the site unnoticed.
269. As the operator, I want a default reminder period that new events start with.
270. As the operator, I want to clear an event's album from the Storage card, with a confirmation, and its hosts told.
271. As the operator, I want a command that lists files no item names and removes them when I say so.

## Implementation Decisions

### Architecture

- **ffmpeg in the image (ADR-0007).** The runner stage of the Dockerfile adds Alpine's `ffmpeg` package, about 90 MB. It is the first binary the image carries beyond Node and the app's own modules. The ADR records why (every clip plays in every browser; real thumbnails; the lighter copy bounds what guests download), what it costs (image size; CPU and about 300 MB of memory while a clip is converted) and the rule it changes (M6's "no new runtime dependency" is no longer absolute: a dependency needs an ADR). On a machine without ffmpeg, such as a developer's `pnpm dev` without it installed, the app starts, refuses videos, and Site settings says why. **(maintainer, 2026-11-08: approach C; the rest decided here)**
- **A processing queue in Postgres.** A `video_job` row per uploaded clip, claimed with `FOR UPDATE SKIP LOCKED` as the mail outbox claims its rows, so several containers share one queue and nothing runs twice. The instance's clock (instrumentation, the mail worker's tick) runs the queue once a minute and an upload kicks it at once. One job at a time per processor, ffmpeg at low priority (`nice`). A job holds a lease; a lease older than an hour is taken as a crashed processor and the job is tried again, three tries in all, then the item is marked failed. **(decided here)**
- **Where processing runs.** `VIDEO_PROCESSING=app` (the default) processes in the app container. `VIDEO_PROCESSING=worker` makes the app container only queue, and a `worker` service from the same image, `node scripts/video-worker.mjs`, processes continuously; the deploy compose file carries it commented out. The worker reads and writes files only through the storage interface, so it works on local disk (sharing the `uploads` volume) and on S3 alike. The Storage card says which is processing and, for the worker, when it was last seen. **(maintainer, 2026-11-08: the option; decided here: the shape)**
- **Files kept per video**, named after the item's id through the storage interface: `<id>-video-sent` (the clip as uploaded, private, never served, deleted once processing ends), `<id>-video.mp4` (original quality: the same frames rewrapped into MP4 with every piece of metadata dropped and the index at the front; served, downloadable), `<id>-video-1080p.mp4` or `<id>-video-720p.mp4` (the lighter copy, when one is needed), `<id>-video-poster.webp` (a frame for the player, up to 2048 pixels) and `<id>-video-thumb.webp` (the square thumbnail, 480 pixels, as photos').
- **Serving with ranges.** The `/uploads/{id}/{file}` route learns to stream: the storage interface gains a `stream(key, range)` (disk: a read stream of the range; S3: a range request through the client's partial read), the route answers `Accept-Ranges: bytes` and `206` for a `Range` header, with `Content-Type: video/mp4`, and no longer reads a whole file into memory for any file. Caching stays `public, max-age=31536000, immutable`, since an id's content never changes.
- **Streams on the way in.** Nothing of a video passes through memory whole: parts are written to the app's disk as they arrive, assembled by streaming, stored by streaming, and processed from a temporary file.

### Videos **(maintainer, 2026-11-08, except where marked)**

- **What is accepted**: any file ffmpeg can read as video. The browser's picker asks for `image/*,video/*`; the server judges by the bytes. A clip ffmpeg cannot read becomes a failed item.
- **The check before sending.** When a guest picks a clip, the browser reads its length and size (an off-screen video element gives the length) and refuses it on the spot when either is over the event's caps, saying which: "Videos can be up to 15 min long; this one is 22 min." and "Videos can be up to 750 MB; this one is 1.2 GB." The caps are not shown before a file is picked **(maintainer: shown on refusal only)**. The server checks both again: the size at the last part, the length by ffprobe, and marks the item failed when a lying browser sent one over the cap.
- **Resumable upload in parts.** A video goes up in 5 MB parts. The browser first asks for an upload (the file's name, size, type and length), gets an id and the part size, then sends the parts in order, up to three at a time; on a dropped connection it asks which parts arrived and sends the rest; the browser keeps the upload's id for the file in session storage so a reload resumes too. The last part assembles the file. Parts of an upload not finished within a day are removed by the hourly sweep and its reserved space released. The upload limit (`RATE_LIMIT_UPLOAD`) counts the asking, once per video, not the parts. Only the device that asked may send parts: the upload's id is unguessable and tied to the asker's reply or host account. **(decided here: the shape)**
- **What the queue does**, per clip: read the clip's streams with ffprobe (codec, size, length, rotation); rewrap into `-video.mp4` with the streams copied, metadata and chapters dropped, the index moved to the front; decide whether a lighter copy is needed; make it when so; take a poster frame at one second (or the first frame of a shorter clip) and the thumbnail through the image pipeline; store all of them; delete `-video-sent`; mark the item ready with its length, its original's codec and dimensions, and whether a copy exists. A portrait clip stays upright: the rotation a phone records survives the rewrap, and a browser test proves it.
- **When a lighter copy is needed**: when the original is not H.264 (an iPhone's high-efficiency HEVC, for one), or taller than the event's chosen quality, or more than one and a half times that quality's bit rate (6 Mbit/s at 1080p, 3 at 720p). Otherwise the original serves both qualities and no copy is made. With the switch off, no copy is ever made: the original plays where the browser can and the player says when it cannot. **(decided here)**
- **The copy**: H.264 at the event's quality, no larger than the original, about 6 Mbit/s at 1080p and 3 at 720p, AAC audio, index at the front, no metadata, standard colour (HDR comes out flatter: a known limit, in the docs).
- **Playback.** The viewer plays a video with the browser's own player, the poster first, seeking through range requests. A quality control, usable while the video plays, offers Original quality and Lighter copy when both exist. A device that has never chosen gets the lighter copy; a choice made once is kept on that device for every video on the site, so a guest who picked the original keeps getting it, and one who picked the lighter copy keeps that **(maintainer, 2026-11-09)**. When the browser cannot play the original's codec (judged in the browser from the codec string the item records), the copy plays and the control says "Original quality: not playable in this browser". Download gives the original. **(maintainer: originals kept, viewer chooses; decided here: the fallback)**
- **Processing and failed tiles.** An item that is uploading or processing shows a film tile with "Processing" to its uploader and to the hosts only, with a live status so a screen reader hears it; nobody else sees it. A failed item shows "Couldn't be processed" to its uploader and the hosts, with Remove; it counts for nothing and is not emailed about.
- **Rules as photos.** A video is an album item: it waits for approval when the event approves items, the hosts' email about items waiting covers it ("{name} added 2 photos and a video"), visibility covers it, the uploader and the hosts delete it, and deleting removes every file it has. A host's own video is approved at once, as a host's photo is.
- **Privacy.** The original keeps nothing of the clip's metadata: no location, no device, no capture time. The hosts' email names the uploader as it does for photos.

### Limits **(maintainer, 2026-11-08)**

- **Site settings, Limits card**: Largest photo (40 MB), Largest video (750 MB), Longest video (15 min), Storage per event (50 GB), Storage for the site (50 GB). Each takes effect the moment it is saved: every check reads the current value, as the existing limits do. Lowering a limit leaves what exists and refuses only new uploads. Ranges: photos 1 to 1,000 MB; videos 1 to 10,000 MB; length 1 to 180 min; storage 0.1 to 100,000 GB. The card's "Photos per event" becomes "Photos and videos per event" and counts both.
- **`MAX_UPLOAD_MB` retires.** At the first start after the upgrade, the app copies its value, when set, into Largest photo; otherwise 40 MB. From then on the environment setting is ignored, and the docs say so under "Upgrading to 0.7".
- **Album settings, per event**: Allow videos (on while the site allows them), Longest video and Largest video (each at most the site's; blank means the site's), Lighter copy (1080p or 720p), and Remind me about the album (below). There is no per-event default quality: the viewer's own choice rules **(maintainer, 2026-11-09)**. Duplicating an event copies these settings and no items.
- **Who may change what**: the operator, the site's; a host or co-host with the guests permission, the event's. Everything is on a screen; the only setting that is not is `VIDEO_PROCESSING`, which starts a container and cannot be a switch.
- **Refusals name the limit** in plain units: "Videos can be up to 750 MB", "This album is full: 50 GB", "The site is full: ask the hosts to clear an album", "The site's disk is nearly full".

### Storage **(maintainer, 2026-11-08, except where marked)**

- **What counts**: every photo and video counts its size as uploaded, recorded when it arrives; a host's picture counts its size as uploaded too. Copies, posters, thumbnails and the re-encoded photo files never count. **(maintainer)** A video counts from the moment its upload is asked for, so ten guests uploading at once cannot overshoot together; a failed or abandoned upload releases its count.
- **An event's use** is the sum of its album; **the site's** is every album plus every host's picture. Both are sums over a recorded column, checked at every upload against the limits.
- **Free-disk safety**: on local disk, an upload is refused when the volume has under 1 GB free, whatever the limits say. On S3 there is no such check. **(decided here)**
- **The Storage card** on Site settings: the site's use split into albums and pictures, with the real disk use beside it (local disk: the `uploads` directory's size and the volume's free space; S3: the counted use only); the five events using the most, each with its title, host, use, a link to its manage page and Clear the album; who is processing videos (this container, or the worker and when it was last seen, or "no worker has reported: check it is running"); and the switch Process videos for playback, on by default.
- **After the upgrade**, items and pictures have no recorded size. The first start after it queues a one-time measuring that reads each file's size from storage in the background (disk: stat; S3: a head request) and records it, so the numbers are right from the first day. For photos and pictures the recorded size is what is stored, since what was sent is gone; the docs say this is a close estimate. **(decided here)**

### Clearing up **(maintainer, 2026-11-08: nothing is deleted on a timer)**

- **Empty the album**, in Album settings and on the manage page: one confirmation naming what goes, "Delete 48 photos and 6 videos (11 GB)?", then every item, its files and its queued jobs are gone and the space is freed. Available to a host or co-host with the guests permission.
- **Remind me about the album**, per event: 30, 90, 180 or 365 days after the event ends, or never. New events start with the site's default. On the day, the hourly sweep emails each host once ("The album of Mei's birthday holds 48 photos and 6 videos, 11 GB. Empty it or keep it."), with a link to the manage page, and the manage page and the dashboard show the same notice until the host presses Empty the album (which confirms) or Keep it (which sets the reminder to never). An empty album is never reminded about. Without mail, the notice alone. Nothing happens if the host does nothing.
- **Remind hosts after**, on the Limits card: the default for new events, 60 days or never. **(maintainer, 2026-11-09: 60)**
- **Clear the album**, on the Storage card: the operator confirms as a host would, the items go, and the event's hosts are emailed that the operator cleared the album (with mail). This is the only way an album is emptied without its host, and a person presses it.
- **The sweep** that runs retention every hour also sends the reminders, removes unfinished uploads older than a day, and nothing else. Retention is unchanged: a deleted event takes its items, files and jobs with it.
- **`scripts/storage-check.mjs`**, run in the container as the password-reset command is: lists every file in storage that no item, picture or unfinished upload names, with sizes and a total, and removes them only with `--delete`. It also prints the site's totals per kind. Never automatic.

### Glossary proposals (for the maintainer's `CONTEXT.md`; the tickets do not edit it)

- **Album**: widen to "An event's photos and videos, open from its start to the hosts and to guests whose RSVPs are not pending or declined." _Avoid_ stays: gallery, media.
- **Video**: a clip in an album, kept at original quality with its metadata dropped, and with a lighter copy for slow connections when one is needed. _Avoid_: movie, clip (in the interface), media.
- **Original quality**: the video as recorded, rewrapped. **Lighter copy**: the 1080p or 720p H.264 copy the site makes. _Avoid_: transcode, rendition, stream (in prose).
- **Processing**: what happens to a video between its upload and its first play. _Avoid_: encoding, conversion (in the interface).
- **Album reminder**: the email and notice that ask a host to empty or keep an old album. _Avoid_: expiry, cleanup, purge.
- **Storage**: what a site's uploads take, counted as sent. _Avoid_: quota (in the interface), disk (except for the volume).

### Repository

- Branch `m7-album` from `main` at f000d72 (M6 merged, unreleased). Migrations take the next free numbers from 0046. The `photo` table stays and gains the item's kind, size as sent and, for videos, length, codec, dimensions, whether a copy exists and the states processing and failed **(decided here: no rename; the interface says "photos and videos")**. New tables: `video_job`, `album_upload` (the resumable uploads and their reserved sizes). `upload` (hosts' pictures) gains a size. `event` gains the album's caps, quality, reminder days and when it was reminded. `instance_settings` gains the five limits, the reminder default and the processing switch.
- New files beside the existing ones: `src/album/video.ts` (pure rules: caps, when a copy is needed, the player's fallback), `src/album/jobs.ts` (the queue), `src/album/processing.ts` (ffmpeg and ffprobe), `src/album/uploads.ts` (parts), `src/album/reminders.ts`, `src/storage/usage.ts`, `scripts/video-worker.mjs`, `scripts/storage-check.mjs`, `docs/adr/0007-ffmpeg-in-the-image.md`.
- Docs: `docs/operator/configuration.md` (the Limits and Storage cards, `VIDEO_PROCESSING`, memory, the retired `MAX_UPLOAD_MB`, the storage check), `docs/operator/upgrade-backup.md` ("Upgrading to 0.7": the bigger image, the one-time measuring, the retired setting), the README's "What it does", the release note at `.scratch/m7-album/release-note-0.7.0.md`.

## Testing Decisions

The M1 to M6 testing decisions hold: two seams (the browser against the real app with Postgres and Mailpit, and pure rules called directly), and the definitive run is the Docker test profile with `CI=1`.

- **Pure rules with unit tests**: the caps (an event's under the site's, blank meaning the site's); what counts and the sums; the room check with a count, two sizes and the free-disk rule; whether a copy is needed for each reason; the player's choice and its fallback; the part plan of an upload and resuming it; the reminder day and who is reminded; the job's lease, retries and failure; the storage check's matching of keys to items; the one-time measuring's plan; the refusal messages' units.
- **Browser tests per ticket**, on the Docker test profile, whose image carries ffmpeg: two checked-in clips of two seconds, one H.264 MP4 (rewrapped only) and one HEVC MOV recorded portrait with a location tag (converted, upright, metadata gone, which the test proves by reading the stored file's boxes); the Processing tile, then the ready tile, waited for by the tile's state with a long timeout; the player with both qualities and Download; a clip over the length cap refused in the browser before any request; an upload resumed after a dropped part (the test aborts one part's request and sees the rest arrive); approval and visibility covering a video; the hosts' email naming a video; each limit refused with its message, then a host raising the event's cap and the guest's next try taken; the Storage card's numbers after uploads and after Empty the album; the reminder email in Mailpit and the notice on the dashboard, Keep it ending it; the operator's Clear the album and the hosts' email; the worker mode on its own instance (a `worker` container in the test profile) processing a clip queued by the app; the storage check command listing a planted stray file and removing it with `--delete`. The limits instance tests the storage limits with small values set through Site settings; the no-mail instance tests the reminder notice without email. The accessibility, keyboard, locale and reduced-motion specs extend to the player, the tiles and the new settings.
- Fixtures: the two clips live under `e2e/fixtures/` with a note recording the ffmpeg commands that made them, so they can be remade.

## Out of Scope

- Uploads straight to the bucket on S3 sites **(maintainer, 2026-11-08: declined)**.
- Making retention a reminder: whole events are still deleted a year after they end, with the 30-day warning **(maintainer, 2026-11-08)**.
- Comments or reactions on items; downloading a whole album at once; trimming or editing clips; more than one lighter copy; true HDR colour; hardware-accelerated encoding; iPhone Live Photos and HEIC photos; an access check on `/uploads/{id}/{file}`; selecting many items to delete at once; a storage view for hosts beyond their album's refusals and reminder.

## Further Notes

- The maintainer's design answers of 2026-11-08, in order: clearing up is the operator's and the host's, with retention as the backstop; approach C (server processing) over A (kept as sent) and B (browser re-encoding); all four processing ideas (rewrap when it fits, optional worker, 720p choice, site switch); the check before sending and resumable parts, not direct-to-bucket; the host's cap in minutes and megabytes; the defaults 40 MB, 750 MB, 15 min, 50 GB and 50 GB; originals kept with the viewer choosing; storage counts uploads only; everything changeable on screen at once; caps shown on refusal; human-readable units; the album period is a reminder, never a deletion.
- The maintainer's spec review of 2026-11-09: the viewer's quality choice is remembered per device and there is no host default; a copy only when needed stands, as does the free-disk rule; the reminder default is 60 days; the `photo` table stays (every file is named after its item's id, ADR-0004, so two guests' IMG_0001.jpg never collide); the one-time measuring stands.
- The plan at `m7-album-plan.md` will order the tickets. The limits and storage accounting come first, since videos need them; the video pipeline next; clearing up last, with the final pass.
- The release note goes in `.scratch/m7-album/release-note-0.7.0.md`.
