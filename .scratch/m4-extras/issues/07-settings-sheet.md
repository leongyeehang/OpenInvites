# 07: The Settings sheet

**What to build:** Everything a guest does not see, in one tall sheet from the editor's toolbar, grouped as the mockup groups it, with the 0.4 defaults and validation.

**Blocked by:** 05 The invitation is the editor

**Status:** done

- [x] Groups and controls (spec, "The editor"): **Guests** (each guest can bring 0–10, ask for their names, capacity with the 0.4 hint, approve each reply); **Questions** (the 0.4 questions editor inside the sheet, answer counts kept); **Contact details** (email Don't ask / Optional / Required, prove it with a code (only with mail configured, and disabled while email is not asked), phone); **Guest list** (who sees who's coming); **Emails and comments** (email me on replies, reminders with the "ask for an email" hint, comments, email me about comments).
- [x] Each control saves on change through one `updateEventSettingsAction` that reuses `events/form.ts`'s parsing and limits per field; errors show beside the control.
- [x] One line at the top: "Everything a guest doesn't see. The defaults are ready, so you can publish without opening this."
- [x] Remove the temporary Settings sheet of ticket 05.
- [x] Browser: each setting saved and honoured by the guest's flow (plus-ones offered, capacity waitlists, approval holds, email required, phone asked, guest list hidden, comments off); the questions editor's rows of `questions.spec.ts` run in the sheet. Keyboard and accessibility rows.

## Notes for the implementer

- Commit subject, e.g. `Editor: the settings guests never see, in one sheet`.

## Comments

**2026-11-03, implementing agent (Opus, in the maintainer's session).** Done, built with ticket 05 rather than as a temporary sheet replaced later.

- `src/editor/settings-sheet.tsx`: one tall sheet from the toolbar, "Everything a guest doesn't see. The defaults are ready, so you can publish without opening this." under its heading; Guests (plus-ones 0–10, ask for their names, capacity with the 0.4 hint, approve each reply), Questions (0.4's editor, answer counts kept), Contact details (email, the code only with mail and only while email is asked, phone), Guest list, Emails and comments.
- Every change saves (debounced, and on closing) through `saveSettingsAction`, which reuses `parseEventSettings` and `parseQuestions` from the 0.4 form. A refusal names its control: a capacity out of range is said under Capacity with `aria-invalid`, a question's under the questions; anything else at the top of the sheet. A question with nothing asked yet is not sent.
- Browser: the settings rows of `capacity` (new: the capacity refused beside its field), `approval`, `email-code`, `comments`, `reminders`, `questions`, `invites` and `duplicate` set and read them in the sheet through `editSettings` and `openSettings`; keyboard and accessibility rows cover the sheet.

**2026-11-03, the browser run.** `docker compose --profile test up -d --build --wait` from the working tree of tickets 03, 05, 06 and 07 together, then `CI=1 pnpm exec playwright test --workers=2`, every project: **538 passed, 2 failed, 1 flaky** in 59.9 min. The two failures were one row of `rsvp-sheet.spec.ts` still measuring the guest page's Design button, which ticket 06 removed; rewritten, the file passes (11 of 11). The flaky row, `accessibility.spec.ts:451` (dark tone), once saw a page with no `<title>` just after a comment was posted and passed on retry; repeated three times each tone, it passed every time. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 796 passed (75 files).
