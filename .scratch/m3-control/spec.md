# OpenInvites M3: control

Written 2026-10-09 from `.scratch/openinvites/decisions.md` (the grilling session of 2026-09-19 and 2026-09-20 and the maintainer's later rulings), from `CONTEXT.md`, and from what M1 and M2 built. Where the decisions log already decided something, this spec repeats it and does not reopen it. Where the log was silent, the choice is marked **(decided here)** and the maintainer may overrule it before the ticket that carries it starts. One choice the maintainer made on 2026-10-09 while this spec was written is marked **(maintainer, 2026-10-09)**.

The M1 spec (`.scratch/openinvites/spec.md`) and the M2 spec (`.scratch/m2-social/spec.md`) stay binding for everything they cover. This spec only adds to them.

## Problem Statement

M1 made the invitation and M2 made it social, but the host still has no say in who comes and how many. An event for forty can collect a hundred Going replies and the host finds out when the chairs run out. A link that leaks lets anyone reply, and the host's only tool is to reset it. A guest's email is whatever they typed. The link is ten random characters that nobody can say aloud. On the operator's side, the instance has no limits beyond rate limits, keeps every event and every guest's details forever, and gives a guest who finds something wrong on a page no way to say so.

## Solution

M3 adds the control the decisions log lists, in the order it can be built and released:

1. **Operator safety.** Limits on events per host and replies per event, set on the instance settings page. A "Report this event" link on every event page that reaches the operator.
2. **A link the host chooses.** A custom link alongside the random one.
3. **Who the guest is.** The host can make the email field required, have it proven by a code sent to it, and ask for a phone number.
4. **How many.** A capacity, counted as the headcount is, with a waitlist that promotes in order of arrival and tells the guest.
5. **Who gets in.** Approval, where a reply waits for the host, and personal invite links that tie a reply to a named guest.
6. **The instance looks after itself.** Optional Cloudflare Turnstile on the forms strangers can reach. Retention, where events are deleted a year after they end, their hosts warned first.

Each ticket is releasable on its own. M3 may go out as several minor releases; the whole of it is 0.4.

## User Stories

Numbering continues from the M2 spec, which ended at 141.

### Host: how many

142. As a host, I want to set a capacity for my event, counted as the headcount is (Going guests and their plus-ones, Maybe not counted), so that I never have more people than chairs.
143. As a host, I want guests who say Going once the event is full to go on a waitlist in the order they replied, so that nobody is turned away and the order is fair.
144. As a host, I want the waitlist to promote guests automatically when space opens, telling them by email when they gave one, so that I do not manage a list by hand.
145. As a host, I want to see the waitlist in order with each guest's party size, and to move a guest to Going myself if I choose, so that I stay in charge of the list.
146. As a host, I want the headcount to read "24 of 30" wherever it is shown to me, so that I know how full the event is.

### Host: who gets in

147. As a host, I want to turn on approval for an event, so that each reply waits for me before the guest is on the list.
148. As a host, I want to see the replies waiting for approval and approve or decline each, so that the decision is one tap.
149. As a host, I want a declined guest to stay visible to me, so that I can change my mind.
150. As a host, I want to make a personal invite link for a named guest, so that their reply is tied to them without asking who they are.
151. As a host, I want to see which personal invites were opened and which were answered, so that I know who still needs a nudge.
152. As a host, I want to delete a personal invite, so that a link I sent to the wrong person stops working.

### Host: who the guest is

153. As a host, I want to make the email field on the RSVP form optional or required, so that I can be sure of reaching every guest when it matters.
154. As a host, I want to require that a guest proves their email with a code sent to it, so that the addresses on my guest list are real.
155. As a host, I want to ask guests for a phone number, optional or required, so that I can reach them on the day.
156. As a host, I want the guest list to show each guest's email, whether it was proven, and their phone, so that I have what I need to plan.

### Host: the link

157. As a host, I want to choose a custom link for my event, such as `/e/adas-birthday`, so that I can say it aloud or print it.
158. As a host, I want links I already shared to keep working when I add a custom link, so that nobody is cut off.
159. As a host, I want "Reset link" to retire the custom link as well as the random one, so that a leaked link stops working whatever form it took.

### Guest

160. As a guest replying Going to a full event, I want to be told I am on the waitlist and my place in it, so that I know where I stand.
161. As a guest on the waitlist, I want to be told when I am in, by email when I gave one and on the page always, so that I do not miss my turn.
162. As a guest replying to an event with approval on, I want to be told my reply is waiting for the host, and later whether I am in, so that I am not left guessing.
163. As a guest waiting for approval or declined, I want to see the invitation but not the guest list or the comments, so that the host's decision means something.
164. As a guest opening a personal invite link, I want my name already filled in and my reply tied to that link, so that replying is one tap fewer and I can return to it later.
165. As a guest asked to prove my email, I want to enter a code from an email that arrives within seconds, and to ask for it again, so that proving it is quick.
166. As a guest, I want to be asked for a phone number only when the host asks for it, so that I share no more than necessary.
167. As a guest, I want a "Report this event" link on every event page, so that I can tell the operator about a page that should not be there.
168. As a guest, I want any bot check to be unobtrusive and to work with a screen reader, so that proving I am a person is not a chore.

### Operator

169. As an operator, I want to set how many events a host may have and how many replies an event may take, so that one account cannot fill my database or use my mail for spam.
170. As an operator, I want to be emailed each report of an event, and to see every report in one place with a link to the event and a way to delete it, so that I can act on abuse.
171. As an operator, I want to turn on Cloudflare Turnstile by setting its keys, so that the forms strangers can reach are protected from bots without me touching code.
172. As an operator, I want events deleted a year after they end by default, with their guests' details, and to change that period or turn it off, so that my instance keeps no more than it must.
173. As an operator, I want hosts warned by email a month before an event is deleted, and told on the event's own page, so that nobody loses something they wanted to keep without notice.
174. As an operator, I want the upgrade to 0.4 to delete nothing for at least a month, so that I and my hosts have time to read the notice.

## Implementation Decisions

### Architecture

- The module list grows by four: **Invites** (personal invite links), **Reports**, **Retention**, and **Turnstile**. The RSVPs module gains admission (approval and capacity), the waitlist and contact verification; the Instance module gains limits; the Events module gains the custom link. Route handlers and server actions stay thin.
- One rule decides what a saved reply becomes: `admit(event, rsvp, headcount)` is a pure function of the event's settings (approval, capacity), the reply's origin (a personal invite or the event link), the status the guest asked for, their party size and the current headcount, and returns the reply's approval and status. Every write of an RSVP goes through it, inside one transaction that locks the event row, so two replies cannot both take the last place.
- The worker that M2 built for mail becomes the instance's one clock: it starts whether or not the instance has mail. With mail it queues reminders and sends the outbox each minute as today; retention runs on the same tick, at most once an hour per container, and claims its rows with SKIP LOCKED as the outbox does. Nothing else in M3 runs without a request.
- No new runtime dependency. Turnstile is one script from Cloudflare on the pages that use it and one HTTPS call from the server. Nothing is sent to anyone but the operator's own mail server and, when the operator turns it on, Cloudflare (ADR-0005 is about the project; the operator's choice is documented).
- No AI anywhere (decisions log).

