# OpenInvites M6: invited guests and the day

Written 2026-11-07 (Fable 5.1, in plan mode) from the maintainer's answers that day, `CONTEXT.md`, the M3 and M4 specs and what they built, and three read-only planning passes over the code. Choices the maintainer made are marked **(maintainer, 2026-11-07)**. Where nobody decided, the choice is marked **(decided here)** and the maintainer may overrule it before the ticket that carries it starts.

The M1 to M4 specs and the home page and dashboard specs stay binding for everything they cover. This spec only adds to them, except for two lines of the M3 spec's "not planned unless asked" list, "an invite-only mode where only invited guests may reply" and "invites emailed by the instance", which it supersedes: the maintainer has asked.

## Problem Statement

v0.5.0 ships M1 to M4, the home page and the dashboard. Four things about the guests and the day itself are missing:

1. Anyone who has an event link can open the event page. A host who wants only the people they invited to see the invitation has nothing but approval, which hides the guest list and comments and still shows the poster, the title, the place and the time to whoever holds the link.
2. The invitation reads the same to everyone. A host cannot write to one guest the way a card tucked into an envelope does.
3. The album takes photos from any guest who replied, from the event's start, and shows them to all of them. The host cannot choose who sees the album and cannot look at a photo before it shows.
4. There is nothing on the page about what happens when on the day: no list of items for a party, a wedding or a weekend, nothing that follows the clock, nothing the host can change while the day is on.

Constraints: guests never have accounts (decisions log); the instance has no SMS provider and none is planned (M3, maintainer 2026-10-09), so phone numbers are kept but never proven; mail is plain text through the outbox and every guest mail carries a stop link; the host's and guest's experience must stay as Apple Invites and Partiful feel, with settings out of the way and the poster first.

## Solution

**(maintainer, 2026-11-07)** Four features, one milestone:

1. **Invite-only events.** A per-event setting. When on, the event page opens only to a device that holds a **pass** for one of the event's invites. An invitee with an email proves it on each device they use with a six-digit code emailed to it, the code guests already use; an invitee with only a phone number, or only a name, gets in by their personal invite link alone, and the Invites page warns the host of that. Everyone else sees a locked page that shows nothing of the event but the host's name. Turning invite-only on adds everyone who already replied to the invite list, so nobody who replied is locked out. No guest accounts, no SMS.
2. **Personal letters.** Behind a per-event switch, off by default, the host writes a letter to each invited person. It shows on their invitation above the details, in every layout, and in the invitation email. The invitation can be emailed from the app, one invitee at a time or everyone not yet sent, with the letter and the personal link.
3. **The album: who sees it, and approval.** A per-event choice of who sees the album (everyone who replied, only guests who are Going, only the hosts), and a separate switch to approve photos before they show, with an email to the hosts when photos wait.
4. **The schedule.** The host lists the day's items (time, title, and optionally an end, a place and a note). The event page shows them and follows the clock: past items grey out, the one on now is marked. The host changes the list at any time, even during the event, and guests' open pages pick it up within a minute by default; a per-event setting switches that to "only when the page is opened", saying what it saves.

## User Stories

Numbering continues from the dashboard spec, which ended at 231.

### Invite-only events

232. As a host, I want to make an event invite-only, so that only the people I listed can open the invitation.
233. As a host, I want each person on my invite list to have a name and an email or phone, and to add several at once, so that the list is quick to make.
234. As an invited guest, I want to prove my email once on each device with a code sent to it, so that nobody who merely holds my link can open the invitation.
235. As an invited guest without an email, I want my personal link alone to open the invitation, so that I am not shut out.
236. As anyone else with the link, I want to see only that the invitation is private and how to get in, so that nothing of the event leaks.
237. As a host, I want turning invite-only on to keep everyone who already replied, so that nobody is locked out.
238. As a host, I want to be told which invitees get in by link alone, so that I know what the list protects.

### Personal letters

239. As a host, I want to turn on personal letters for an event and write a note to each invited person, so that the same invitation reads differently to each.
240. As an invited guest, I want to see my letter on the invitation, so that it feels written to me.
241. As a host, I want to email the invitation, with the letter and the personal link, to invitees with an email, one at a time or all at once.
242. As an invitee, I want a link in that email to stop further emails about the event.

### The album

243. As a host, I want to choose who sees the album: everyone who replied, only those going, or only the hosts.
244. As a host, I want to approve photos before they are shown, and to turn that off and show everything waiting.
245. As a guest, I want to see my own photos and know when they are awaiting approval.
246. As a host, I want an email when photos await my approval, which I can turn off.

