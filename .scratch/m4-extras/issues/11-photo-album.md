# 11: The photo album

**What to build:** From the event's start, guests who replied and the hosts add photos to the event's album, shown on the event page with a full-screen viewer; hosts delete any photo, guests their own; the operator limits photos per event.

**Blocked by:** 03 The poster-first guest page

**Status:** ready-for-agent

- [ ] Table `photo` (event ON DELETE CASCADE, upload, `rsvp_id` or `host_id`, created_at); `instance_settings.max_photos_per_event` default 300. Migration. Photo files go through the storage interface and are removed with the row, the event, the RSVP, or by retention.
- [ ] `src/album/` (pure): the album is open from the start (all-day: the date in the event's time zone) on a published event that is not cancelled; who may add and see (an RSVP not Pending or Declined, a host); the limit refusal.
- [ ] Upload: up to ten at a time, the existing pipeline and `MAX_UPLOAD_MB`, a progress line per file, rate limited with uploads.
- [ ] Guest page: a Photos panel ("The album opens on {date}" before the start; a grid after, with Add photos); the instance's settings page gains the limit.
- [ ] Viewer: full screen, arrows and swipe, Escape, the uploader's name, Download (the large rendition), Delete where allowed, focus returned to the thumbnail.
- [ ] Unit tests for the rules. Browser: refused before the start; added after it by a guest; seen by another guest; the limit refusal; deleted by its guest and by the host; gone with the event. Keyboard, accessibility, locale rows.

## Notes for the implementer

- The test helpers can date an event in the past; use that rather than a clock override.
- Commit subject, e.g. `Album: guests and hosts share their photos from the day`.