### Operator limits **(decided here, within the log's "operator limits (guests per event, upload size, events per host)")**

- Two limits live in `instance_settings`, edited on the instance settings page under a new card, **Limits**: `maxEventsPerHost` (default 50) and `maxRsvpsPerEvent` (default 500), each 1 to 100000. Upload size stays `MAX_UPLOAD_MB` in the environment: it is a limit on the container's memory and disk, not a policy, and the M1 spec put every resource setting there.
- Events per host counts every event the host owns, in any state, drafts and past events included; a host at the limit cannot create or duplicate an event, and the dashboard and the refusal say so and suggest deleting old events. Replies per event counts every RSVP on the event, in any status, waitlisted and pending included; a new reply to an event at the limit is refused with "This event can't take more replies" (`limitReached`), and existing guests can still edit or withdraw. The host sees the instance's reply limit as a hint beside the capacity field.
- The announcement cap (ten) and the co-host cap (ten) stay as they are. Personal invites are capped at 500 per event.

### Report an event **(decided here)**

- Every event page shows "Report this event" in its footer, in every layout, for published and cancelled events (a draft shows nobody its page). It opens `/e/<slug>/report`, a plain page in the viewer's language with the event's title, a reason (20 to 1000 characters), an optional email to reach the reporter, Turnstile when configured, and "Send report".
- A report is stored (`report`: event, reason, contact, created at, handled at) and, with mail, queued to the operator account's email through the outbox, with the event's title, link, the reason and the contact. The instance settings page gets a **Reports** page (`/instance/reports`) listing every report newest first, unhandled first, each with the event's title and link, the reason, the contact, and three actions: open the event, **Delete event** (the operator may delete any event; the same removal as the host's delete, everything goes), and **Mark handled**. A report whose event was deleted says so and is marked handled.
- A new rate limit, `report` (`RATE_LIMIT_REPORT`, default 5 an hour), counts sending a report. The thank-you page says the report reached the operator and nothing more.
- The operator's address for reports is the operator account's email (the account `instance_settings.operatorId` names), not `OPERATOR_CONTACT_EMAIL`, which is the public address.

