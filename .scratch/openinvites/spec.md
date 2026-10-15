# OpenInvites M1: the party

Status: ready-for-agent
Milestone: M1
Written: 2026-09-21, from the grill-with-docs interview (2026-09-19 to 2026-09-21) and the event page prototype.

Primary sources: `CONTEXT.md` (vocabulary), `docs/adr/0001` to `0005` (hard decisions), `.scratch/openinvites/decisions.md` (every product decision, all milestones), branch `prototype/event-page` with `PROTOTYPE.md` (the look, settled by four rounds).

## Problem Statement

People who want to invite friends to a party have two kinds of tools. Consumer apps like Partiful and Apple Invites are beautiful and effortless for guests, but they are closed: Apple's requires a paid iCloud+ plan to host and caps events at 100 guests, Partiful holds every guest's phone number, and neither can be run by you for your own community. Open source alternatives can be self-hosted, but the ones that exist are either scheduling polls and ticket shops, or bare RSVP forms with no themes, no plus-ones, no questions, and a guest experience nobody would proudly send to friends.

A host wants to make an invitation that looks like an occasion, send one link in a chat, and watch the guest list fill up. A guest wants to tap that link on their phone, answer in seconds without creating an account, and get the event into their calendar. An operator wants to run this for many hosts with one Docker Compose file, on a cloud machine or a Raspberry Pi, with nothing phoning home.

## Solution

OpenInvites is an open source, self-hostable invitation service. A host signs up on an instance, creates an event, chooses a template and adjusts its theme, and publishes. The event page is the invitation: one link that works as the invite, the RSVP form, and the place guests come back to. Guests open the link, say Going, Maybe, or Can't go, add their name and plus-ones, answer the host's questions, and receive an edit link to change their mind later. They can add the event to their calendar in one tap and see who else is coming once they have replied. The host watches the guest list and headcount live, edits any RSVP, and can cancel or reset the link at any time.

M1 is everything needed to host one real birthday party well, plus what a public instance cannot retrofit: registration control, email verification, rate limits, legal pages, three languages, and a Docker Compose deployment that upgrades by pulling a new image.

## User Stories

### Host: account

1. As a host, I want to sign up with my email and a password, so that I can create events without depending on any third party.
2. As a host, I want to sign in with Google or GitHub when the operator has enabled them, so that I don't have to remember another password.
3. As a host, I want the login buttons for providers the operator has not configured to be absent rather than broken, so that I am never shown an option that fails.
4. As a host, I want to verify my email before creating my first event when the instance has email configured, so that the operator can trust that hosts are reachable.
5. As a host, I want to reset a forgotten password by email, so that I can get back into my account without help.
6. As a host on an instance without email, I want the operator to be able to reset my password with a command, so that a forgotten password is not the end of my account.
7. As a host, I want to set a display name, so that guests see "Hosted by" a person rather than an email address.
8. As a host, I want to change my email, display name, and password in account settings, so that my account stays current.
9. As a host, I want to delete my account and have every event and every guest's data removed with it, so that leaving is complete and my guests' data does not outlive my use of the service.
10. As a host, I want to stay signed in on my phone and my laptop at the same time, so that I can manage an event from wherever I am.

### Host: dashboard

11. As a host, I want a dashboard split into upcoming and past events, so that I find the one I need at a glance.
12. As a host, I want each event card on the dashboard to show its status (draft, published, cancelled), start time, and the counts of Going, Maybe, and Can't go, so that I see how each event is doing without opening it.
13. As a host, I want to start a new event from the dashboard in one tap, so that creating is never more than a moment away.

### Host: creating and editing an event

