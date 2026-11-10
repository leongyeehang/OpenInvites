# OpenInvites 0.7.0

The GitHub release note for tag v0.7.0, written 2026-11-09 in the shape of the 0.6.0 note. For the maintainer to paste when the release is published (docs/releasing.md).

## Videos in the album

**Add a video as you add a photo.** The album's picker takes videos wherever the host allows them
(on by default, in the Album group of an event's Settings). A clip is checked before a byte goes
up: one over the event's caps is refused on the spot, with the cap and the clip's own length or
size named. The upload goes up in parts and picks up where it dropped, and the album shows a
**Processing** tile to the person who added it and to the hosts until the clip is ready, then a
tile with the clip's length.

**Original quality, and a lighter copy.** Every video is kept at original quality, rewrapped so
that it starts at once, with the phone's location and device details dropped. When the original
would not play everywhere or weigh lightly (it is not H.264, it is larger than the event's chosen
quality, or far above its bit rate), the site makes a lighter copy, at 1080p or, if the host
chooses to save space, 720p. The viewer plays a video with the browser's own player, offers
**Original quality** and **Lighter copy** when both exist, remembers the choice on the device,
falls back to the copy where the browser cannot play the original, and offers **Download** of the
original. Approval and who sees the album cover videos as they cover photos, and the hosts' email
about items awaiting their approval names them.

**Processing where it suits the site.** ffmpeg is in the image (ADR-0007), so nothing has to be
installed; the app processes one clip at a time, and the operator can turn the lighter copy off
on the Storage card or move the processing to a second container from the same image with
`VIDEO_PROCESSING=worker`, which the Storage card then reports on.

## Every limit on Site settings

**Largest photo, largest video, longest video, storage per event, storage for the site.** The
Limits card sets them all (40 MB, 750 MB, 15 minutes, 50 GB and 50 GB by default), in effect at
once, so an operator can raise a cap while a guest waits and the guest's next try goes through.
A host sets a shorter or smaller cap for their event in Album settings, under the site's. Storage
is counted as uploaded; the lighter copy, the poster frame and the thumbnails never count. The
`MAX_UPLOAD_MB` variable is retired: its value is read once into Largest photo.

**A Storage card.** How full the site is: what albums and hosts' pictures take, what the disk
really holds and has free, the five biggest albums with their hosts, whether the server can
process videos, and the lighter-copy switch.

## Clearing up, by a person

**Empty the album.** In an event's Settings, a host empties the album in one confirmed step that
names how many photos and videos go and how much space they free.

**A reminder, never a deletion.** A host picks when to be reminded about the album after the event
(the site's default is 60 days; or never). On that day the hosts are emailed and the manage page
and the dashboard show the notice, with **Empty the album** and **Keep it**. Nothing is deleted on
a timer, and existing events have no reminder until their host chooses one.

**The operator clears an album, and finds stray files.** On the Storage card each of the biggest
albums has **Clear the album**, confirmed with what goes; its hosts are emailed. **Check for stray
files** lists what storage holds that no photo, video or picture names, older than an hour, and
removes it on a second confirmation.

## Also

- The keyboard reaches every new control: the quality control under the player, the reminder's
  select and Keep it, Empty the album and its confirmation, Clear the album and the stray files'
  Remove, each ringed when it has the focus.
- Everything new is in Simplified and Traditional Chinese, and still under reduced motion.

## Upgrading

Nothing to do: seven migrations, `0046` to `0052`, run as the app starts, and they only add. The
image is about 130 MB larger because it carries ffmpeg. Sizes of photos and pictures from before
0.7 are measured once, in the background, after the first start; the Storage card says how many
are still to be measured until it is done. `MAX_UPLOAD_MB` is read once into Largest photo and
then ignored; a site that never set it starts at 40 MB where it had 10. Every other limit starts at
its default, existing events have no album reminder, and every other setting stays as events
behaved before. With mail configured there are two new emails: the album reminder to an event's
hosts, and the hosts' email when the operator clears their album. No new environment variable is
required; `VIDEO_PROCESSING` is optional, and `compose.yaml` gains no service unless you add the
worker it describes in a comment. See `docs/operator/upgrade-backup.md`, "Upgrading to 0.7".

## Left out, and why

- **Uploads straight to the bucket on S3 sites.** Declined: every upload goes through the app, which
  checks it, and S3 stays interchangeable with local disk.
- **Deleting whole events on a shorter timer.** Retention stays as it is: events are deleted a year
  after they end, with the 30-day warning; the album's reminder deletes nothing.
- **Comments or reactions on items, downloading a whole album at once, trimming or editing clips,
  more than one lighter copy, true HDR colour, hardware-accelerated encoding, iPhone Live Photos and
  HEIC photos, an access check on uploaded files' addresses, selecting many items to delete at once,
  and a storage view for hosts beyond their album's refusals and reminder.**
- Apple and Facebook sign-in, and the M5 work, are still to come.