### Custom link **(decided here, within the log's "vanity slugs in M3")**

- An event has its random slug as today and may also have a custom slug, `event.customSlug` (unique): 3 to 40 characters, lowercase letters, digits and single hyphens, neither first nor last. The host sets, changes or removes it on the share page under **Custom link**, which shows `/e/<custom>` with Copy once set. Input is lowercased and trimmed; a taken slug, a retired slug, or one that matches another event's random slug is refused with "That link is taken".
- Both links open the page. The share page, the QR code, the preview card, the calendar file and every email use the custom link when there is one, through one helper that every link to an event page goes through. Changing the custom link retires the old custom slug (its visitors see the "link no longer valid" page, as after a reset); resetting the link issues a new random slug and retires both the old random slug and the custom one, so that a reset does what the host expects of it (story 159). The share page says so beside the Reset button.
- `isSlug` accepts both shapes. The event page limit counts requests under a custom slug as it counts the random ones. Browser-test helpers that match an event link by shape accept both.
- ADR-0004 is not reopened: the random slug remains the access key and is still issued to every event; a custom slug is a convenience the host chooses knowing it can be guessed, and the share page says so in one line.

### Contact details **(maintainer, 2026-10-09: email proven by a code, phone asked but not proven)**

- The per-event `askEmail` switch becomes a choice, `emailField`: don't ask, optional, required. The migration maps `false` to don't ask and `true` to optional. A second switch, `verifyEmail`, "Check the email with a code", is offered only when the instance has mail and the field is asked for; it means a guest's email is accepted only once they have entered a code sent to it. A third choice, `phoneField`: don't ask, optional, required. The form groups the three under "Contact details", with the hint that guests get email only when asked for it, as today.
- A phone number is 5 to 20 characters of digits, spaces, `+`, `-`, `(`, `)` and `.`, stored as typed and trimmed, never formatted or dialled. It is shown to the host in the guest list and nowhere else. Phone numbers are not proven in M3: no SMS provider is chosen, and none is planned until one is (maintainer, 2026-10-09).
- Proving an email: when `verifyEmail` is on and the guest's email is new or changed, the reply is not saved yet. The server makes a six-digit code, stores its hash with the email and the event (`email_code`: event, email, code hash, expires at, attempts), sends it at once rather than through the outbox, because the guest is waiting (the M2 rule for Better Auth's own mail), and the flow shows a code step: "We sent a code to <email>", a six-digit field, "Send it again" (allowed every 30 seconds). A code lasts ten minutes and five wrong attempts; a sixth asks for a new code. The reply is saved when the code matches, with `rsvp.emailVerifiedAt`. Sending a code counts against the `mail` rate limit, as every email a request sends does. A guest whose email was proven keeps the mark while the address stays the same; the host sees a tick beside a proven address.
- The code step is a step of the shared flow hook, presented by each layout as the other steps are. Without mail, `verifyEmail` cannot be turned on, and an event that has it on behaves as if it were off (the setting is kept for when mail arrives).
- The host's edit of a guest can set the email and phone; an email the host typed is not marked proven.
- A guest who replies through a personal invite that carries an email has that email filled in and taken as proven: the host gave it.

### Capacity and the waitlist

