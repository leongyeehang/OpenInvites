# OpenInvites 0.6.0

The GitHub release note for tag v0.6.0, written 2026-11-07 in the shape of the 0.5.0 note. For the maintainer to paste when the release is published (docs/releasing.md).

## Only the people you invite

**Invite-only events.** Turn on **Invite-only** in an event's Settings, under Guests, and the
invitation opens only to the people on its invite list. Anyone else who has the link sees a plain
page with nothing on it but your name, and a line telling them to ask you if they have lost their
link: no title, no place, no time, no poster, and no preview card when the link is pasted into a
chat. Guests invited with an email prove it with a six-digit code sent to that address, once on
each new device they open it on, so a forwarded link is no use without the inbox. A guest invited
with only a phone number or a name gets in by their personal link alone; the Invites page marks
those rows, so you know what the list protects. Turning invite-only on adds everyone who has
already replied to the list, so nobody is locked out, and turning it off deletes nothing.

**The invite list grows up.** Each person on it has a name and, if you like, an email and a phone
number, which are filled in for them when they reply. **Add several** takes a whole list at once,
one person per line as `Name, email, phone`. Until a guest has replied, their row has **Copy** for
their personal link and, on a phone or browser with a share sheet, **Share**, which hands the link
to it.

**Personal letters.** Turn on **Personal letters** at the top of the Invites page and write a few
lines to each guest. Their letter shows on their invitation, above the details, in every layout,
headed "For" and their name, and nobody else sees it.

**Invitations by email.** On a site with mail, **Send** on a row emails that guest their invitation
from you: who is inviting them, your letter, when and where, and their personal link. **Send to
everyone not yet sent** does the rest in one go. Each row then says when it was sent, and **Send
again** sends it once more. Every invitation ends with a link that stops further email about the
event; the row then says so.

## The album, your way

**Who sees it.** In the new Album group of an event's Settings, choose who sees the album: every
guest who replied (as before), only the guests who are going, or only the hosts. Guests who may add
photos but not see the album see their own, with a line saying who does.

**Approve photos before they show.** Turn it on and a guest's new photos wait for you, marked
"Awaiting approval" to you and to them, with **Approve** and **Delete** under each and in the full
screen viewer. Your own photos show at once. Turning approval off shows everything that is waiting.
You are emailed when photos are waiting, once for each upload, which you can turn off. A guest
whose reply is still waiting for your approval is told the album opens once you approve it.

## The day, as it happens

**The schedule.** A new **Schedule** row in the editor, under About, opens a sheet where you list
the day's items: a time and a title, and if you like an end, a place and a note. They are kept in
order of day and time, and a mistake is named by its row. The event page shows them in every layout,
grouped by day when they span more than one, in the event's time zone (said so when the guest's
device is elsewhere), and follows the clock: what has ended is greyed, and what is on now is marked
**Now**. Change it at any time, even during the event: guests' open pages pick up the change within
a minute. Or choose **Only when the page is opened**, under "Keep guests' pages fresh", and guests'
pages make no background requests at all, which saves their data and battery and keeps your site
quiet: the right choice when the schedule won't change on the day, or the crowd is large.

## Also

- The keyboard reaches every new control: the Schedule sheet's rows (a new row takes the focus),
  the locked page's code form, Approve and Delete in the photo viewer, and Send, Send again, Share
  and the letters on the Invites page, each ringed when it has the focus. Send and Save keep the
  focus once they are done.
- Everything new is in Simplified and Traditional Chinese, and still under reduced motion.

## Upgrading

Nothing to do: three migrations, `0043` to `0045`, run as the app starts, and they only add, so
nothing is back-filled and no existing event changes until its host chooses. Every new setting
starts as events behaved before: invite-only and personal letters off, the album seen by every
guest who replied with photos shown without approval (every existing photo counts as approved),
the hosts' photos email on but silent until approval is on, and a schedule refreshed every minute
once there is one. With mail configured there are three new emails: the invitation, the code on an
invite-only event's locked page, and the hosts' email about photos waiting. The invitation and the
code count against `RATE_LIMIT_MAIL`, as every email a request sends does, and the code is answered
alike whether or not the address is on the list; the photos email comes from an upload, which
`RATE_LIMIT_UPLOAD` bounds. **Photos per event** now counts the photos awaiting approval too.
Without mail, an invite-only event opens only to its hosts and to guests invited without an email.
There are no new environment variables and no new services. See `docs/operator/upgrade-backup.md`,
"Upgrading to 0.6".

## Left out, and why

- **Codes by text message, and guest accounts.** The site has no SMS provider and none is planned,
  so phone numbers are kept but never proven; a pass earned by an emailed code is as safe as an
  account's email check, without anyone signing up.
- **A different poster or look for each guest.** The letter is the personal touch.
- **An access check on uploaded photos' addresses.** A photo's file is served to anyone who has its
  address, which is unguessable and only shown on pages the album's rules let through.
  Comments and reactions on photos are not planned either.
- **Copying the schedule when an event is duplicated, reordering items by hand, and pushing changes
  to open pages.** Items keep to day-and-time order, and a minute's refresh is enough for a party.
- **Emailing invitations to phone numbers, and a preview page for chat apps' link previews** of an
  invite-only event, which shows none.
- Apple and Facebook sign-in, and the M5 work, are still to come.
