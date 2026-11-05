# OpenInvites

An open source, self-hostable service where a host creates an event page and shares its link, and guests respond without needing an account. OpenInvites is the working name until the first public release.

## Language

### People

**Host**:
A registered person who creates and manages events on an instance.
_Avoid_: organizer, owner, creator, user (when a host is meant)

**Guest**:
A person who responds to an event. Guests never have an account.
_Avoid_: attendee, invitee, participant, user

**Co-host**:
A host who shares management of an event they did not create.
_Avoid_: collaborator, editor, co-organizer

**Operator**:
The person who runs an instance and configures it.
_Avoid_: admin, sysadmin, superuser

**Passkey**:
A credential on a host's device that signs them in without their password, made for the instance's domain.
_Avoid_: security key, biometric login

**Host invitation**:
Permission from the operator for one person to become a host on an instance, carried by a single-use link. Unrelated to inviting guests to an event.
_Avoid_: invite, signup link, access code, beta code

### Events

**Event**:
The occasion a host is inviting people to. It has a time, a place, and a look.
_Avoid_: party, invite, invitation (for the event itself)

**Event page**:
The single public page for an event. It is the invitation, the RSVP form, and the place guests return to afterwards.
_Avoid_: invite page, landing page, event site

**Event link**:
The shareable URL of an event page. Anyone who has it can open the event page.
_Avoid_: invite link, share link, magic link

**Question**:
A prompt the host adds to an event that guests answer while responding, such as dietary needs.
_Avoid_: questionnaire, survey, form field, custom field

**Announcement**:
A message a host sends to an event's guests, optionally filtered by RSVP status.
_Avoid_: blast, text blast, broadcast, notification

**Reminder**:
An automatic message sent to guests before an event starts.
_Avoid_: nudge, notification

**Comment**:
A message a guest or host posts on an event page for everyone with access to read.
_Avoid_: post, activity, wall message, discussion

**Reaction**:
One of six emoji a guest who may comment, or a host, gives a comment; one of each per person per comment.
_Avoid_: like, emote

**Date poll**:
The two to six candidate dates a host offers in place of a date, which guests vote Yes, If need be, or No on. It closes for good when the host picks one, which becomes the event's date.
_Avoid_: survey, doodle, vote (for the whole)

**Voter**:
Someone who voted on a date poll, by name, with an optional email. Voting makes no RSVP.
_Avoid_: respondent

**Album**:
An event's photos, open from its start to the hosts and to guests whose RSVPs are not pending or declined.
_Avoid_: gallery (the gallery is the posters'), media

**Draft**:
An event the host is still preparing. Its event link does not work for guests yet.
_Avoid_: unpublished, private, hidden

**Published**:
An event whose event link works for anyone who has it.
_Avoid_: live, public, active

**Cancelled**:
A published event the host has called off. The event page stays up with a notice.
_Avoid_: deleted, archived, closed

**Capacity**:
The maximum number of people, counting guests and their plus-ones, who can be Going to an event. Maybe does not count.
_Avoid_: limit, max attendees, spots

**Waitlist**:
The Going RSVPs that arrived after capacity was reached, kept in the order received and promoted automatically when space opens.
_Avoid_: queue, standby, overflow

**Personal invite link**:
An event link issued to one named guest, so their RSVP is tied to them without asking who they are.
_Avoid_: private link, guest link, unique link

### Look

**Theme**:
The look of one event page: its layout, background, title font, accent colour, text tone, button style, RSVP style, and effect. Every event has exactly one.
_Avoid_: design, skin, style, look

**Layout**:
The arrangement of an event page's parts, chosen from a shipped set such as Poster, Broadsheet, or Thread. Part of the theme.
_Avoid_: variant, template, view, mode

**Poster**:
The invitation's picture at the top of the event page: a gallery poster, an emoji pattern, a colour, or the host's upload, with the title on it or beneath it.
_Avoid_: cover image, flyer, card image, background (the blurred copy behind it is not the poster)

**Gallery poster**:
One of the posters that ship with the software, each bringing a look (title font, title placement, effect, button style). Picking one again restores its look; the host may change any part, and the event's theme is then its own.
_Avoid_: template (what 0.4 shipped), preset, starter

**Background**:
Only what fills the page behind the poster: a colour poster's gradient, or a blurred copy of the poster. It is not chosen on its own.
_Avoid_: cover, banner, hero image, wallpaper

### Responses

**RSVP**:
A guest's answer to an event. One guest has at most one RSVP per event, and answering again replaces it.
_Avoid_: response, registration, signup

**RSVP status**:
Which of Going, Maybe, or Can't go an RSVP says.
_Avoid_: attendance, state, answer

**Plus-one**:
An additional person a guest brings, counted on that guest's RSVP.
_Avoid_: additional guest, companion, +1 (in prose)

**Pending**:
An RSVP on an event with approval turned on that the host has not yet accepted or declined.
_Avoid_: awaiting, unapproved, requested

**Edit link**:
A private URL a guest receives after responding that lets them change or withdraw their RSVP.
_Avoid_: magic link, manage link, token link

**Headcount**:
The number of people expected at an event: every Going guest plus their plus-ones. Maybe does not count.
_Avoid_: attendee count, total guests, guest count, RSVP count (which counts responses, not people)

**Guest list**:
All RSVPs for one event, as seen by the host and, when the host allows it, by guests.
_Avoid_: attendee list, RSVP list, roster

### Deployment

**Instance**:
One deployed copy of the software, run by one operator, serving many hosts.
_Avoid_: server, deployment, tenant, site