- `event.capacity` (nullable integer, 1 to 5000) is set on the event form under "Guests", with the hint "Counts guests who say Going and their plus-ones, as the headcount does. Maybe doesn't count. Leave empty for no limit." A capacity below the current headcount is allowed (the host may be making the event smaller); nobody is moved to the waitlist by it, and the page simply reads full.
- `waitlisted` is a fourth RSVP status, one a guest never chooses: a reply that asked for Going when the party did not fit is saved as waitlisted, with `rsvp.waitlistedAt`. A party fits when the headcount of approved Going replies plus the party (the guest and their plus-ones) is within capacity. The whole party waits or the whole party is in; nobody is split **(decided here)**. A Going guest who raises their plus-ones beyond the space left is refused with "Only N places left" (`capacityFull`) and keeps their place **(decided here)**. A guest who changes a waitlisted reply to Maybe or Can't go leaves the waitlist; one who edits their details keeps their place in it.
- Promotion runs inside the same transaction as any write that can open space: a Going reply withdrawn or changed, plus-ones reduced, a guest removed or edited by the host, the capacity raised or removed. It walks the waitlist in `waitlistedAt` order and promotes while the next party fits, then stops: a large party at the front is not skipped, because the order of arrival is what the log promises **(decided here)**. A promoted reply becomes Going with `promotedAt` set, and the guest is queued one email when they gave one: "A place opened up: you're going to <title>", with the event link and the stop link. The page shows the change whenever they return.
- The host's guest list gains a **Waitlist** section in order, each row numbered with its party size, and the host may set a waitlisted guest to Going from the row: a host's edit is never refused by capacity **(decided here)**. The headcount reads "24 of 30" on the guest list, the manage page and the dashboard when a capacity is set.
- The page: when the event is full, every layout says so beside the reply controls, "This event is full. You can join the waitlist.", whatever the guest list visibility; otherwise the page says nothing about places left **(decided here)**. A guest's confirmation says "You're on the waitlist, number N" with their place; the Thread layout says it in its own voice.
- Waitlisted replies count in the host's counts and in the replies-per-event limit, never in the headcount or the public counts. The public guest list does not show them. Reminders do not go to them. Announcements gain a fourth audience, Waitlist, unchecked by default. The cancellation notice goes to them as to Going and Maybe guests. Confetti falls only when a reply is saved as Going, not on a waitlisted reply and not on a promotion. The calendar is offered to them as to Maybe guests. The host's reply notification says "<name> is on the waitlist (party of N)".
- `CONTEXT.md`'s **RSVP status** entry gains Waitlisted, and **Waitlist** reads as "the Waitlisted RSVPs of an event, in the order received"; the final ticket proposes the wording to the maintainer, who owns the file.

### Approval

- `event.approvalRequired` (default off) is set on the event form under "Guests": "Approve each guest before they're on the list". Every RSVP carries `approval`: approved, pending or declined; replies to an event without approval are approved. A new reply to an event with approval on is pending whatever its status, unless it came through a personal invite, which the host issued: those are approved **(decided here)**. Turning approval off approves every pending reply; turning it on changes no existing reply.
- Pending and declined guests see the invitation and their own reply, but not the guest list, the headcount or the comments, which are locked for them with their own line ("Once the host approves your reply you'll see who's coming"); they cannot post comments. They may edit or withdraw their reply; editing keeps it pending. They are not counted in the headcount, the public counts, or the Thread header's "N replies".
- The host's guest list gains a **Waiting for approval** section at the top with Approve and Decline on each row, and a **Declined** section at the bottom with Approve. Approving applies the capacity rule: a Going reply becomes Going or waitlisted as a new reply would, and the guest is queued one email when they gave one: "You're in: <title>", with the event link, their reply and the stop link; a Going reply that landed on the waitlist says so instead. Declining sends no email **(decided here)**: the guest's page says "The host wasn't able to accept your reply", and nothing more. A declined guest who withdraws and replies again is pending again.
- Pending and declined replies get no reminders and no announcements (the audience is approved replies). The cancellation notice goes to pending replies as to approved ones, Can't go excepted **(decided here)**. The host's reply notification says "<name> is waiting for your approval". The dashboard shows "N waiting for approval" on an event that has any.

### Personal invite links

