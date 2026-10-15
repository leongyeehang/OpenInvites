# 09: Host questions

**What to build:** Hosts add questions to the RSVP form as free text, single choice, or yes or no, mark them required, reorder and remove them. Guests answer them in the flow, Can't go skips them, and answers are visible only to the host.

**Blocked by:** 07 Guest RSVP flow

**Status:** done

- [x] Question schema: belongs to an event, ordered, type (free text, single choice with options, yes or no), required flag. Answers belong to an RSVP.
- [x] The event form has a questions editor: add, edit, reorder, remove; removing a question discards its answers after a confirmation.
- [x] The questions step renders each question in order with required validation; Can't go skips the step; editing an RSVP shows previous answers prefilled.
- [x] Answers appear in the host's guest list and nowhere a guest can see.
- [x] Browser tests: a required single-choice question blocks completion until answered; answers show in the host list; reordering changes the guest's order. Unit tests for any validation rules.

## Comments

**2026-09-22, implementing agent.** Done. Lint, type check, 103 unit tests, and 96 browser tests pass against the production image on the Compose `test` profile.

How it landed:

- `src/questions/`: `question.ts` (the types, and `parseQuestions`, which reads the editor's payload knob by knob so a crafted post is a refusal rather than a crash), `answers.ts` (`parseAnswers`, plus `offeredBy` and `answersStillOffered`), `repository.ts`.
- Schema (migration `0006_questions`): `question` (event, position, type, prompt, options, required) and `answer` (rsvp, question, value, unique per pair). Both cascade, so removing a question, an RSVP or an event takes the answers with it.
- The editor lives in the event form and saves with it, carried as one JSON field, so a host can write questions while creating the event. `saveQuestions` saves the list whole: dropped questions go, kept ones are updated where they now sit, new ones are added.
- The guest's flow gained a `questions` step, inserted only when the event has questions and skipped entirely by Can't go. Answers post as `answer:<id>` fields and are stored per RSVP.
- The host's guest list shows each guest's answers under their details, and nowhere a guest can see them.

Decisions and things to know:

- Reordering is up/down buttons rather than drag-and-drop: keyboard-operable, no dependency, and testable.
- A choice question's options are typed as one comma-separated field, so no choice may itself contain a comma. Worth revisiting if a host ever wants one.
- Caps not in the ticket, chosen as input hardening on a public endpoint and used in the copy: ten questions per event, 200 characters per prompt, 80 per choice, 500 per answer.
- The host does not edit a guest's answers. Ticket 08 scoped host edits to status, name and plus-ones, and nothing asks for more.
- Review caught a lock-out: a guest's stored answer was carried into the form verbatim, so if the host rewrote a question's choices afterwards the stale value posted, was refused, and the guest could never save their RSVP again — the same shape as the plus-ones bug in ticket 07. `answersStillOffered` now drops any answer the question no longer offers, and a browser test covers it. Tapping a chosen answer again clears it, which is the only way to leave an optional choice unanswered.
- Review also caught that a crafted question id reached a uuid column and made Postgres throw; ids are now shape-checked before they get there, with a test.
- Saving an event and saving its questions are two writes, not one transaction, as are saving an RSVP and its answers. A failure between them leaves the earlier one saved; both are put right by saving again. Noted in the code rather than left silent.

Left for later tickets or noted:

- The editor's list uses its index as a React key. Safe today because every field in it is controlled, but a stable key would be better if any of them ever becomes uncontrolled.
- **For ticket 20 (accessibility):** the editor's group label is a `<label>` with nothing to point at, and the questions step marks required with an asterisk that has no text equivalent.
