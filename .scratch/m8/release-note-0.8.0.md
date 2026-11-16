# OpenInvites 0.8.0

The GitHub release note for tag v0.8.0, begun 2026-11-11 by M8 ticket 16 in the shape of the 0.7.0
note, with the Voting section; ticket 23 added the glass part's, and ticket 31 the media part's,
the sections part's and the Features section, completed the Upgrading paragraph and read the four
parts through as one note. For the maintainer to paste when the release is published
(docs/releasing.md).

## Sizes, live photos and captions

**Videos in sizes, and a player that picks.** A video is kept at its original size and copied at
the sizes its host ticks in the album's settings, 1080p and 720p (both by default), and at 4K where
the operator turns that on, so that a phone on a slow connection need not fetch the original. The
player's **Size** menu offers Auto, each copy and the original; Auto picks for the screen and the
connection, steps down a size when playback stalls, and remembers a pick on the device. New
uploads are processed before older videos are given their sizes, and **Make missing sizes** on the
Storage card gives every ready video the sizes its event asks for, one at a time.

**HDR in standard colour.** An HDR video's copies, its poster frame and its thumbnail are converted
to standard colour, so they look right on every screen; the original keeps its HDR, and says so in
the Size menu.

**Live photos.** An Android motion photo keeps its few seconds of motion as a live photo, which
plays while it is held or from its Live mark, never by itself, and is a photo everywhere else. On
an iPhone or iPad the album says how to keep a Live Photo's motion: Safari gives a web page only
its still.

**What a host keeps, and captions.** A host may keep when each photo or video was taken, and the
camera, lens and exposure, each a switch in the album's settings and off by default; kept, they
show under the item, and the album can be ordered by when items were taken. Where a picture was
taken is never read, under any setting. Whoever added an item, and any host, can give it a caption
of up to 140 characters, shown in the viewer and read as part of the item's name.

## Voting in the album

**A vote, run from Settings.** A Voting block under the Album group of an event's Settings starts
voting once the album is open, closes it, reopens it, and turns it off after saying how many votes
go. Every guest who sees the whole album votes, or only guests who are going, or only guests
invited personally; hosts always vote. Voting can close by itself at a time the host sets, in the
event's zone, and guests see that time.

**Awards.** Favourite to begin with, and up to eight, each named by the host (Best photo, Best
video, Funniest and Best group shot are a press away) and for photos, videos or both. Everyone has
one vote in each award, given, moved and taken back with a star on each item, in the album and in
the viewer; nobody votes for their own. An award picker above the album chooses which award the
album shows, and wherever an award leaves items out (one for photos alone, or one in a tie-break)
it offers Whole album too, so every item stays in reach.

**Fair while it is open.** Guests see no count until voting closes, and the host chooses whether
guests see who added each item always, once voting closes (the default) or never; what a guest may
not see is left out on the server, so no page carries it. Each guest sees the album in an order of
their own, the same on every visit, so an early upload has no advantage; hosts see the usual order
and every count as it comes.

**The winners.** Once voting closes every item shows its count, the top three wear ribbons, and a
Winners strip heads the album with each award's first to third places. The host sends the winners
to guests from the album with a message already written, naming each award's first place by kind
and by who added it where guests may see that, to edit before it goes. A first place shared can
go to a tie-break among the tied items, with its counts hidden from guests until the host closes
it, or stay shared. Reopening voting ends a tie-break and deletes its votes, so it asks first,
saying how many go.

**The host tells guests.** Starting a vote offers "Tell guests voting is open", the Announcements
page with the message written.

## Poster and glass on every page

**Every page wears a poster.** The pages outside an invitation now look like the invitations the
site sends: a gallery poster blurred behind them, with the words in frosted glass on it. Sign-in and
the other signed-out screens, the co-host link, the notice pages a guest meets (an invite-only
event's locked page, the report form, a link the host has reset, an invitation not ready yet, and
the page that stops email) and Site settings with its reports each wear one of the posters chosen
for the home page, the same on every visit. The pages drawn without the database (not found, too
fast, the privacy policy and the terms of use) wear one of the whole gallery. Above the sign-in
card, the site's name leads home.

