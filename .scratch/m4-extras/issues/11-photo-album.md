# 11: The photo album

**What to build:** From the event's start, guests who replied and the hosts add photos to the event's album, shown on the event page with a full-screen viewer; hosts delete any photo, guests their own; the operator limits photos per event.

**Blocked by:** 03 The poster-first guest page

**Status:** done

- [x] Table `photo` (event ON DELETE CASCADE, upload, `rsvp_id` or `host_id`, created_at); `instance_settings.max_photos_per_event` default 300. Migration. Photo files go through the storage interface and are removed with the row, the event, the RSVP, or by retention.
- [x] `src/album/` (pure): the album is open from the start (all-day: the date in the event's time zone) on a published event that is not cancelled; who may add and see (an RSVP not Pending or Declined, a host); the limit refusal.
- [x] Upload: up to ten at a time, the existing pipeline and `MAX_UPLOAD_MB`, a progress line per file, rate limited with uploads.
- [x] Guest page: a Photos panel ("The album opens on {date}" before the start; a grid after, with Add photos); the instance's settings page gains the limit.
- [x] Viewer: full screen, arrows and swipe, Escape, the uploader's name, Download (the large rendition), Delete where allowed, focus returned to the thumbnail.
- [x] Unit tests for the rules. Browser: refused before the start; added after it by a guest; seen by another guest; the limit refusal; deleted by its guest and by the host; gone with the event. Keyboard, accessibility, locale rows.

## Notes for the implementer

- The test helpers can date an event in the past; use that rather than a clock override.
- Commit subject, e.g. `Album: guests and hosts share their photos from the day`.

## Comments

**2026-11-04, implementing agent (Opus, in the maintainer's session).** Done.

- `drizzle/0040_photo_album.sql`: `photo` (event, exactly one of RSVP and host, width, height, created), cascading from the event, the RSVP and the account; `instance_settings.max_photos_per_event` default 300, on the instance settings page beside the other limits ("Photos per event").
- Files (`album/files.ts`): each photo as `photo.webp` (inside 2048 px) and `photo-thumb.webp` (a 480 px square, cropped by attention), re-encoded so nothing of the camera or the place survives, through the storage interface under the photo's own id, served by the same `/uploads/{id}/{file}` route. They are removed with the row: deleting a photo, an event (`removeEvents`, which retention and account deletion use too), a reply (`deleteRsvp`), or a host's account (their photos on events they co-host, `deleteHostPhotos`).
- `src/album/album.ts` (pure, unit-tested): `albumState` (open from the start, which for an all-day event is its day's first moment in the event's zone, as it is stored; none for a draft, a cancelled event or one with no date), `mayUseAlbum` (hosts, and a guest whose reply is approved), `mayDeletePhoto`, `photosRoom` (ten at once, the operator's limit, how many are left).
- Upload: `POST /api/albums/{slug}`, up to ten photos as multipart, each under `MAX_UPLOAD_MB`, the whole post counted once against the upload limit; each photo's outcome comes back and is shown as a line ("cake.jpg: added", or why not); the limit refusal says how many places are left. Deleting is a server action, not counted against the upload limit (it only takes away what its viewer may).
- Guest page, in all three layouts (a Photos panel on the Poster, a section on the Broadsheet, a bubble in the Thread): "The album opens on {date}" before the start; to someone who may not use it, how many photos and "Reply to see the album and add your photos"; otherwise the grid, oldest first, and Add photos.
- Viewer: full screen, previous and next by buttons, arrow keys and a swipe, "Photo n of m" and who added it, Download (the large rendition), Delete where allowed (confirmed), Escape; closed, the focus is back on the photo's thumbnail, or on the album's heading once it is deleted.
- Messages `EventPage.album.*` and the limit's in all three languages.

Browser: `e2e/album.spec.ts`: before the start the album says when it opens and offers nothing; after it a guest adds two photos, each said added; someone who has not replied sees only the count; another guest views them (arrow keys, who added it, Download, no Delete, the focus back on the thumbnail); the guest deletes hers and the host the other, their files then 404; a photo the host adds goes with the event; axe on the album and the viewer; in Traditional Chinese. `limits.spec.ts` (on its own instance): the photos limit at 1 refuses two at once, takes one, then refuses more. 7 passed, and the limits spec with it.

**2026-11-04, the browser run.** `docker compose --profile test up -d --build --wait` from the working tree of tickets 09, 10 and 11 together, then `CI=1 pnpm exec playwright test --workers=2`, every project: **566 passed, 0 failed, 0 flaky, 2 skipped** (the desktop editor's rows, which set their own viewport, run in the desktop project only) in 58.5 min. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 829 passed (80 files).