14. As a host, I want to give an event a title, a start date and time, an optional end time, and an all-day option, so that guests know when to arrive.
15. As a host, I want to set the event's own time zone, defaulting to my device's zone, so that guests in other places see the right time.
16. As a host, I want to enter a location as free text, so that I can write "Ah Ma's house, 3rd floor" as easily as a street address.
17. As a host, I want a rich-text description with bold, italic, links, bullet lists, and emoji, so that I can write a warm invitation with a dress code and a "bring nothing" note.
18. As a host, I want to save an event as a draft, so that I can fiddle with the look before anyone sees it.
19. As a host, I want to preview my draft exactly as a guest will see it, on my phone, so that I know what I am about to send.
20. As a host, I want to publish an event when it is ready, so that the event link starts working.
21. As a host, I want to edit any field after publishing, so that a changed time or venue is corrected in the one place every guest already has.
22. As a host, I want to add questions to the RSVP form as free text, single choice, or yes or no, each optionally required, so that I learn dietary needs and song requests while guests reply.
23. As a host, I want to reorder and remove questions, so that the form stays short and in the order that makes sense.
24. As a host, I want to set how many plus-ones a guest may bring, from 0 to 10, defaulting to 1, so that the party stays the size I planned.
25. As a host, I want to require the names of plus-ones, so that I know who is coming, not just how many.
26. As a host, I want to choose whether guests see the guest list always, only after they reply, or never, defaulting to after they reply, so that I control how much guests learn about each other.
27. As a host, I want to optionally ask guests for an email address on the RSVP form, so that I can reach them later.
28. As a host, I want to cancel an event so that the page stays up with a cancellation notice and no new RSVPs are taken, so that guests who open the link learn the news instead of finding nothing.
29. As a host, I want to delete an event entirely, after confirming, so that a mistaken or test event leaves no trace.
30. As a host, I want to be warned before deleting an event with RSVPs, so that I never lose a guest list by accident.

### Host: the look

