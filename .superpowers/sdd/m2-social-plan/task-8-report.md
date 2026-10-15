# Task 8 report: multiple-choice questions

Commit `95053cc` Questions: a host asks a multiple-choice question and a guest picks several options.

## Implemented
See the ticket comment in `.scratch/m2-social/issues/08-multiple-choice-questions.md` (dated 2026-10-08) for how it landed, decisions and notes to tickets 09, 12, 13, 15.

## TDD
- RED: `pnpm exec vitest run src/questions` gave 14 failed (new answer shape; `multiple` unknown type).
- GREEN: same command, 24 passed. Full `pnpm test`: 59 files, 461 tests passed. `pnpm lint` and `pnpm typecheck` (tsbuildinfo deleted) clean.

## Browser (production build loop: pnpm build, standalone server on :3000, Compose dev profile)
- `e2e/questions.spec.ts`, `rsvp.spec.ts`, `rsvp-sheet.spec.ts`, `guest-list.spec.ts`, `events.spec.ts`: 77 passed (4.0m), mobile and desktop.
- An earlier run failed the 2 new tests (x2 widths) because Playwright could not click an `sr-only` checkbox; fixed by overlaying the checkbox inside its label.
- Server stopped, standalone symlinks removed.

## Migration check on the dev database
Copied the dev DB (822 answers) to a scratch DB, ran `runMigrations`: 822 rows, all `array_length(values,1)=1`, `values[1]` equals the old `value` for every id (diff identical); enum `{text,choice,multiple,yesNo}`. Scratch DB dropped. Final column has no default. drizzle-kit prompts for a rename interactively, so the migration was generated in two steps and merged by hand; `pnpm db:generate` afterwards reports no changes.

## Files changed
drizzle/0020_multiple_choice_questions.sql, drizzle/meta/0020_snapshot.json, drizzle/meta/_journal.json, src/db/schema.ts, src/questions/{question,answers,repository}.ts and their tests, src/rsvps/actions.ts, src/app/e/[slug]/rsvp-flow.tsx, src/app/(host)/events/questions-editor.tsx, src/app/(host)/events/[id]/guests/guest-row.tsx, messages/{en,zh-Hans,zh-Hant}.json, e2e/events.ts, e2e/questions.spec.ts.

## Self-review
- A non-multiple answer with several values is refused as `answerNotOffered` (not specified in the ticket; chosen as the least surprising).
- `countAnswersByQuestion` unchanged: one answer row per RSVP per question.
- The ticket says guest-list answers use Intl.ListFormat; implemented with next-intl's `format.list` conjunction.

## Concerns
- `rsvp-flow.tsx` change is local to the questions step (one new branch, values now lists). Ticket 12 owns the refactor.
- Chinese for "Multiple choice" (多选 / 多選) is the only new string; flagged for ticket 15.