- A personal invite (`invite`: event, name, optional email, token hash, created at, opened at, RSVP) is made by a host on a new page under the event, `/events/[id]/invites`: a name and an optional email, one at a time, up to 500 per event. The page lists invites with their state, Not opened, Opened, Replied (with the reply's status), each with Copy (the link is shown as long as the invite is unanswered) and Delete. The link is `/i/<token>`, 24 random bytes as the edit token is, stored hashed and shown to the host whenever they ask: it is the guest's key, not a secret from the host.
- Invites are shared by the host as the event link is: copied, or through the share sheet. They are not emailed by the instance in M3 **(decided here)**: it would be the first email to someone who never replied and needs its own consent and stop story; the log does not ask for it.
- Opening `/i/<token>` records `openedAt`, sets the device cookie to the invite's reply when there is one (the link then works as an edit link), and otherwise shows the event page with the name filled in and the email filled in and taken as proven when the invite carries one. The guest may change the name. The reply saved from it carries `rsvp.inviteId`, and the invite records the reply. Deleting an invite keeps its reply and unlinks it; the link stops working.
- A reply through a personal invite is approved whatever the approval setting; capacity applies to it as to any reply. Invites who have not replied appear in the host's guest list under **Invited**, not on the page, and not in any count.
- `/i/<token>` is rate limited as event pages are: an unknown token must cost what a wrong slug costs.

### Turnstile **(decided here, within the log's "optional Cloudflare Turnstile")**

- Two variables, `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`, both or neither, checked at start. When set, the Turnstile widget (managed mode) stands beside the submit control of three forms: the email sign-up form, the RSVP form in every layout, and the report form. The server verifies the token with Cloudflare's `siteverify` endpoint, with the client's address, before the action does anything else; a missing or failed token is refused with "Please complete the check" (`checkFailed`) and the form can be sent again. Sign-in, comments and host actions are not gated: they are rate limited and behind a session or a reply.
- The widget's script loads only when the keys are set. Without them nothing changes anywhere. The verdict from Cloudflare's response is a pure function with unit tests; the wiring is covered in the browser against Cloudflare's published always-pass test keys on the `app-social` container of the test profile.
- `docs/operator/configuration.md` gains a **Bot protection** section: what it protects, that the widget talks to Cloudflare from the visitor's browser and the operator's privacy policy should say so, and how to get keys.

### Retention **(decided here, within the log's "retention (default one year after the event ends, host warned by email, guest data deleted with the event)")**

- `instance_settings.retentionDays` (default 365; the operator may set 30 to 3650, or Keep forever) on the instance settings page's Limits card: "Delete events and their guest lists N days after they end". An event's end is `eventEnd` (its end, else its start; an all-day event ends at the next local midnight), in any state: a draft's date passes too.
- Two marks on the event: `retentionWarnedAt` and nothing else. The clock's hourly sweep (above) first marks every event whose end is more than `retentionDays - 30` days ago and that is not yet marked, and queues each of its hosts one email when the instance has mail: the title, the day it will be deleted, that deleting it is the instance's policy, and that **Duplicate** keeps the details. It then deletes every event that was marked at least 30 days ago and whose end is more than `retentionDays` ago, through the same removal as a host's delete: RSVPs, answers, comments, announcements, invites, reports, the picture's files, everything. Deletion never comes sooner than 30 days after the mark, so an instance upgrading to 0.4 with old events deletes none for a month, and so hosts always have the warning's month, with or without mail (story 174) **(decided here)**.
- The manage page and the dashboard card say "Will be deleted on <date>" once an event is marked; the manage page says it on every event in one line beneath the dates: "Events on this instance are kept for a year after they end". With Keep forever, nothing is marked or deleted and the line is not shown; raising the period unmarks nothing but delays the deletion (the sweep checks the period again).
- Hosts' accounts, sessions and Better Auth's verification rows are not touched.

### Instance and operator pages

- `/instance` keeps Registration and Host invitations and gains **Limits** (events per host, replies per event, retention). `/instance/reports` is the reports inbox. The host header's "Instance settings" link stays; the reports page is linked from the settings page with the count of unhandled reports.
- The operator's deletion of an event is a new action gated by `requireOperator()`, going through `removeEvents`; it is not a host role.

### Events, guests and the page: the rules in one place

- `admit` (above) is in `src/rsvps/admission.ts`, with the waitlist promotion in `src/rsvps/waitlist.ts`, both pure where they can be and called inside the one transaction that writes a reply. `guestListView` and `commentsView` take the viewer's approval into account: a pending or declined reply unlocks nothing.
- `countRsvps` keeps counting the headcount from Going replies only; waitlisted and pending replies are tallied for the host's counts under their own labels. `groupByStatus` orders the host's sections: Waiting for approval, Going, Waitlist, Maybe, Can't go, Declined, Invited.
- Every link to an event page goes through `eventPath(event)` (`/e/<customSlug or slug>`), in the app, the calendar, the preview card and every email.
- The theme sent to guests omits `uploadId` (the host's drawer keeps it): a picture put aside should not stay reachable from the page's data (hardening noted in the M2 ledger, task 14) **(decided here)**.

### Operator configuration

- New variables: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_REPORT`. New instance settings in the database: events per host, replies per event, retention days. `configuration.md` documents each; the upgrade guide gets a 0.4 note that leads with retention (what will be deleted, when, how to keep it, how to turn it off), then the email field's new shape, then that nothing else changes on existing events.
- The privacy policy placeholder gains: phone numbers among what a guest may give, that the instance keeps events for the retention period, that reports are sent to the operator, and that the operator may have enabled a bot check that talks to Cloudflare.

### Repository

- Translations: every ticket translates its own keys into Simplified and Traditional Chinese in the same change, as M2's ledger ruled on 2026-10-07 (the translations test demands every key in every file); the final ticket is the maintainer's review of the Chinese.
- `CONTEXT.md` is the maintainer's; tickets propose wording in their comments and never edit it.

## Testing Decisions

The M1 and M2 testing decisions hold: two seams, the browser against the real app with a real Postgres and a fake mail server, and pure rules called directly. Nothing at other seams.

- **Pure rules with unit tests**: `admit` for every combination of approval, capacity, origin, status and party against a headcount; the promotion walk (strict order, a large party blocking, parties of one, an emptied waitlist); the custom slug's shape; the phone number's shape; the verification code's lifetime and attempts; the Turnstile verdict from Cloudflare's response; which events the retention sweep marks and which it deletes, with the 30-day floor and the period changing; the limit refusals; the grouping of the host's guest list.
- **Browser tests per feature**: a host at the events limit refused, a guest at the replies limit refused; a report sent and in the operator's inbox and mail, the operator deleting the event from it; a custom link opening the page, taken by another event and refused, retired by a reset; email required and refused when blank, proven by a code read from Mailpit, a wrong code refused, the tick on the guest list; a phone asked and shown; a full event waitlisting a party, the position shown, a withdrawal promoting the next guest with the email arriving, a large party not skipped, the host moving a guest to Going, the public list without the waitlist; approval holding a reply, the guest list locked for the guest, approval with the email arriving, decline shown on the page, turning approval off; a personal invite opened with the name filled, replied, listed as Replied, deleted and dead; Turnstile on `app-social` on sign-up, RSVP and report; retention marking and deleting a past event in a test instance with a short period (the sweep run through a test-only trigger, or the period set to its minimum against an event dated long ago and the mark's floor shortened by a test-only variable, whichever the ticket finds honest), the warning email, the manage page's date.
- The accessibility, keyboard, locale and reduced-motion specs extend to the new steps and pages in every layout.
- The definitive run is the Docker test profile with `CI=1`, as in M2.

## Out of Scope

Everything the decisions log assigns to later milestones:

- M4: photo album, date polling, passkeys, Sign in with Apple, Facebook login, emoji reactions on comments.
- M5: ticketing and payments.

Also out of M3, and not planned unless asked: phone numbers proven by SMS (maintainer, 2026-10-09); invites emailed by the instance; an invite-only mode where only invited guests may reply (approval covers it); a hosts list or host suspension on the operator pages; CSV export of the guest list; a guest extending or cancelling retention; "N places left" on the page; partial admission of a party; Turnstile on sign-in, comments or host forms; operator limits on uploads beyond `MAX_UPLOAD_MB`; a second operator.

## Further Notes

- M3 is the first milestone where a write to an RSVP must be atomic (capacity). The ticket that introduces the transaction (capacity) must leave every later write going through it.
- Branch `m3-control` starts from `m2-social` at c5c976a, since `main` does not carry M2 until PR #1 merges. If PR #1 lands by merge commit or fast-forward, M3 merges on top; if it is squashed, the branch is rebased onto `main` with `--onto` before its own PR.
- Residual from M2 for the final ticket's copy pass: `Events.form.questionsHint` ("Their answers are yours alone.") is wrong with co-hosts.
- The tracker stays in `.scratch/` until after M4 (maintainer, 2026-09-30).