**A host's pages wear their events.** The dashboard, Account and New event wear the host's next
event's poster, or the site's until they have one, under a header of glass. An event's guest list,
invites, sharing, hosts and announcements pages wear that event's own poster, colour or picture,
with each page's heading in its title font, and every list is one panel of glass.

**The Backdrop card.** In Account, a host can pick any gallery poster to wear behind their own
pages instead, or leave it on Automatic; an event's own pages keep that event's.

**Nothing moves.** Nothing on these pages moves by itself, whether or not the device asks for
less motion: no drifting colour, no sparkles, no entrances. A sheet or dialog opened over one still
opens with its own entrance.

**Every word proven to read.** The glass is solved for each poster so that text reads at WCAG AA
on it, in both text tones and on a host's busiest picture, and each page's words and focus rings
are measured on screen as well: on a light poster and a dark one, down to the last row of a long
guest list.

## A page the host arranges

**The Arrange sheet.** The editor's toolbar gains Arrange, a sheet with a row for each section of
the event page: the personal letter, the details, the schedule, Who's coming, the announcements,
the comments, the album and the countdown. Move up and Move down put them in the host's order,
saying where each went; a switch turns a section off; and a row opens to rename the section and,
where it has one, to collapse it, so that guests see its heading and how much it holds and open it
with a tap, still open after a refresh. The invitation above the sheet moves as the host arranges
it, every section shown as what guests will see there: the details are edited in place, a Note or
Links opens its own sheet, and every other section opens Arrange at its own row. The Poster, the
Broadsheet and the Thread each draw the host's order in their own way.

**A countdown, notes and links.** The countdown can be a section of its own instead of a line
under When. **Add a section** adds a Note, written in the About editor (with Dress code, Getting
there and Gifts a press away), or Links, a list of buttons to a registry, a playlist or a map, up
to six. A link goes only to an `http` or `https` address, opens in a new tab without telling the
site where it came from, and shows the site's name under its label. Notes and Links belong to the
page alone: never in its preview card, calendar file or any email, nor on an invite-only event's
locked page. A page holds up to ten of them, and a duplicated event keeps them.

**Styles.** The album can be drawn as a grid, a mosaic with the first item large, or a strip
swiped sideways; the comments as a list or as chat bubbles; and Who's coming as names or as
avatars, a circle of initials over each first name. Every style keeps what an album item carries:
a video's length, the Live mark and the album vote's star; the mosaic and the strip also write an
item's caption under it, which the grid, as before, leaves to the viewer.

**One switch for each.** The Comments, Who's coming and the Album are switched in Arrange, and
the Letter's switch there is the Invites page's. "Who can see the guest list" moved from Settings
into Who's coming's row, as everyone with the link or guests who have replied; "Only the hosts" is
now Who's coming switched off. With the Comments off nothing can be posted, and with the Album off
guests see no album and its uploads are refused; nothing in it is deleted, and it is all back once
it is switched on.

**Unchanged until arranged.** An event nobody has arranged keeps its order and everything on it, in
every layout. A few things are drawn a little differently: the Poster's announcements are headed
with a megaphone, and in the Thread the folded comments read "Comments · 3 comments", a guest who has
not replied sees the comments in a wider bubble under a "Comments" heading, the album's heading is
in small capitals, and the bubbles arrive section by section.

## Features

**The operator switches features off.** A Features card on Site settings switches the album, its
videos and the album vote off for every event at once: hosts and guests are not shown them and
their actions refuse. Nothing is deleted, and switching a feature back on brings back everything it
had. Videos and voting need the album; videos also need ffmpeg, which the card reports.

## Also

