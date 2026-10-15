# Task S1: make the browser suite pass reliably from empty volumes

Not a ticket; inserted by the controller before ticket 18 because CI starts from empty volumes and every later ticket's definitive run depends on a green suite.

## Observed

- `e2e/rsvp-sheet.spec.ts`, the scenario "a guest answers in a sheet…" (ticket 11), failed in 2 of 3 full runs started from empty Compose volumes (a separate Compose project, as CI starts), late in the run. It passes 8/8 on its own and in every local full run on the persistent stack. Ticket 04's implementer suspected a 5 s wait.
- `e2e/guest-list.spec.ts` failed once in 6 full runs under load and passes alone; ticket 04's reviewer suspected a click before hydration.
- The suite now starts more containers than before (`app`, `app-social`, `app-fresh` + `db-fresh`, `app-no-mail` + `db-no-mail`), and the fresh-instance project restarts two containers mid-run.

## Acceptance

- [ ] Find the root cause of each flake from evidence (trace, screenshot, app logs), not by guessing. If the cause is in the product (a real race a guest or host could hit), fix the product and say so; if it is in the test, fix the test so it waits on what a person would observe, never on a fixed sleep or a raised global timeout.
- [ ] The full suite passes three consecutive times from empty volumes in a separate Compose project (as CI does), and once on the local persistent stack.
- [ ] No test is skipped, deleted, retried into passing, or given `test.fixme`; Playwright's `retries` setting is not raised.
- [ ] If the cause is general (for example a helper that clicks before hydration), fix it at the helper so every spec benefits, not only the two named.

Commit with the usual conventions; subject like `Browser tests: <what now holds>`.
