# OpenInvites 0.8.0

The GitHub release note for tag v0.8.0, begun 2026-11-11 by M8 ticket 16 in the shape of the 0.7.0
note, with the Voting section; ticket 23 added the glass part's. The media part (tickets 01 to 09)
and the sections part add their own sections, and the Upgrading paragraph is completed with them.
For the maintainer to paste when the release is published (docs/releasing.md).

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

**Also.** The keyboard reaches every star, the award picker, the viewer's star and the Voting
block's controls, each ringed when it has the focus; everything new is in Simplified and
Traditional Chinese, and still under reduced motion. The operator switches Voting off for the
whole site on the Features card: nothing is deleted, and every album then shows who added each
item, as before 0.8.

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
guest list. Every page is checked at a phone's width and a desktop's, by keyboard, and in English,
Simplified and Traditional Chinese.

## Upgrading

The voting migration, `0062`, adds the awards and votes tables and four columns to each event,
with every existing event's vote off and names shown as they were. A press of a star counts
against the new, optional `RATE_LIMIT_VOTE` (120 in ten minutes). See
`docs/operator/upgrade-backup.md`, "Upgrading to 0.8".

The posters chosen on Site settings' Home page card now dress the signed-out pages, the notice
pages and Site settings too, so a site that keeps one poster for its home page shows that one
there as well. Migration `0063` adds the `host_look` table, which holds the poster a host picks in
the Backdrop card; it starts empty, and every host is on Automatic.

## Left out, and why

- **One vote per person rather than per reply.** A person who replies twice under two names has two
  sets of votes; approving each guest, or letting only guests invited personally vote, is the
  host's remedy, and removing a reply from the guest list removes its votes (declining it does
  not).
- **More than eight awards, votes for second and third choices, and a vote on anything but the
  album.**