- The keyboard reaches every new control: the Size menu, a live photo's Live mark, the caption,
  every star, the award picker and the Voting block, the Backdrop card, and the whole of Arrange,
  each ringed when it has the focus; a collapsed section opens by Enter or Space.
- Everything new is in Simplified and Traditional Chinese, and still under reduced motion; every
  page is checked at a phone's width and a desktop's.

## Upgrading

Eleven migrations, `0054` to `0064`, run as the app starts:

- `0054_instance_feature`: the `instance_feature` table, the operator's feature switches; empty,
  so every feature is on.
- `0055_video_sizes`: the `video_size` type, `photo.copies` and `event.album_copy_sizes`. Each
  video's 0.7 copy carries over; an event that chose 720p keeps 720p alone and every other event
  gets 1080p and 720p. It then drops `photo.copy`, `event.album_copy_quality` and the
  `video_quality` type.
- `0056_video_work`: the `video_work` type and `video_job.work`, so the queue can make a video's
  further sizes and a live photo's motion as well as process a clip.
- `0057_video_4k_copy`: the operator's 4K switch, `instance_settings.video_4k_copy`, off.
- `0058_item_details`: `photo.details`, a video's HDR kind and frame rate, empty until processing
  (or Make missing sizes) fills it.
- `0059_item_capture_details`: the `album_order` type, an event's two switches for keeping when
  items were taken and with what camera (both off) and its album order (by when added), and
  `photo.taken_at`.
- `0060_live_photo`: `photo.live`, false for every photo.
- `0061_caption`: `photo.caption`, at most 140 characters; none has one.
- `0062_album_voting`: the awards and votes tables (`album_award`, `album_vote`), four types, and
  four columns on each event, with every existing event's vote off, everyone who sees its album
  allowed to vote, and who added each item shown once voting closes, which for an event that never
  votes is always, as in 0.7.
- `0063_host_look`: the `host_look` table, the poster a host picks in the Backdrop card; empty, so
  every host is on Automatic.
- `0064_event_sections`: `event.sections`, the host's arrangement, empty for every event, which
  draws each layout as before; and `event.album_enabled`, the event's own Album switch, on.

**Update the worker with the app.** A site that processes videos in a second container
(`VIDEO_PROCESSING=worker`) must not run a 0.7 worker beside the 0.8 app, which has dropped the
column a 0.7 worker writes: stop the worker first (`docker compose stop worker`), or let
`docker compose up -d` replace both together. A video from before 0.8 keeps its one copy until
**Make missing sizes** gives it its sizes (and an HDR video its standard-colour copies); no item
from before 0.8 becomes live or has details, as the files kept nothing to read. A press of a star
counts against the new, optional `RATE_LIMIT_VOTE` (120 in ten minutes), and a caption against
`RATE_LIMIT_COMMENT`. The posters chosen on Site settings' Home page card now dress the signed-out
pages, the notice pages and Site settings too. "Who can see the guest list" and the Comments
checkbox have left the editor's Settings sheet for Arrange; each event keeps what it had. No new
environment variable is required, and `compose.yaml` gains no service. See
`docs/operator/upgrade-backup.md`, "Upgrading to 0.8".

## Left out, and why

- **One vote per person rather than per reply.** A person who replies twice under two names has two
  sets of votes; approving each guest, or letting only guests invited personally vote, is the
  host's remedy, and removing a reply from the guest list removes its votes (declining it does
  not).
- **More than eight awards, votes for second and third choices, and a vote on anything but the
  album.**
- **The motion of an iPhone Live Photo.** Safari gives a web page only its still; the album says
  how to add the motion as a video instead.
- **Adaptive streaming, sizes below 720p and an HDR copy.** Sizes are whole files the player
  switches between; HDR stays in the original.
- **Where a picture was taken, in any form.**
- **Drag and drop in Arrange, two-column arrangements, and sections shown only to some guests.**
  Move up and Move down work the same by touch, mouse and keyboard.
- **Separately installed extensions.** Features are modules inside the app (ADR-0008); the album
  becomes one in a later release.
