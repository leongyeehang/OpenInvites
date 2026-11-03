# 09: Date polling

**What to build:** A host without a fixed date offers two to six candidate dates; guests vote Yes, If need be or No with their name; the host picks one, which becomes the event's date, and voters who gave an email are told.

**Blocked by:** 05 The invitation is the editor, 07 The Settings sheet

**Status:** ready-for-agent

- [ ] Tables `date_option` (event, starts_on, optional start and end time, position) and `date_vote` (option, voter, answer), plus `date_voter` (event, name, optional email, token for the edit link and cookie, as an RSVP's). Event column `poll_closed_at`. The check constraint becomes `state = 'draft' OR starts_at IS NOT NULL OR poll is open`. Migration.
- [ ] `src/polls/` (pure): the tallies per option (Yes, If need be, names), who may vote (a published, not cancelled event with an open poll), the pick.
- [ ] Editor date sheet: "Not sure yet? Let guests vote" → two to six candidates; publishable with an open poll.
- [ ] Guest page: When reads "Date to be decided" and opens the poll; the bar reads "Vote on a date"; a voter gives a name (and an optional email for the result) and answers every option; their votes come back on their device and by their edit link; a Turnstile check when the operator has keys, as RSVPs have; rate limited with RSVPs.
- [ ] Host: the editor's When row opens the votes per date with names, and "Pick this date" (confirm). Picking sets the date, closes the poll, queues a "The date is set" mail to each voter with an email, and the page asks for RSVPs, the voter's name prefilled on their device.
- [ ] Reminders and retention skip an event while its poll is open. Deleting the event deletes the poll.
- [ ] Unit tests for the tallies, the eligibility and the constraint's cases. Browser: host opens a poll and publishes; two guests vote; one changes their votes; the host picks; the mail in Mailpit; the RSVP form prefilled; a closed poll refuses votes. Keyboard, accessibility and locale rows in each layout.

## Notes for the implementer

- Commit subject, e.g. `Polls: guests can vote on a date, and the host picks it`.
