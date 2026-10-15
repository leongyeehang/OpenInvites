# 08: Multiple-choice questions

**What to build:** A fourth question type where a guest may pick several options. Required means at least one.

**Blocked by:** none

**Status:** done

- [x] `QUESTION_TYPES` gains `multiple`; the enum migration adds it. `answer.value` becomes `answer.values text[] not null`; the migration adds the column, fills it with `ARRAY[value]`, and drops `value`.
- [x] `src/questions/question.ts`: `multiple` carries options like `single` (same limits: 80 characters each, comma-separated in the editor as today). `answers.ts`: an answer is a list of values; for `text`, `single` and `yesNo` it has at most one; for `multiple` any number from the options; required means at least one for every type. `answersStillOffered` drops each value the question no longer offers and keeps the rest. Unit tests for each.
- [x] The questions editor offers "Multiple choice" as a type with the options field.
- [x] The guest flow's questions step renders a `multiple` question as a group of checkboxes; tapping a checked one clears it. The RSVP posts `answer:<id>` once per pick. Editing an RSVP shows the picks prefilled.
- [x] The host's guest list shows the picks as a list in the viewer's language (`Intl.ListFormat`, conjunction); answer counts per question (`countAnswersByQuestion`) count an RSVP once however many picks it made.
- [x] Browser tests (extend `e2e/questions.spec.ts`): a required multiple-choice question blocks completion until one pick; two picks show in the guest list joined; the host removes an option and the guest's next edit keeps the other pick and completes.

## Notes for the implementer

- The Broadsheet and Thread layouts (tickets 12 and 13) will render this type too; keep the rules in `src/questions/` and the presentation in the flow.
- Adding the enum value is `ALTER TYPE "question_type" ADD VALUE 'multiple'`. Postgres runs it inside the migration's transaction as long as that transaction does not use the new value, and this migration does not (the column change touches `answer`, not the type). Test the migration on a copy of a database that has answers: every old `value` must come back as a one-element `values`.
- Commit subject, e.g. `Questions: a host asks a multiple-choice question and a guest picks several options`.

## Comments

**2026-10-08, implementing agent.** Done, every box ticked. Commit `95053cc`. Lint, type check, 461 unit tests, and `e2e/questions.spec.ts`, `rsvp.spec.ts`, `rsvp-sheet.spec.ts`, `guest-list.spec.ts`, `events.spec.ts` (77 passed at 390px and desktop, production build) pass.

How it landed:
- `QUESTION_TYPES` is `text, choice, multiple, yesNo`. `parseQuestions` gives `multiple` the same 2 to 10 options and 80 characters as `choice`. `Answer` is `{ questionId, values: string[] }`, `AnswerFields` is `Record<string, string[]>`. `parseAnswers`: required means at least one value for every type; more than one value for text, choice or yesNo is `answerNotOffered`; `multiple` picks are deduplicated and stored in the order the question offers them. `answersStillOffered` drops each value no longer offered and keeps the rest.
- Migration `0020_multiple_choice_questions.sql`: `ADD VALUE 'multiple' BEFORE 'yesNo'`, add `values text[] NOT NULL` (default `'{}'` only while backfilling, then dropped), `UPDATE ... SET values = ARRAY[value]`, drop `value`. The column ends with no default. `drizzle-kit generate` prompts interactively for a rename when one column is dropped and another added, so I generated it in two steps (add, then drop) and merged them by hand into one file and one snapshot; a further `pnpm db:generate` reports no schema changes.
- Guest flow: `multiple` renders a fieldset of checkbox chips (the checkbox is a transparent overlay inside its label, so it is tappable and keyboard focusable); a checked box posts its own `answer:<id>`, so no hidden inputs are needed when the step is out of sight. The action reads them with a grouped `answer:<id>` list. Editor: "Multiple choice" with the options field. Guest list: `format.list(values, { type: "conjunction" })`.

Decisions and things to know:
- The editor label is "Multiple choice" as the ticket says, next to the existing "One of a list".
- `countAnswersByQuestion` is unchanged: `answer` has one row per RSVP per question (unique constraint), so an RSVP counts once however many picks.

Left for later tickets or noted:
- Tickets 12 and 13 render the type too: the rules are all in `src/questions/`; the checkbox group in `rsvp-flow.tsx` is the presentation to replace (Thread: toggling chips plus a Done chip, per the spec).
- Ticket 09 (duplicate) copies questions with their `options`; nothing else is needed for `multiple`. Answers are not copied.
- Ticket 15, strings least sure of: `questionMultiple` ("多选" in zh-Hans, "多選" in zh-Hant). No other keys were added.

Evidence:
- RED: `pnpm exec vitest run src/questions`: 14 failed (answers shape, `multiple` not a known type). GREEN: same command, 24 passed.
- Migration check: copied the dev database (822 answers) into a scratch database, ran `runMigrations` on it: 822 rows, all with one-element `values`, `values[1]` identical to the old `value` for every id; enum is `{text,choice,multiple,yesNo}`. Scratch database dropped.
- Browser, production build (`pnpm build`, standalone server on :3000, Compose dev profile): the first run of the two new tests failed because Playwright could not click an `sr-only` checkbox (outside the viewport); I changed it to an overlay and the new tests passed (5 passed incl. operator setup), then the five-spec set above: 77 passed (4.0m).
