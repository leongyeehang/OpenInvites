# 09: Date polling

**What to build:** A host without a fixed date offers two to six candidate dates; guests vote Yes, If need be or No with their name; the host picks one, which becomes the event's date, and voters who gave an email are told.

**Blocked by:** 05 The invitation is the editor, 07 The Settings sheet

**Status:** done

- [x] Tables `date_option` (event, starts_on, optional start and end time, position) and `date_vote` (option, voter, answer), plus `date_voter` (event, name, optional email, token for the edit link and cookie, as an RSVP's). Event column `poll_closed_at`. The check constraint becomes `state = 'draft' OR starts_at IS NOT NULL OR poll is open`. Migration.
- [x] `src/polls/` (pure): the tallies per option (Yes, If need be, names), who may vote (a published, not cancelled event with an open poll), the pick.
- [x] Editor date sheet: "Not sure yet? Let guests vote" → two to six candidates; publishable with an open poll.
- [x] Guest page: When reads "Date to be decided" and opens the poll; the bar reads "Vote on a date"; a voter gives a name (and an optional email for the result) and answers every option; their votes come back on their device and by their edit link; a Turnstile check when the operator has keys, as RSVPs have; rate limited with RSVPs.
- [x] Host: the editor's When row opens the votes per date with names, and "Pick this date" (confirm). Picking sets the date, closes the poll, queues a "The date is set" mail to each voter with an email, and the page asks for RSVPs, the voter's name prefilled on their device.
- [x] Reminders and retention skip an event while its poll is open. Deleting the event deletes the poll.
- [x] Unit tests for the tallies, the eligibility and the constraint's cases. Browser: host opens a poll and publishes; two guests vote; one changes their votes; the host picks; the mail in Mailpit; the RSVP form prefilled; a closed poll refuses votes. Keyboard, accessibility and locale rows in each layout.

## Notes for the implementer

- Commit subject, e.g. `Polls: guests can vote on a date, and the host picks it`.

## Comments

**2026-11-04, implementing agent (Opus, in the maintainer's session).** Done.

- `drizzle/0039_date_polls.sql`: `date_option` (day, optional start and end time, position), `date_voter` (name, optional email, hashed edit token, mail token, locale), `date_vote` (option, voter, answer: yes, ifNeedBe, no), all cascading from the event; `event.poll_opened_at` and `poll_closed_at`; the check becomes `state = 'draft' or starts_at is not null or (poll_opened_at is not null and poll_closed_at is null)`. The ticket named only `poll_closed_at`; a check constraint cannot look at another table, so "poll is open" needs the opening time on the event too.
- `src/polls/poll.ts` (pure, unit-tested): `parseOptions` (two to six, real days, `HH:MM`, an end only after a start, no repeat), `pollState`, `mayVote` (published, poll open), `parseVotes` (an answer on every candidate), `tally` (names under each answer, in voting order), `leading` (most Yes plus If need be, then most Yes), `whenOf` (a candidate as the date sheet's fields, which `parseWhen` turns into the event's time; all-day when it has no time). `polls/format.ts` writes a candidate in the reader's language.
- Editor: the When sheet's "Not sure yet? Let guests vote" turns into the candidates' form (`editor/poll-sheet.tsx`, `savePollAction`), with "Set one date instead"; once someone has voted it shows the votes by name with "Most can make it" and "Pick this date" (confirmed, `pickDateAction`). A date set by hand replaces a poll nobody voted on and is refused once there are votes. The When row reads "Date to be decided · n votes". `missingToPublish` takes an open poll for the date, so a polling draft publishes.
- Picking sets the date, closes the poll for good, and queues "The date is set" to each voter with an email, in their language, with the event link and the guest-mail footer; the stop link (`/m/[token]`) now finds and blanks a voter's email too.
- Guest page: the When row reads "Date to be decided" with each candidate and its Yes count, and opens the vote; the bar reads "Vote on a date", then "Change my votes". The sheet asks every candidate's answer, the name, an optional email; Turnstile when configured; counted against the RSVP limit (`polls/actions.ts`). Votes come back by a cookie (`vote_{eventId}`) and by the private link `/v/[token]`, which the proxy answers with the not-found page when no voter has it. After the pick, the voter's name and email start their reply.
- Reminders and retention already pass over an event without a date, which a polling event is.
- Messages in all three languages (`Editor.poll`, `EventPage.poll`, `Mail.dateSet`, `Events.errors.poll*`).

Amended: **a polling event is shown in the Poster layout whatever layout the theme names**, as an undated draft already is (ticket 05): the Broadsheet's dateline and the Thread's first card are drawn around a date. Once the date is picked, the theme's layout returns. The keyboard, accessibility and locale rows therefore run on the Poster.

Browser: `e2e/polls.spec.ts`: a host opens a poll and publishes; two guests vote, one changes her votes; the host sees the votes by name and picks; the voter with an email gets the mail in Mailpit with the event link; the page asks for replies and the voter's reply starts from her name; a sheet left open from before the pick is refused; by keyboard, with axe on the page, the sheet and the host's votes; in Simplified Chinese; a draft becomes a poll and back, too few candidates refused. 7 passed. The full suite with it: 555 passed, 1 flaky (effects, under load), 1 failed (the reactions axe row on desktop, see ticket 04: fixed after, by checking once the page is drawn again).

**2026-11-04, the browser run.** `docker compose --profile test up -d --build --wait` from the working tree of tickets 09, 10 and 11 together, then `CI=1 pnpm exec playwright test --workers=2`, every project: **566 passed, 0 failed, 0 flaky, 2 skipped** (the desktop editor's rows, which set their own viewport, run in the desktop project only) in 58.5 min. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 829 passed (80 files).