### The schedule

247. As a host, I want to list the day's items with a time and a title, and optionally an end, a place and a note.
248. As a guest, I want the schedule to follow the clock: past items grey, the current one marked.
249. As a host, I want to change the schedule at any time, even during the event, and have guests' open pages pick it up within a minute.
250. As a host, I want to choose "only when the page is opened" instead, and be told what that saves.

## Implementation Decisions

### Architecture

- The event page, every action and every route that opens an event by its slug ask one gate whether this viewer is in; nothing else about the page changes shape. The gate is a per-request cached function over the session, the RSVP cookie, the invite cookie and the new pass cookie.
- The invite list (`invite`) is the one list of invited people: it gains a phone, a letter and the columns invitation mail needs. There is no second "allow list" table.
- The album's rules split "may add" from "may see"; photos gain a status. The schedule is a child table of the event, like questions and date options, saved as a whole.
- No new runtime dependency. Nothing leaves the instance (ADR-0005). Mail stays plain text through the outbox.

### Invite-only events **(maintainer, 2026-11-07)**

- **The setting.** `event.invite_only` (default off), in the Settings sheet's Guests group: "Invite-only: only people on the invite list can open the invitation", with the hint "They prove their email on each device they use; someone with only a phone number gets in by their link. Guests who already replied are added to the list; those with an email prove it once." and a "Manage the invite list" link to `/events/[id]/invites`.
- **Who is in.** Hosts and co-hosts always. A guest's device is in when it holds a **pass** for one of the event's invites, or when the invite the device stands for (by the invite cookie, or by the RSVP cookie of a reply tied to an invite) has no email. An invite with an email is admitted by a pass alone: never by its link, and never by the reply's edit link, so a forwarded link is useless without the inbox. A pass is a cookie `pass_<eventId>` signed with `AUTH_SECRET` (the invite's id, an expiry one year out, an HMAC), no table, valid only while the invite still exists **(decided here)**.
- **How a pass is granted.** By proving the invite's email with a six-digit code emailed to it, under the rules guests already know (ten minutes, five tries, send again after thirty seconds), once per device; or by opening the personal link of an invite that has no email, which sets the pass at once.
- **The locked page.** A published invite-only event, to a device that is not in, shows a plain page (not the theme, nothing of the event): "A private invitation from {host}", a field for the email the guest was invited with (filled in and read-only when the device opened a personal link whose invite has an email), "Send me a code", then the code field and "Send it again". The answer is the same whether or not the email is on the list: "If that email is on the invite list, a code is on its way." A line for everyone: lost your link, ask the host. The checks run in this order: a draft is "not ready" to anyone but its hosts, as today; then the lock; then a cancelled event's notice, which only those in see.
- **What the lock covers.** The page and its metadata (title "You're invited", no description, no preview image, never any Open Graph on an invite-only event, even to those in); `preview.png` (404 whenever the event is invite-only, since it is cached publicly); `calendar.ics` (404); the report page (sent to the locked page); saving and removing an RSVP; posting, deleting and reacting to comments; voting on a date; deleting and adding photos. Hosts pass everywhere.
- **Identity on a device that is in.** The invite is the guest: name, email and phone are filled in where the event asks for them, the email counts as proven, the reply is tied to the invite, and a reply already made through the invite shows as theirs. Identity is tied by the invite's id, not its token: a reply made before the switch keeps its own edit token, and an invite made for it gets a fresh one **(decided here)**.
- **Turning it on and off.** On: every RSVP of the event with no invite gets one (name, email, phone, the reply linked, opened); these are not capped by the 500 invites a host may make. Off: nothing is deleted. Duplicating an event copies the setting, not the invites.
- **The invite list.** An invite gains a phone (the RSVP form's shape rule), the add form takes name, email and phone, and "Add several" takes one person per line as `Name, email, phone`. Under invite-only, a row without an email says "Anyone with this link can open the invitation".
- **The invitation email.** A new mail kind `invitation`, plain text in the event's language: "{host} invited you to {title}", the letter when there is one, when and where, "Open your invitation: {personal link}", on an invite-only event a line that opening it asks for a code sent to this address, and the stop footer. Sent through the outbox by a per-row Send (then "Sent {date}" and "Send again") and "Send to everyone not yet sent", only when the site has mail and the invite has an email and has not stopped mail. The stop link marks the invite as stopped and keeps the email: it is the proof. A Share button uses the device's share sheet with the personal link, else copies it.

### Personal letters **(maintainer, 2026-11-07)**

- `event.letters_enabled` (default off), a switch at the top of the Invites page: "Personal letters: write a note to each guest, shown on their invitation." It is not part of the Settings sheet, whose every save posts every setting.
- When on, the add form and every row take a Letter: plain text, up to 1000 characters, line breaks kept. The invitation email carries it.
- On the event page, when the viewer's invite has a letter and letters are on: a panel above the details list, "For {name}" and the letter, in every layout (a glass panel on the Poster, a section first in the Broadsheet's paper, a bubble after the card in the Thread). Letters work with or without invite-only.

