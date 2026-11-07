# OpenInvites 0.5.0

The GitHub release note for tag v0.5.0, written 2026-11-07 in the shape of the 0.4.0 note. For the maintainer to paste when the release is published (docs/releasing.md).

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

## Every instance opens on an invitation

**The home page is laid out like an event page,** so your instance invites a visitor in: a gallery
poster, a different one each visit; the instance's name as its title; a welcome line under it; a
card saying how the site works (guests only need the link they were sent; hosts sign in, or join
with an invitation); and the way in on a bar at the foot of the screen. **Create an account** is
offered only while registration is Open; Invitation only shows **Sign in** alone. A host who is
signed in goes straight to their events. The footer's **Powered by OpenInvites** links to the
source.

**The Home page card** comes first on Site settings. Give the instance a **name** (up to 40
characters), which is also the home page's browser tab title, the host area's header and the name in
the account emails, and a one-sentence **welcome line** (up to 140). Under **More options**, choose
the posters (all of the gallery, only the ones you pick, or always the same one) and whether the page
says **Run by** with your display name, which is off unless you turn it on. Left alone, the
instance is called "OpenInvites", with a default welcome line in each visitor's language.

**A fresh instance says it is ready,** and asks for the operator account first, with the three
steps ahead and one button, **Create the operator account**. The new operator's dashboard then
opens once on **This site is yours**, pointing to the name, who can sign up, and the limits.

## Your events open as their posters

**The dashboard shows your events as their invitations.** Your next event comes first, large: its
poster, its date, how many are going, maybe and can't go, and, when you approve replies, how many
are waiting for you, in amber so you see it. **Guests**, **Edit** and **Share** are under it. Every
other event is a poster tile under **Coming up**, **Drafts** or **Past**, with one chip (to approve,
cancelled, draft, co-host) and one number (places taken, or who is going). On a phone, Past is one
row you swipe. With no events yet, there is one card: **Start an invitation**.

**A new header on every signed-in page.** The site's name, a **New event** button on every page, and
your initials, which open a menu with **Account**, **Site settings** (for the operator) and **Sign
out**; the Account page has **Sign out** too. The pages sit on a soft tinted background in place of white.

**"Site", not "instance".** The interface calls the installation "this site" (本站 in Chinese), and
Instance settings is now **Site settings**, in the menu under your initials. The address is still
`/instance`, and the operator docs still say "instance".

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
new settings are on the settings page, now called Site settings and found in the menu under your
initials: how many photos an event may hold, 300 by default,
and the Home page card, which starts empty, so the home page says "OpenInvites" until you name it.
You are not greeted as a new operator: the welcome is only for the first account of a new
instance, or an operator who takes over later. There are no new environment variables and no new
services. See `docs/operator/upgrade-backup.md`, "Upgrading to 0.5".
