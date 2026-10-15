# OpenInvites M2: the social layer

Written 2026-10-07 from `.scratch/openinvites/decisions.md` (the grilling session of 2026-09-19 and 2026-09-20, the prototype verdict of 2026-09-21, and the maintainer's later rulings) and from what M1 built. Where the decisions log already decided something, this spec repeats it and does not reopen it. Where the log was silent, the choice is marked **(decided here)** and the maintainer may overrule it before the ticket that carries it starts.

The M1 spec (`.scratch/openinvites/spec.md`) stays binding for everything it covers. This spec only adds to it.

## Problem Statement

M1 made the invitation: a host publishes a themed event page, guests reply, the host sees who is coming. The party is still a one-way street. Nothing reaches a guest after they reply, so a changed time or a "bring a jacket" has to go through WhatsApp again. Nobody but the host can manage the event. Guests cannot talk to each other on the page. The host learns of replies only by opening the guest list. Two of the three layouts the prototype settled, and the effects every template already names, are stored but not rendered.

## Solution

M2 adds the social layer the decisions log lists, in the order it can be built and released:

1. **Mail that reaches guests and hosts.** The host is emailed when a guest replies. Guests who gave an email get the cancellation notice, the host's announcements, and automatic reminders. The host can send a reminder now. Every email to a guest says why they got it and offers a one-tap way to stop.
2. **More than one host.** A host shares management of an event with co-hosts through a link.
3. **Conversation on the page.** Guests who have replied comment; hosts are told and can moderate.
4. **Host conveniences.** Sign in with a link emailed to you. Multiple-choice questions. Duplicate an event. See how often the page was opened.
5. **The look, completed.** Effects render. The Broadsheet and Thread layouts ship. The background gallery offers backgrounds derived from the host's own picture.

Each ticket is releasable on its own. M2 may go out as several minor releases.

## User Stories

Numbering continues from the M1 spec, which ended at 104.

### Host: knowing what happens

105. As a host, I want an email each time a guest replies, changes their status, or removes their RSVP, saying who and what, with a link to the guest list, so that I feel the party filling up without checking.
106. As a host, I want to turn those emails off for one event, so that a big event does not flood my inbox.
107. As a host, I want to see how many times the event page has been opened, so that I know whether the link is getting around.

### Host: reaching guests

108. As a host, I want to post an announcement that appears on the event page and is emailed to the guests I choose by status, so that "the gate code is 1234" reaches the people who are coming.
109. As a host, I want to see my announcements with when they went out, and delete one, so that a mistake does not stay on the page.
110. As a host, I want guests who gave an email to be reminded automatically, a week before if they said Maybe and the day before if they said Going, so that I do not have to chase anyone.
111. As a host, I want to turn automatic reminders off for one event, so that a casual event stays casual.
112. As a host, I want a "send a reminder now" button that drafts a reminder for me to send as an announcement, so that a nudge is two taps.
113. As a host, I want guests who gave an email to be told when I cancel, so that nobody turns up.
114. As a host, I want to be told plainly that guests get email only when I ask for their email on the RSVP form, so that I am not surprised when nobody is reminded.

### Host: sharing management

115. As a host, I want to make a co-host link, share it however I like, and have whoever accepts it become a co-host, so that my partner can manage the event with me.
116. As a host, I want to see my co-hosts and remove one, and to revoke a co-host link that has not been used, so that I stay in control of who manages my event.
117. As a co-host, I want to accept a co-host link while signed in and then see the event in my dashboard, so that I can get to it.
118. As a co-host, I want to do everything the host can do on the event except delete it or change who the co-hosts are, so that sharing is real.
119. As a co-host, I want to leave an event I co-host, so that I am not stuck with it.
120. As a guest, I want to see every host named on the page, so that I know who is behind the invitation.

### Guest: the conversation

121. As a guest who has replied, I want to post a comment on the event page under my RSVP name, so that I can say "I'll bring the cake".
122. As a guest who has not replied, I want to see how many comments there are and that replying lets me read and join them, so that I am nudged to answer.
123. As a guest, I want to delete my own comment, so that I can take back what I said.
124. As a host, I want to delete any comment, so that I keep the page civil.
125. As a host, I want an email when a guest comments, and to turn that off for one event, so that I can follow the conversation without watching the page.
126. As a host, I want to turn comments off for one event, so that a formal event stays formal.

### Guest: mail

127. As a guest who gave my email, I want each email about an event to say why I got it and to offer one tap that stops further email about that event, so that I am never trapped.
128. As a guest, I want email in the language I replied in, so that it reads naturally.
129. As a guest, I want a reminder email to carry the time in the event's zone, the location, the event link, and my own reply, so that it stands on its own.

### Host: account

130. As a host, I want to sign in by having a link emailed to me, when the instance has mail, so that I need no password on a device I rarely use.

### Host: creating and editing an event

131. As a host, I want a multiple-choice question, where a guest may pick several options, so that "which sessions will you join" works.
132. As a host, I want to duplicate an event into a new draft with the same details, look, questions, settings, and picture, so that a recurring dinner is not rebuilt each time.

### Host: the look

133. As a host, I want to choose an effect: none, confetti when a guest says Going, gentle sparkles, or doodles, so that the page has a mood.
134. As a host, I want the Broadsheet layout, an editorial page with a single ballot form, so that a supper club reads like a menu, not a party.
135. As a host, I want the Thread layout, where the invitation reads like a chat with me, so that a kids' party feels playful.
136. As a host, I want the Supper club and Kids' party templates to apply with their own layouts, so that the templates look as they were designed.
137. As a host who uploaded a picture, I want two more backgrounds made from it, a soft blur and a colour wash, so that my page matches my photo without showing it twice.
138. As a guest, I want every effect to stop entirely under reduced motion, so that the page is pleasant, not dizzying.

### Operator

139. As an operator, I want reminders and announcements sent by the app container itself, with nothing else to run, so that self-hosting stays one Compose file.
140. As an operator, I want a rate limit on comments, so that a page cannot be spammed.
141. As an operator, I want the upgrade to 0.3 to change nothing on existing events until their hosts choose, so that nobody's live page changes under them.

## Implementation Decisions

### Architecture

- The module list grows by three: **Mail** gains an outbox and a worker; **Comments** and **Announcements** are new modules; **Hosts** (co-host membership and permissions) is a new module. Everything else extends an existing module. Route handlers and server actions stay thin.
- No new runtime dependency. Effects are CSS animations and the Web Animations API, not Motion. Thread's typing indicator is CSS.
- No AI or external model API anywhere (decisions log). Thread is fully scripted.

### Mail outbox and worker **(decided here)**

- Every email about an event, to a guest or to a host, is written to a `mail_outbox` row (recipient, subject, plain-text body, event, when to send, attempts so far, last error) and sent by a worker inside the app process. Better Auth's own emails (verification, password reset, magic link) stay as they are: sent inline, because the person is waiting for them.
- The worker starts from `instrumentation.ts` after the start checks, runs every minute, and also runs at once when an action has just queued mail (so an announcement is in guests' inboxes within seconds). Each run claims due rows with `SELECT … FOR UPDATE SKIP LOCKED`, so two app containers on one database never send the same mail twice. A row that fails is retried after 1, 5, 15 and 60 minutes; after the fifth failure it is dropped and the failure is logged with the recipient's address redacted to its domain. A row that sends is deleted. Deleting an event deletes its unsent mail.
- Without SMTP there is no worker and nothing is queued; every place that would queue checks `isMailConfigured()` first, as today.
- The worker also queues due reminders (below).
- Why not send inline: an announcement to two hundred guests takes minutes over SMTP, and a guest's RSVP must not fail because the host's mail server is slow.

### Guest mail **(decided here, within the log's rules)**

- Only guests with an email on their RSVP get mail, and only when the instance has mail. The email field exists only when the host asked for it (`askEmail`). The event form says so beside the reminder and announcement settings when `askEmail` is off: "Guests get email only if you ask for their email on the RSVP form."
- Every email to a guest ends with why they got it and a link. The link opens a small page that shows the address on file and one button, "Stop emails about this event", which blanks the email on their RSVP. The page is `/m/<mail token>`; the button posts. A GET never changes anything, because mail clients prefetch links. The guest can add the email back by editing their RSVP.
- The mail token is a second random token on the RSVP (`rsvp.mail_token`, unique), made when an email is first saved on it. Unlike the edit token it is stored in clear, because the worker must put it in emails long after the guest's request is over, and because the only thing it opens is a page that can blank an email. It never edits or reveals an RSVP.
- An RSVP records the locale the guest replied in (`rsvp.locale`), and the guest's mail is in that language. The host's own words (an announcement) are sent as written.
- Mail about an event to its hosts is in the language the event was last saved in (`event.locale`, set whenever the host saves the event form), since no request is running when the worker sends it.

### Host notifications

- **Replies** (story 105): when a guest's RSVP is saved for the first time, when its status changes, or when it is removed, every host of the event is queued one email: the guest's name, status, plus-ones, and a link to the guest list. Edits that change only details (name, plus-one names, answers) send nothing. Per-event setting `notifyOnRsvp`, default on **(decided here)**.
- **Comments** (story 125): one email per new comment to every host, with the comment and a link to the page. Per-event setting `notifyOnComment`, default on.
- Hosts who comment on their own event are not notified of their own comment.

### Announcements

- An announcement is plain text, up to 2000 characters, line breaks kept, no formatting. At most ten per event (decisions log). Hosts and co-hosts create and delete them on an announcements page under the event (`/events/[id]/announcements`), which lists them newest first with when they were sent and to whom.
- The audience is a set of statuses, checkboxes Going, Maybe, Can't go, default Going and Maybe **(decided here)**. The page tells the host that everyone who opens the event link reads announcements on the page, and the email goes to the guests they pick who gave an email.
- Every announcement appears on the event page, in every layout, under a heading "From the host", newest first, each with its date. Drafts have none; a cancelled event keeps them.
- **Send a reminder now** (story 112) is a button on the announcements page that fills the form with the reminder text in the host's language (the event's title, date and time in its zone, location, and the event link). The host may edit it, then sends it as an announcement. It counts toward the ten.
- Creating an announcement counts once against the `mail` rate limit, however many guests it reaches.

### Automatic reminders

- Fixed cadence (decisions log): one week before the start to guests who said Maybe, one day before to guests who said Going. One per-event toggle, `remindersEnabled`, default on **(decided here)**.
- A reminder is due when now is past its time but less than 24 hours past it, and the event was published before that time, so an event published five days out never sends the week reminder, and a reminder that was missed for more than a day (reminders turned on late, an instance that gains mail, a long outage) is not sent, because "in a week" or "tomorrow" would no longer be true **(the 24-hour window decided 2026-10-07)**. `event.publishedAt` records when the host published; the migration fills it in for existing published and cancelled events from `updatedAt`. Each reminder is sent once per event, recorded as `weekReminderSentAt` and `dayReminderSentAt`. Guests who reply after a reminder was sent do not get it.
- No reminders for drafts or cancelled events, for all-day events the rule uses midnight in the event's zone, and an event whose reminders are turned off after one was sent sends no more.
- The due rule is a pure function of the event and the clock, with unit tests.
- The reminder email (story 129) carries the title, when (in the event's zone), where, the event link, the guest's own reply, and the stop link.

### Cancellation notice

- Cancelling a published event queues one email to every Going and Maybe guest with an email (decisions log: "emailed guests notified once M2 exists"): the title, that it is cancelled, and the event link. Can't go guests are not told **(decided here)**.

### Co-hosts

- A co-host is a host account that shares management of an event (CONTEXT.md). Membership lives in `event_host` (event, host, added at). The event's creator stays `event.hostId` and is its owner.
- Co-hosts are added by a **co-host link** **(decided here)**: single-use, expires in seven days, shown once to the host who made it, revocable. The host shares it as they share the event link. A link is accepted at `/co-host/<token>` by a signed-in host; a visitor who is not signed in is sent to sign in first and comes back. A co-host link admits nobody to the instance: on an Invitation-only instance a person without an account needs a host invitation from the operator first, and the page says so. The owner cannot accept their own link.
- At most ten co-hosts per event **(decided here)**. Co-hosts and pending links are managed at `/events/[id]/hosts`, by the owner only. A co-host may leave from the same page.
- Powers: a co-host can do everything the owner can on the event (edit, publish, cancel, design, questions, guest list edits, announcements, comments moderation, share, reset the link, duplicate) except delete the event and manage co-hosts. The rule is one pure function, `can(role, action)`, with unit tests, and every event action goes through one gate that answers owner, co-host or nothing.
- The event page says "Hosted by" every host, owner first, then co-hosts in the order added, as a list in the viewer's language (Intl.ListFormat).
- Co-hosted events appear in the co-host's dashboard, marked "Co-host", in upcoming and past as usual.
- Deleting a co-host's account removes their memberships; the events stay. Deleting the owner's account deletes their events as today, co-hosted or not; the delete-account confirmation says so.
- Notifications to "the host" (replies, comments) go to every host of the event. Mail about co-hosts themselves (added, removed) is not sent.

### Comments

- A comment is plain text, up to 1000 characters, line breaks kept, posted by a guest who has an RSVP on this device (any status) under their RSVP name, or by a host under their display name with a "Host" mark. It belongs to the RSVP or the host that wrote it. Removing an RSVP removes its comments **(decided here)**; deleting an event removes all.
- Visibility **(decided here)**: hosts and guests who have replied see the comments; a guest who has not replied sees "N comments" and "Reply to join the conversation". This is the same locked-reward rule as the guest list and does not depend on the guest list visibility setting.
- A guest deletes their own comment; a host deletes any (decisions log). A cancelled event shows its comments and takes no new ones. Comments are in order of posting, oldest first.
- Per-event setting `commentsEnabled`. New events default on. Events that exist when the instance upgrades start off, so no live page changes under its host (story 141) **(decided here)**.
- Caps and limits: 500 comments per event; a `comment` rate limit, `RATE_LIMIT_COMMENT`, default 30 per 10 minutes per client.
- No live refresh of comments; the page shows them as loaded.

### Magic-link login

- Better Auth's magic-link plugin, offered on the sign-in page as "Email me a sign-in link" only when the instance has mail. The link is valid for 15 minutes and signs the host in on the device that opens it.
- It never creates an account (`disableSignUp`): sign-up stays the sign-up page, so the registration mode and the first-account rule are untouched. Asking for a link to an unknown address shows the same "If an account exists here, we sent a link" as a known one.
- Rate limited as signing in and as sending mail.

### Multiple-choice questions

- A fourth question type, `multiple`, with options like single choice; a guest may pick any number; required means at least one. Answers become `answer.values text[]`, replacing `value`; the migration wraps every existing value in a one-element array. The guest list shows the picks joined in the viewer's language (Intl.ListFormat). `answersStillOffered` drops each pick the question no longer offers and keeps the rest.

### Duplicate event

- "Duplicate" on the manage page makes a new draft owned by the host who clicks, with a new slug, and opens its manage page. Copied: title with "(copy)" appended in the host's language, times, zone, all-day, location, description, theme, questions in order, every per-event setting, and the picture (the renditions copied in storage under a new upload id, the sample copied with them). Not copied: RSVPs and answers, comments, announcements, co-hosts, views, reminder marks, `publishedAt`. The Storage interface gains `copy`.

### View count

- `event.views` counts document requests for the event page of a published or cancelled event by anyone who is not one of its hosts. Prefetches, RSC data requests, the preview card and the calendar file do not count. Link unfurlers that fetch the page do count; the manage page says "opened" rather than "viewed by people". Shown on the manage page.

### Effects

- The `effect` knob is rendered and appears in the drawer's Details, with the four values the theme already stores: none, confetti, sparkles, doodles. Templates keep the effects they already name. Events that exist when the instance upgrades are set to no effect, with their theme marked "custom, started from" its template, so no live page starts to move under its host (story 141); the host picks an effect when they want one **(decided 2026-10-08, after the whole-branch review)**.
- **Confetti** falls once, from the top of the viewport, when a guest's answer is saved as Going (not Maybe or Can't go, not on edits that keep Going), in the accent and the page's text colours. **Sparkles** are an ambient twinkle of about two dozen points over the backdrop, deterministic so they render on the server. **Doodles** are a few floating accent-coloured shapes in the backdrop on every layout and, on the Poster layout, the date sticker tilted as in the prototype.
- Under reduced motion nothing moves: confetti does not fall, sparkles and shapes do not render, the sticker sits still (still tilted). The reduced-motion browser test covers each.
- The preview card never shows effects.

### Layouts

- `OFFERED_LAYOUTS` becomes all three. The layout row offers them with their sketches; "coming soon" goes. `applyTemplate` applies a template's layout as stored, so Supper club applies as Broadsheet and Kids' party as Thread. Themes already saved keep the layout they hold (poster), so no existing page changes.
- The RSVP flow's rules (steps, skips, validation, replacement, withdrawal, cookies, refusals) are one implementation shared by every layout; each layout presents them in its own way. If sharing needs the Poster flow's state machine pulled out of its components, that targeted refactor is part of the Broadsheet ticket.
- `rsvpStyle` is a Poster knob; the drawer hides it under other layouts, and the stored value is kept.
- Every layout shows: the hosts, when (with the viewer's time and the countdown), where (with the map link), the description, the guest list and headcount under the visibility rules, announcements, comments, add to calendar, the draft, cancelled and retired notices, and the Design drawer for the host. Every layout works at 390 pixels and at desktop width, in every template, under every text tone, and passes the accessibility checks the event page already has.

#### Broadsheet (from the prototype's `layout-broadsheet.tsx`)

- Editorial page, at most 64rem wide. A masthead rule carries "Invitation" and "Hosted by …" in small uppercase mono. One very large title (or the poster, with the title on it or below it). A facts grid with rules: When, Where (with the map link), Host (with the headcount), Countdown (a large number and "days to go" or "hours to go"). The description under a "The details" rule, in two columns on wide screens. The guest list typeset as a numbered list with plus-ones as "+N", "you" marked, blurred until the guest replies under the after-reply setting, and Maybe as a line beneath.
- The ballot: a glass card, sticky on desktop beside the text, holding a radio list ("I'll be there", "Maybe", "Can't make it"), then name, plus-ones stepper with names when required, questions, and "Post my reply". The confirmation sits in the same card: a tilted "Received" stamp in the accent, the status, the summary, calendar links, the edit link with Copy, and "Amend reply", "Change answer", "Remove my RSVP".
- The prototype's pull quote and "Reply by" have no field behind them and are not built.

#### Thread (from the prototype's `layout-thread.tsx`)

- The invitation as a chat, at most 28rem wide. A sticky header: the owner's initials in the accent, the hosts' names, "Invitation · N replies" when the guest list is open to this viewer and "Invitation" alone otherwise (a locked or hidden list gives away no numbers; decided 2026-10-08). Then host bubbles in order: the card (the background with "You're invited", the title and the date, or the poster), the description, When (with the viewer's time and the countdown as a pill), Where (with an "Open in Maps" chip), Who's coming (names when unlocked, an avatar pile and "Reply to see names" when locked, no bubble under the hidden setting, as the other layouts show nothing then), announcements as dated bubbles, then "So, can you make it?" (or the cancelled or draft line).
- The guest replies with chips and a composer at the bottom: Going, Maybe, Can't go chips; the name in the composer; plus-ones as chips "Just me", "+1" …; each question one at a time, a composer with Skip for an optional text question, chips for single choice, toggling chips and a Done chip for multiple choice; then the done bubble ("You're in, Mei! …", "Noted as a maybe …", "Sorry to miss you …") with "Copy edit link" and the calendar chips, and the action chips "Change my answer", "Edit my details", "Remove my RSVP".
- Every host line is a fixed translated string keyed to the flow's state; the host writes none of it. A typing indicator shows for about 650 ms before each host bubble after the first six; under reduced motion bubbles appear at once and nothing animates.
- Comments appear after Who's coming as one bubble, "N comments", that expands into the comments section.

### Derived backgrounds

- When the event has an upload, the background gallery offers two more tiles after the host's picture, under "From your picture": **Soft blur** and **Colour wash**. They are backgrounds with the ids `upload-blur` and `upload-wash`, valid only while the event has an upload; `parseThemeChange` accepts them only then, and `resolveTheme` falls back to the default background if the upload is gone.
- Soft blur is the upload's existing `posterCopy` rendition blurred by the page as it already is behind a poster, with the extremes already measured for it (`posterLightest`, `posterDarkest`) and the upload's luminance and accent. No new processing.
- Colour wash is a gradient from the upload's sample: darkest at one corner through the accent to lightest at the other. Its luminance is the mean of its stops' luminances on the same scale every stored background luminance uses (the sampler's luma of encoded values, which the text-tone line was set on; decided 2026-10-08), and its extremes are its lightest and darkest stops, computed by a pure function with unit tests. No new processing.
- Choosing either puts the picture itself aside, as choosing any background tile does; the picture stays in the gallery. A new upload keeps the choice and shows the new picture's blur or wash. Templates never carry a derived background.

### Operator configuration

- One new variable, `RATE_LIMIT_COMMENT`. The Mail section of `docs/operator/configuration.md` lists what the instance now sends and says the app container sends reminders and announcements itself, a minute at a time, with no extra service. The upgrade guide gets a 0.3 note: comments start off on existing events, reminders and reply notifications start on for events created from now on, existing events get them when their host edits the event.

### Repository

- Translations: English per ticket; Simplified and Traditional Chinese in one pass at the end, as in M1 (ticket 20). Thread's script and every email are strings in the message files.
- The data-file guides (`docs/contributing/`) gain nothing; layouts are code.

## Testing Decisions

The M1 testing decisions hold: two seams, the browser against the real app with a real Postgres and a fake mail server, and pure rules called directly. Nothing at other seams.

- **Mail is observed in Mailpit**, as M1's verification and reset tests do: a browser test triggers the action and polls Mailpit for the email to the right address with the right contents. The worker's one-minute tick and the immediate run after queuing make announcements, notifications and the cancellation notice arrive within seconds in tests.
- **Automatic reminders** get one browser test with a long timeout: an event published to start just over 24 hours from now, so that the day reminder falls due a couple of minutes after publishing (an event published 23 hours out would never remind, by the published-before rule), a Going guest with an email, and the day reminder arriving in Mailpit within two minutes of its time; a second event with reminders off, due a minute earlier, is the fence that proves the switch. The week and day rules, the published-before rule, the 24-hour window, and all-day events are unit tests of the due function.
- **Pure rules with unit tests**: reminders due; the announcement audience; the outbox retry schedule; `can(role, action)` for co-hosts; who sees comments; multiple-choice answer validation and `answersStillOffered` with several picks; what Duplicate copies; which requests count as a view; the colour-wash gradient's luminance and extremes; `applyTemplate` with every layout offered; derived backgrounds resolving with and without an upload; `parseThemeChange` accepting the derived ids only with an upload.
- **Browser tests per feature**: the host's reply notification arrives and stops when turned off; the stop-email page blanks the address and a later announcement does not reach it; an announcement reaches only the chosen statuses and appears on the page; the cancellation notice; send a reminder now; a co-host link accepted, the co-host editing the event, refused from deleting it, the owner removing them, the link revoked; comments posted by a guest and a host, hidden from a guest who has not replied, deleted by each, off when the host turns them off, the host emailed; magic-link sign-in; a multiple-choice question answered with two picks and shown in the guest list; duplicate landing on a draft with the questions and the picture; the view count rising for a guest and not for the host; each effect rendering and stopping under reduced motion; Broadsheet and Thread completing the whole guest flow at 390 and desktop, including questions of every type, the confirmation, edit and withdraw, and the guest list visibility settings; the derived tiles appearing only with an upload and the page painted with each.
- The accessibility, keyboard, locale and reduced-motion specs extend to every layout and to the comments and announcements sections.

## Out of Scope

Everything the decisions log assigns to later milestones:

- M3: capacity and waitlist, guest approval, personal invite links, required email or phone with verification codes, vanity slugs, admin interface, operator limits, Turnstile, retention and automatic deletion, the report-event link.
- M4: photo album, date polling, passkeys, Sign in with Apple, Facebook login, emoji reactions on comments.
- M5: ticketing and payments.

Also out of M2, and not planned: rich text in comments or announcements, replies to comments, guest-to-guest mail, guests choosing a reminder time, email digests, scheduled announcements, co-host roles finer than owner and co-host, host avatars, a "Source" footer link, AI anywhere.

## Further Notes

- The prototype branch `prototype/event-page` (worktree at `.claude/worktrees/agent-a4e08520ae236ba41`, read only) is the primary source for Broadsheet, Thread, confetti, sparkles and doodles, as it was for Poster. Its code is not to be copied; the production layouts are built with the design system and the shared flow.
- The outbox is the first thing in the codebase that runs without a request. It must be the only such thing in M2: anything else that needs a clock goes through the same worker.
- Candidates to pull forward from M3 if M2 finishes early: operator limits on guests per event and events per host (the mail outbox makes an instance a possible spam source, and the decisions log puts the limits in M3), and the report-event link.
- The tracker stays in `.scratch/` until after M4 (maintainer, 2026-09-30).
