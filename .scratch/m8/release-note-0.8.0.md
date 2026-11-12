# OpenInvites 0.8.0

The GitHub release note for tag v0.8.0, begun 2026-11-11 by M8 ticket 16 in the shape of the 0.7.0
note, with the Voting section. The media part (tickets 01 to 09), the glass part and the sections
part add their own sections, and the Upgrading paragraph is completed with them. For the
maintainer to paste when the release is published (docs/releasing.md).

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
album shows.

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
it, or stay shared.

**The host tells guests.** Starting a vote offers "Tell guests voting is open", the Announcements
page with the message written.

**Also.** The keyboard reaches every star, the award picker, the viewer's star and the Voting
block's controls, each ringed when it has the focus; everything new is in Simplified and
Traditional Chinese, and still under reduced motion. The operator switches Voting off for the
whole site on the Features card: nothing is deleted, and every album then shows who added each
item, as before 0.8.

## Upgrading

The voting migration, `0062`, adds the awards and votes tables and four columns to each event,
with every existing event's vote off and names shown as they were. A press of a star counts
against the new, optional `RATE_LIMIT_VOTE` (120 in ten minutes). See
`docs/operator/upgrade-backup.md`, "Upgrading to 0.8".

## Left out, and why

- **One vote per person rather than per reply.** A person who replies twice under two names has two
  sets of votes; approving each guest, or letting only guests invited personally vote, is the
  host's remedy.
- **More than eight awards, votes for second and third choices, and a vote on anything but the
  album.**