### The album: who sees it, and approval **(maintainer, 2026-11-07)**

- `event.album_visibility`: `replied` (default, today's rule), `going`, `hosts`; `event.album_approval_required` (default off); `event.notify_on_photo` (default on). In a new Album group of the Settings sheet: "Who can see the album" (Guests who have replied / Guests who are going / Only the hosts), "Approve photos before they're shown", "Email the hosts when photos need approval".
- Who may **add** stays today's rule in every mode: the hosts, and guests whose reply is approved. Who **sees**: the hosts always; under `replied` every guest who may add; under `going` those whose status is Going (a waitlisted reply is not Going, as the headcount counts) **(decided here)**; under `hosts` nobody but the hosts. A guest who may add but not see is shown their own photos under "Your photos", with a line saying who sees the album.
- `photo.status`: `pending` or `approved`. With approval on, a guest's new photos are pending; a host's are approved at once **(decided here)**. A pending photo shows to its guest, marked "Awaiting approval", and to the hosts, marked, with Approve and Remove on the thumbnail and in the viewer; to nobody else. Turning approval off approves every pending photo; turning it on changes nothing. Pending photos count toward the operator's limit, and the locked count counts approved photos only.
- When a guest's upload leaves photos pending, the hosts are emailed once per upload, "{name} added N photos to {title} for your approval", when the setting is on and the site has mail.
- Known limitation, left as is: `/uploads/{id}/{file}` serves any photo by its id, which is unguessable, without an access check.

### The schedule **(the freshness: maintainer, 2026-11-07; the rest decided here)**

- **Data.** `schedule_item`: the event, a position, a day and a start time in the event's time zone (wall-clock, as date options are kept, so a time-zone change keeps 3 pm as 3 pm), an optional end time, a title (up to 80), an optional place (120) and note (500). Up to 50. Kept in day-and-time order; no reordering by hand. `event.schedule_refresh`: `minute` (default) or `reload`. The schedule is not copied when an event is duplicated.
- **The editor.** A fourth row under About in the details list, "Schedule" ("N items" or "Add a schedule"), opening a tall sheet of rows (day, start, end, title, place, note), Add and Remove, saved as a whole on Done; refusals name the row (a missing title, a missing time, an end before the start, too many). At the sheet's foot, "Keep guests' pages fresh": "Refresh every minute while the event is on" (default) or "Only when the page is opened", with the hint under the second: "No background requests: saves guests' data and battery and keeps the site quiet. Pick it when the schedule won't change on the day or the crowd is large."
- **The event page.** A Schedule panel in every layout (after the details on the Poster, after the description in the Broadsheet, after Where in the Thread). Times in the event's zone, with the zone named when the device's differs; items grouped under day headings when they span more than one day. By the guest's clock: an item is **now** from its start until its end, or until the next item starts, or, for the last item without an end, until the event's end; **past** after that; **upcoming** before. Nothing is marked before the day; everything is past after the event's end. Now: an accent ring, a "Now" chip, `aria-current`; past: muted at no less than 70% opacity, with a hidden "Ended". The page hydrates from the server's time and ticks every thirty seconds. Under `minute`, from the earlier of the event's start and the first item's start until the event's end, the page re-reads itself every sixty seconds while its tab is visible; under `reload`, never.
- **The host during the event** edits in the editor as always; there is no editing on the guest page.

### Glossary proposals (for the maintainer's `CONTEXT.md`; the tickets do not edit it)

- **Invite list**: the named people a host has made personal invite links for, each with an optional email and phone. _Avoid_: guest list (that is the RSVPs), contacts, attendees.
- **Invite-only**: a published event whose event page opens only for people on its invite list, each proven by their email on the device they use, or by their personal invite link when the invite has no email. _Avoid_: private (Draft avoids it too), locked, restricted.
- **Pass**: the mark on a guest's device that they are in on an invite-only event. _Avoid_: session, login, token (in prose).
- **Letter**: a host's personal note to one invitee, shown on their invitation and in their invitation email. _Avoid_: message (announcements are messages), note, greeting.
- **Schedule**: the host's list of timed items for the event's day or days, shown on the event page and following the clock. _Avoid_: timeline, agenda, itinerary, programme, run of show.
- **Album** widens: "open from its start to the hosts and to whichever guests the host chose; guests whose RSVPs are not pending or declined may add to it".

### Repository

- New: `src/schedule/{schedule,clock,repository}.ts`, `src/editor/schedule-sheet.tsx`, `src/themes/sections/schedule-section.tsx`, `src/events/use-clock.ts`; `src/album/{visibility,notify-hosts}.ts`; `src/invites/{pass,access,gate,pass-actions,invitation-mail}.ts`, `src/app/e/[slug]/locked-page.tsx` and `locked-form.tsx`, `src/app/(host)/events/[id]/invites/share-invite-link.tsx`.
- Migrations: the schedule (table, enum, column), the album (two enums, four columns), the invites (seven columns). Each takes the next free number when its ticket starts.
- Messages: `Editor.schedule*`, `EventPage.schedule.*`, `EventPage.album.*` additions, `Events.form.album.*`, `Events.form.guests.inviteOnly*`, `Invites.*` additions, a new client namespace `InviteOnly.*`, `EventPage.letter.*`, `EventPage.lockedTitle`, `Mail.{invitation,invitationFooter,pass,photos}.*`, `Events.errors.*` additions.

## Testing Decisions

The M1 to M4 testing decisions hold: two seams (the browser against the real app with Postgres and Mailpit, and pure rules called directly), and the definitive run is the Docker test profile with `CI=1`.

- **Pure rules with unit tests**: the schedule's parsing, sorting and limits; each item's state by the clock (before the day, between items, with an end, the last without an end until the event's end, an all-day event, two items at one time, the day groups, the live window, when to refresh); the album's view per visibility and viewer, the photo scope, the status a new photo gets; the pass (signed, read back, void when altered, expired, for another event or secret); who is admitted; what the event page shows (draft, lock, cancelled); the invite's phone and letter, the pasted lines, an RSVP turned into an invite; the invitation mail's text and footer.
- **Browser tests per ticket**: a schedule saved out of order and shown in order, refused for an end before its start; a live schedule with a past, a now and an upcoming item, by the real clock, in each layout; a host's edit reaching an open page within a minute under `minute` and not under `reload`, with Playwright's clock run forward; the album under each visibility and with approval, the host approving in the viewer, approval turned off showing everything, the hosts' email in Mailpit; an invite with phone and letter, a pasted list, the invitation email with the letter and the link, the stop link; an outsider on the locked page, a code read from Mailpit, a second device asked again, a phone-only link straight in, the routes closed to outsiders, a cancelled invite-only event; invite-only switched on after replies, the warning on a phone-only row; the letter in each layout. The accessibility, keyboard, locale and reduced-motion specs extend to the new sheet, panels and the locked page.
- Time in browser tests is the real clock: items and events are dated relative to `Date.now()`, as the album spec dates events in the past, so the server and the browser agree. `page.clock` is used only to run the refresh interval forward.

## Out of Scope

- Phone codes by SMS, and guest accounts **(maintainer, 2026-11-07)**: a pass is as safe as an account's email check, without the sign-up.
- A different poster, look or card image per guest: the letter is the personalisation.
- An access check on `/uploads/{id}/{file}`; comments or reactions on photos.
- Copying the schedule when an event is duplicated; reordering items by hand; pushing changes to open pages (a minute's refresh is enough for a party).
- Emailing invitations to phone numbers; a click-through page for chat apps' link previews.
- Apple and Facebook sign-in, and M5.

## Further Notes

- Branch `m6-invited` from `main` at be16712 (v0.5.0).
- The plan at `m6-invited-plan.md` orders the tickets: the schedule (01, 02), the album (03, 04), the invites and letters (05 to 09), the final pass (10). The schedule and the album are independent of the invites and may be built first or alongside.
- Planning notes: the full design discussion and the three code-checked planning reports are summarised in the tickets; the maintainer's answers of 2026-11-07 are recorded in the Solution and in each section's marks.
- The release note goes in `.scratch/m6-invited/release-note-0.6.0.md`.
