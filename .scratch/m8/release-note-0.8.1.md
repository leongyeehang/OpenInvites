# OpenInvites 0.8.1

The GitHub release note for tag v0.8.1, for the maintainer to paste when the release is published
(docs/releasing.md), above the whole of the 0.8.0 note (`release-note-0.8.0.md`).

**0.8.1 is the first 0.8 to be published.** The tag v0.8.0 was made on 2026-11-16, but its checks
failed and no image was built for it, so there is no `0.8.0` image to pull. Everything the 0.8.0
note below describes arrives with 0.8.1, with one fix on top. Upgrade from 0.7.0, or from any
older release, as that note's Upgrading paragraph says, to `0.8.1`.

## Fixed since the 0.8.0 tag

**A reply's confirmation offers Remove my RSVP at once.** On the Poster and the Broadsheet the
button was drawn disabled for a moment after a guest's answer was saved, longer on a slow
connection, and a guest going on by keyboard in that moment was taken past it. It is there to
press from the moment the confirmation is drawn, on every layout.

## For those building from source

The S3 storage smoke test compares what it reads back without the memory it used to need, the
browser suite runs in six jobs of about 25 minutes, and a browser test that passes on its second
try is reported in the run's summary and no longer fails the run.