31. As a host, I want to start from one of six templates (Birthday, Vows, Supper club, Kids' party, Festival, Quiet), so that a finished-looking invitation is one tap away.
32. As a host, I want to change any part of the theme after choosing a template and see the theme marked "custom, started from" that template, so that I know what I changed and can go back.
33. As a host, I want to pick a background from a curated gallery of gradients and photos, so that my event looks designed without designing.
34. As a host, I want to upload my own photo and use it as the full-page background, so that the invitation is personal.
35. As a host, I want to upload a poster I made elsewhere and have it shown as the invitation itself, at its own proportions, so that the work I did in another tool is not wasted.
36. As a host using a poster, I want to choose whether the title sits on the poster or below it, so that my poster's own text is not covered.
37. As a host, I want to choose from four title fonts, so that the invitation's voice matches the occasion.
38. As a host, I want the accent colour picked automatically from my background, with six colours to override it, so that buttons and highlights always match the picture.
39. As a host, I want the text colour to adapt automatically to a light or dark background, with a manual override, so that the title is always readable on my upload.
40. As a host, I want to choose the RSVP button style (glass, solid accent, or outline), so that the buttons fit the mood.
41. As a host, I want to choose whether guests answer in a stepper under the buttons or in a sheet that rises over the invitation, so that the flow suits my page.
42. As a host, I want the upload button first, then templates, layout, and background, with the finer knobs tucked under "Details", so that the common choices are obvious and the rest do not overwhelm.
43. As a host on a phone, I want the design controls as a sheet from the bottom, and on a laptop as a side panel, so that I can see the page change while I adjust it.
44. As a host, I want every combination of knobs to look intentional, so that I cannot make an ugly page by accident.
45. As a host, I want to add alternative text to an uploaded background or poster, so that guests using a screen reader know what the picture shows.

### Host: sharing

46. As a host, I want to copy the event link in one tap, so that I can paste it into WhatsApp, Telegram, or iMessage.
47. As a host, I want the link to unfurl in chat apps as a rich preview card rendered from my theme, with title and date, so that the message already looks like an invitation.
48. As a host, I want a QR code for the event link, so that I can print it or show it on a screen at the door.
49. As a host, I want to reset the event link, after confirming, so that a link that leaked stops working and a new one takes its place.
50. As a host, I want the share screen to use my phone's native share sheet when available, so that sending is one tap.

### Host: the guest list

51. As a host, I want to see the guest list grouped by Going, Maybe, and Can't go, with the headcount that includes plus-ones, so that I know how many chairs to set.
52. As a host, I want to see each guest's name, plus-one count and names, answers to my questions, email if given, and when they replied, so that I have everything I need to plan.
53. As a host, I want to change a guest's RSVP on their behalf, so that "put me down as going" said in person is reflected on the page.
54. As a host, I want to remove a guest, so that an unwanted or duplicate entry disappears.
55. As a host, I want the guest list to update without reloading while I watch, so that replies feel live.

### Guest: opening the invitation

56. As a guest, I want to open the event link on my phone and see a beautiful page that loads fast on mobile data, so that the invitation feels like an occasion, not a form.
57. As a guest, I want to see the title, who is hosting, when, where, and the description, without doing anything, so that I know what I am being invited to.
58. As a guest, I want to see the event's time in its own time zone and, if mine is different, in mine as well, so that I never turn up at the wrong hour.
59. As a guest, I want a countdown such as "starts in 3 days", so that the date feels real.
60. As a guest, I want a map link that opens Apple Maps on my iPhone and Google Maps elsewhere, so that I can find the venue in one tap.
61. As a guest, I want the page in my own language, chosen from my browser's settings, with a switcher I can use to change it that remembers my choice, so that the interface reads naturally to me.
62. As a guest opening a link to a draft, I want a clear "this invitation isn't ready yet" page, so that I am not confused by an error.
63. As a guest opening a link to a cancelled event, I want to see the invitation with a clear cancellation notice and no RSVP buttons, so that I know not to come.
64. As a guest opening a link that was reset, I want a clear "this link is no longer valid" page, so that I ask the host for the new one.
65. As a guest, I want animations to be subtle and to stop entirely if my device asks for reduced motion, so that the page is pleasant, not dizzying.

### Guest: replying

66. As a guest, I want to tap Going, Maybe, or Can't go, so that my answer is the first and biggest thing I do.
67. As a guest, I want to give just my name to reply, so that I never create an account.
68. As a guest saying Going or Maybe, I want to say how many plus-ones I bring and, when the host requires it, their names, so that the host can count on us.
69. As a guest saying Can't go, I want to skip plus-ones and questions, so that declining takes two taps.
70. As a guest, I want to answer the host's questions in the flow, with required ones clearly marked, so that I don't have to message the host separately.
71. As a guest, I want to enter my email only when the host asks for it, so that I share no more than necessary.
72. As a guest, I want a confirmation screen that says what I answered and offers "Change my answer", "Edit details", and "Remove my RSVP", so that I am in control of my reply.
73. As a guest, I want an edit link I can keep, and to have the page remember me on this device, so that I can change my answer later without proving who I am.
74. As a guest replying again from the same device, I want my earlier RSVP replaced rather than duplicated, so that the host does not see me twice.
75. As a guest, I want to remove my RSVP entirely, so that I disappear from the guest list if plans change.
76. As a guest, I want to add the event to my calendar in one tap, opening prefilled in Apple Calendar, Google Calendar, or Outlook, so that I do not type the details myself.
77. As a guest, I want the calendar entry to carry the title, correct time zone, location, and the event link, so that I can return to the page from my calendar.
78. As a guest who has replied, I want to see who else is coming and the headcount when the host allows it, so that I know who I will see there.
79. As a guest who has not replied, I want the guest list blurred with a hint that replying unlocks it, when the host has chosen "after you reply", so that I am nudged to answer without being blocked from the invitation.
80. As a guest, I want to be told if I am replying too fast or too often, so that abuse protection is clear rather than silent failure.

### Operator: running an instance

81. As an operator, I want to start the whole service with one Docker Compose file containing the app and Postgres, so that self-hosting takes minutes.
82. As an operator, I want database migrations to run automatically when the app starts, so that upgrading is "pull the new image and restart".
83. As an operator, I want a health endpoint that reports whether the app and its database are ready, so that Compose and my uptime monitor can watch it.
84. As an operator, I want the image to leave HTTPS to my reverse proxy and ship an example Caddy configuration, so that certificates work the way I already do them.
85. As an operator, I want images for amd64 and arm64 published to GitHub Container Registry and Docker Hub on each tagged release, so that it runs on my cloud VM, my Mac, or my Raspberry Pi.
86. As an operator, I want every setting to be an environment variable, so that configuration lives in my Compose file and nowhere else.
87. As an operator, I want the first account created on a fresh instance to become the operator, so that I own my instance without editing configuration.
87a. As an operator, I want an admin settings page only I can open, so that instance-wide choices live in one place.
87b. As an operator, I want to choose a registration mode, Open or Invitation only, defaulting to Invitation only, so that a fresh instance is private until I decide otherwise.
87c. As an operator, I want to create a host invitation as a single-use link, optionally emailed when the instance has mail, so that I can let a friend host without opening registration to everyone.
87d. As an operator, I want to see pending, used, and revoked host invitations and revoke one, so that I stay in control of who can host.
87e. As a would-be host in Invitation only mode, I want the sign-up page to tell me an invitation is needed, and a valid host invitation link to let me through, so that I know what to do.
88. As an operator, I want to configure SMTP once and have verification and password reset emails work, so that hosts can help themselves.
89. As an operator, I want to enable Google or GitHub login by setting their keys, so that hosts get the convenience without me touching code.
90. As an operator, I want uploads stored on a local volume by default with S3-compatible storage as an option, so that a home instance needs nothing extra and a public one can scale.
91. As an operator, I want to set the maximum upload size, so that I control disk and bandwidth use.
92. As an operator, I want rate limits on sign-up, login, RSVP, uploads, and event page requests always on, so that slugs cannot be guessed and forms cannot be spammed.
93. As an operator, I want to provide my own privacy policy and terms pages, with sensible placeholders shipped, so that a public instance is legally presentable.
94. As an operator, I want to add my own analytics snippet through one variable and have nothing load when it is empty, so that I can measure my instance without the project measuring me.
95. As an operator, I want the software to send nothing to the project, so that I can promise my hosts and their guests the same.
96. As an operator, I want a documented backup procedure covering the database and the uploads volume, so that I can restore after a disaster.
97. As an operator, I want a command to reset a host's password, so that I can help a host on an instance without email.
98. As an operator, I want event pages to carry a no-index signal and have no public listing, so that my instance is not a directory of private parties.

### Contributor and maintainer

99. As a maintainer, I want every core flow covered by a browser test that runs in CI against a real database, so that a change that breaks the party is caught before release.
100. As a maintainer, I want the pure rules (slug, headcount, RSVP replacement, calendar file, theme resolution, time zone display) tested directly, so that logic bugs fail fast with a precise message.
101. As a maintainer, I want every interface string in translation files with English, Simplified Chinese, and Traditional Chinese, so that adding a language is adding a file.
102. As a contributor, I want templates to be data files, so that I can contribute a new template without touching application code.
103. As a contributor, I want a README that gets me from clone to running app in under ten minutes, a contributing guide, a code of conduct, and a sign-off convention, so that I know how to help.
104. As a maintainer, I want the AGPL-3.0 licence in the repository before it goes public, so that the project's terms are clear from the first public commit.

## Implementation Decisions

### Architecture

- Single Next.js application (App Router, TypeScript) serving both the host area and the public event pages, per ADR-0002. Tailwind CSS with shadcn/ui primitives, Motion for animation, Drizzle ORM on Postgres, Better Auth for accounts.
- Postgres 18 or newer is required, so that UUIDv7 is generated by the database (ADR-0004). Postgres is the only database (ADR-0001).
- The codebase is organised around a few deep modules with small interfaces: Events, RSVPs, Themes, Questions, Calendar, Storage, Mail, Auth, Uploads, Sharing (preview card and QR), Locale, RateLimit. Route handlers and server actions are thin; rules live in the modules.
- The public event page is rendered on the server with the theme expressed as CSS variables, so that first paint on a phone carries the finished look without a client round trip.

### Identity and access

- Hosts are Better Auth users. Email and password is always enabled. Google and GitHub are enabled only when their client ID and secret are present in the environment; the sign-in page reads the enabled set at request time.
- When SMTP is configured, a host must have a verified email before creating an event; the create button explains why and offers to resend. When SMTP is not configured, verification is skipped and password reset is available only through the operator command.
- Guests have no accounts. An RSVP carries a random edit token, stored hashed. The guest receives it as an edit link and as a cookie scoped to that event, so that returning from the same device finds their RSVP and replying again replaces it. Two guests with the same name are two RSVPs.
- The event link slug is ten characters from a 62-character alphabet generated by a cryptographic random source (ADR-0004). Resetting the link issues a new slug; requests for a retired slug get a dedicated "link no longer valid" page. Event pages send a no-index robots signal.

### Events

- An event stores its start and optional end as instants plus an IANA time zone. All-day events store a date range without times. Display uses the event's zone and, when the viewer's zone differs, shows the viewer's local time as well.
- Lifecycle: Draft → Published → Cancelled, plus Delete from any state. A draft's link renders the "not ready yet" page for everyone but its host. Cancelling keeps the page, shows the notice, and disables the RSVP controls; existing RSVPs remain visible to the host. Deleting removes the event, its RSVPs, answers, and uploads.
- Description is stored as sanitised HTML restricted to paragraphs, line breaks, bold, italic, links, and bullet lists; sanitised on save and again on render. Links open in a new tab with safe relation attributes.
- Per-event settings: plus-ones allowed (0 to 10, default 1), require plus-one names (default off), guest list visibility (always, after reply, hidden; default after reply), ask for email (default off).
- Questions belong to an event, are ordered, have a type (free text, single choice with options, yes or no) and a required flag. Answers belong to an RSVP and are visible only to the host.
- Location is free text. The map link is built on the client: an Apple Maps URL on Apple platforms, a Google Maps search URL elsewhere, both from the same text.
- The countdown is computed on the client from the event's start instant and refreshes without reload; it reads "starts in", "happening now", or "ended".

### Themes and templates

- The theme is stored on the event with these fields, taken from the prototype's type shape (branch `prototype/event-page`):

  ```ts
  type Theme = {
    layout: "poster" | "broadsheet" | "thread";   // M1 stores it, only "poster" is offered
    backgroundId: string | null;                   // a curated background, or null when using an upload
    uploadId: string | null;                       // the host's own image
    uploadMode: "background" | "poster";
    titlePlacement: "on" | "below";                // poster mode only
    font: "serif" | "grotesque" | "display" | "rounded";
    accentOverride: string | null;                 // null means derive from the background
    textTone: "auto" | "light" | "dark";
    buttonStyle: "glass" | "solid" | "outline";
    rsvpStyle: "inline" | "sheet";                 // poster layout only
    effect: "none" | "confetti" | "sparkles" | "doodles"; // stored in M1, rendered from M2
    template: { id: string; dirty: boolean } | null;
  };
  ```

- Templates are data files shipped in the repository, one per template, each setting every knob and naming itself and its blurb. Six ship in M1: Birthday, Vows, Supper club, Kids' party, Festival, Quiet. Applying a template copies its knobs onto the event's theme and records the template as not dirty; changing any knob marks it dirty. Supper club and Kids' party specify the Broadsheet and Thread layouts; in M1 they are shown but apply with the Poster layout, and the layout row shows the two others as "coming soon".
- Curated backgrounds are data too: each has an id, a name, a kind (gradient or photo), its CSS or image, and a pre-chosen accent.
- Accent resolution: the override if set, else the upload's sampled accent if an upload is in use, else the curated background's accent. Text tone resolution: the override if set, else light on dark backgrounds and dark on light ones, from the background's stored luminance. Both are computed on the server when the page renders.
- The effect field is stored so templates can carry it, but M1 renders no effects and does not show the effect knob.

### Uploads and images

- Uploads go through a single storage interface with a local-disk implementation (default, a Docker volume) and an S3-compatible implementation (ADR-0003). The application never touches either directly.
- On upload the server validates type and size, re-encodes the image, and produces the sizes the page needs (a large background, a poster at natural proportions, and a preview-card size). The original is discarded. The server samples the image's average luminance and a dominant accent colour and stores them on the upload record, replacing the prototype's client-side canvas sampling.
- Each upload stores optional alternative text supplied by the host.
- Maximum upload size is an operator setting with a sensible default.

### Sharing

- The preview card (Open Graph image) is rendered on the server from the theme: background, title font, title, and date at the standard card size, cached per event and regenerated on theme or detail changes.
- The QR code is generated on the server as a vector image from the event link.
- The share screen offers copy link, the native share sheet where the browser supports it, and the QR code.

### Calendar

- "Add to calendar" offers a downloadable calendar file and prefilled links for Google Calendar and Outlook on the web. The calendar file carries a stable unique identifier per event, the start and end with the event's time zone, the title, the location, a plain-text rendering of the description, and the event link. All-day events produce all-day entries.

### RSVP flow

- The guest flow's steps, from the prototype: idle → name → plus-ones → questions → done, where choosing Can't go skips plus-ones and questions. The confirmation state offers change my answer (back to idle keeping the name), edit details (back to name), and remove my RSVP (withdraw, which deletes the RSVP and clears the device cookie).
- Headcount is the number of Going guests plus their plus-ones. Maybe is never counted. Counts per status are shown to the host always and to guests according to the visibility setting.
- The host may edit a guest's status, plus-ones, and answers, and may remove a guest. Edits by the host do not invalidate the guest's edit token.
- The host's guest list refreshes live while open, by polling or a server-sent stream; either is acceptable, chosen for simplicity.

### Locale

- Three locales: English (source), Simplified Chinese, Traditional Chinese. Locale is chosen from a cookie set by the switcher, else the browser's language header, else English. Locale is not part of the URL, so an event link is identical in every language.
- All interface strings live in translation files. Dates, times, and numbers use the locale's formatting. Host-written content is shown as written.

### Operator configuration

- Registration mode (Open or Invitation only, default Invitation only) and host invitations are instance settings stored in the database and edited on an admin settings page available only to the operator. The first account created on an empty instance becomes the operator; an environment variable can also promote an account by email at start. Sign-up with email, Google, or GitHub all respect the registration mode. Host invitations are single-use, expire after a fixed period, and can be revoked.
- Everything else is an environment variable: public base URL, database URL, session secret, operator contact address, SMTP settings, sender address, Google and GitHub credentials, storage backend and its settings, maximum upload size, analytics snippet, paths or contents for the privacy policy and terms pages.
- Rate limits are always on, keyed by client address, covering sign-up, login, password reset, RSVP submission, uploads, and event page requests by slug. M1 assumes a single application container and keeps counters in memory behind an interface that a shared store could replace later.
- A command runnable inside the container resets a host's password by email address.
- The health endpoint checks database connectivity and reports ready or not.
- Migrations run at container start before the server accepts requests.
- The analytics snippet, when present, is injected into every page's head. When absent, nothing is injected.
- Nothing is ever sent to the project (ADR-0005).

### Deployment package

- A multi-stage Dockerfile producing a small, non-root image from Next.js standalone output, built for amd64 and arm64.
- A Compose file with the app and Postgres, health checks on both, named volumes for the database and uploads, and an environment file with every variable documented.
- An example Caddy configuration for automatic HTTPS in front of the app.
- Images published to GitHub Container Registry and Docker Hub by CI on every tagged release, with semantic version tags and a moving latest tag.
- Documentation covers first run, upgrading, backup and restore (database dump plus uploads volume), and the password reset command.

### Repository

- AGPL-3.0 licence, README, CONTRIBUTING with the Developer Certificate of Origin sign-off, Contributor Covenant code of conduct. Written before the repository is made public at the end of M1.
- Templates, curated backgrounds, and translations are data files with a documented shape, so contributions to them need no application code.

## Testing Decisions

- A good test observes what a host, guest, or operator can observe, and nothing else. It never asserts on database rows, component internals, or function call order. When a test would need to know how something is built, it is testing at the wrong seam.
- Two seams, agreed with the maintainer:
  1. **The browser.** Playwright drives the real application against a real Postgres and a fake mail server, all started by a test profile of the Compose file, so the tests exercise the same image the operator runs. Every user story above that a person can perform is covered here, including sign-up with verification, creating and publishing an event, applying a template and changing knobs, the guest flow at a 390-pixel-wide viewport and at desktop width, edit and withdraw, guest list visibility in all three settings, calendar download, cancel, link reset, delete account, the language switcher, and the draft and retired-link pages. Accessibility checks run on the event page, the RSVP flow, and the host's create screen. A reduced-motion emulation check confirms animations stop.
  2. **Pure rules, called directly.** Unit tests for slug generation, headcount, RSVP replacement and withdrawal, calendar file contents including time zones and all-day events, theme resolution from a template plus overrides including the dirty flag, accent and text tone resolution from stored luminance, and time zone display. These functions take values and return values, with no database or browser.
- No tests at other seams. Server actions and components are exercised through the browser. Repositories and the storage interface are exercised by the browser tests through the real local-disk implementation; the S3 implementation is tested in CI against a local S3-compatible container once, in a smoke test that uploads and reads back.
- Prior art: none, the repository is new. The first browser test (a guest RSVPs to a published event) and the first unit test (headcount) set the patterns every later test follows.
- CI runs both suites on every pull request and blocks release tags when either fails.

## Out of Scope

Everything assigned to later milestones in the decisions log, in particular:

- M2: co-hosts, comments, announcements, email reminders and the manual reminder, magic-link login, host email on each RSVP, duplicate event, per-event view count, rendering of effects (confetti, sparkles, doodles), multiple-choice questions, the Broadsheet and Thread layouts.
- M3: capacity and waitlist, guest approval, personal invite links, required email or phone with verification codes, vanity slugs, admin interface, operator limits on guests and events, Turnstile captcha, retention and automatic deletion, the report-event link.
- M4: photo album, date polling, passkeys, Sign in with Apple, Facebook login, emoji reactions.
- M5: ticketing and payments.

Also out of scope for M1, and not planned: host avatars, CSV export of the guest list, a subscribable calendar feed, native phone apps, public event discovery, recurring events, GDPR-style data export, headings or images inside the description, any telemetry.

## Further Notes

- No AI or external model API is integrated anywhere in M1, and none is planned for M2.
- The name OpenInvites is a working name; one ticket confirms it before the first public release.
- The party is the acceptance test. M1 is done when the maintainer has hosted their birthday party on their own instance and nothing embarrassing happened.
- The prototype branch `prototype/event-page` is a primary source for the look, not code to reuse. The Poster layout is rebuilt properly with the design system; the prototype's type shape and flow steps are inlined above because they encode decisions.
- The `ui-ux-pro-max` skills (`ui-styling`, `design-system`) are to be used when building the design tokens, the Poster layout, and the design drawer.
- The theme's upload handling should leave room for backgrounds derived from the upload (an ambient blur, a palette gradient), which the maintainer wants to prototype before M2. Storing luminance and a dominant accent on the upload record in M1 is the first step toward it.
- Candidates to pull forward from M2 if M1 finishes early, in this order: confetti on RSVP (the single most delightful moment), the host email on each RSVP, duplicate event.
- Chinese translations are verified by the maintainer, who reads both scripts.
- Postgres 18 is the minimum because of native UUIDv7; the Compose file pins a matching image.
- Later milestones each get their own spec under `.scratch/<slug>/`; this directory holds M1 and the cross-milestone decisions log.
