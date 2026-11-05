# OpenInvites 0.5.0 (draft)

## Making an event is now designing an invitation

**New event opens the invitation itself.** There is no form any more. You type the title on the
poster, tap When, Where and About to fill them in, and every change is saved as you make it. Under
the invitation a toolbar opens **Poster**, **Title**, **Theme**, **Effect** and **Settings**: large
swatches in a sheet over a live, half-size copy of the invitation on a phone, or in a panel beside
it on a desktop. **Preview** shows it as a guest will see it, and **Publish** asks only for a title
and a date. Everything the old manage page had (the guest list, sharing, co-hosts, invites,
announcements, duplicate, cancel, delete) is under **More** in the top bar.

**Posters.** Twenty gallery posters for the common occasions (birthdays, dinners, weddings, kids'
parties, nights out, outdoors, holidays), each bringing a title font, accent and effect that suit
it; an **emoji poster** made from up to three emoji on a colour; nine colours; or your own photo or
flyer, as before.

**The guest page puts the poster first.** The details are one clean list under it, and Going, Maybe
and Can't go sit in a bar at the foot of the screen, always within reach. On a desktop the page
stays phone-width in the centre.

## New

- **Reactions.** Anyone who can comment can react to a comment with one of six emoji, see who
  reacted, and take theirs back.
- **Date polls.** Not sure of the date? Offer two to six, and guests answer Yes, If need be or No
  to each with their name. You see the votes by name and pick one: it becomes the event's date,
  everyone who left an email is told, and the page asks for replies as usual.
- **The photo album.** From the event's start, the hosts and any guest who has replied add photos,
  up to ten at a time, and everyone browses them full screen. Hosts can delete any photo, guests their
  own. On an event where you approve replies, a guest can add photos once you've accepted them. The
  operator sets how many photos one event may hold (300 by default).
- **Passkeys.** Hosts can add passkeys on their account page and sign in with a fingerprint, face or
  screen lock. Email and password keep working. Passkeys need the instance on HTTPS.

## Upgrading

Nothing to do: the migrations run as the app starts. No theme is rewritten; every event's theme is
read into a poster when it is shown, so a 0.4 template becomes its gallery poster (Birthday,
Candles; Vows, Rose garden; Supper club, Candlelight; Kids' party, Balloons; Festival, Aurora;
Quiet, Bokeh) with its look. Drafts may now have no date, and an event whose date is being voted on
is published without one; reminders and retention pass over an event until it has a date. The
one new setting, how many photos an event may hold, is on the instance settings page and defaults to
300; there are no new services. See `docs/operator/upgrade-backup.md`, "Upgrading to 0.5".
