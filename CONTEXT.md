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
The visual identity of an event page: its background and its title font.
_Avoid_: design, skin, template, style

**Background**:
The full-page image or gradient behind an event page, chosen from the curated gallery or uploaded by the host.
_Avoid_: cover, banner, hero image, wallpaper

### Responses

**RSVP**:
A guest's answer to an event. One guest has at most one RSVP per event, and answering again replaces it.
_Avoid_: response, reply, registration, signup

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

**Guest list**:
All RSVPs for one event, as seen by the host and, when the host allows it, by guests.
_Avoid_: attendee list, RSVP list, roster

### Deployment

**Instance**:
One deployed copy of the software, run by one operator, serving many hosts.
_Avoid_: server, deployment, tenant, site
