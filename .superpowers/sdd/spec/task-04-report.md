# Task 04 report: Operator role, registration mode, and host invitations

**Status:** DONE_WITH_CONCERNS (all seven checkboxes met; the concerns are below and none blocks)

Commits on `m1-remaining`:

- `631dd11` Operator: the first account runs the instance, chooses who may sign up, and hands out host invitations
- `ba83345` Poster test: wait for the poster to be saved before switching back to the background

## What I implemented

### The operator, structurally one

- `instance_settings` (migration `drizzle/0013_operator_and_host_invitations.sql`) is a single-row table. Its key is `boolean PRIMARY KEY DEFAULT true` with `CHECK (id)`, so a second row is impossible (checked: inserting `false` violates the check, and inserting `true` again violates the key). It holds `registration_mode` (enum `invitationOnly | open`, default `invitationOnly`), `operator_id` (FK to `user`, `ON DELETE SET NULL`), and `first_account_email` (explained below). The operator is one column, so two operators cannot exist.
- The migration inserts the row and makes the earliest existing account (`ORDER BY created_at, id`) the operator. On the local database (3,480 accounts) the earliest became the operator and the mode was Invitation only.

### Who may sign up: one hook, atomic in the database

- Every new host, by email, Google, or GitHub, goes through `databaseHooks.user.create.before` in `src/auth/auth.ts`. I read Better Auth 1.7.5's source to confirm what it receives and how refusals come out: the hook gets the endpoint context (`context.getCookie` reads the request's cookies, both for server-side `auth.api.signUpEmail({ headers })` and for the OAuth callback route). A thrown `APIError` with `body.code` is re-thrown by `signUpEmail` to the caller. In the OAuth callback it becomes a redirect to the `errorCallbackURL` with `?error=<code>` appended (`callback.mjs`: `if (isAPIError(e) && e.body?.code) redirectOnError(...)`).
- `admitNewHost` (`src/instance/admission.ts`) runs two atomic statements (`src/instance/repository.ts`). Then the pure rule `signUpRefusal` decides:
  - `claimEmptyInstance(email)`: `UPDATE instance_settings SET first_account_email = $email WHERE NOT EXISTS (SELECT 1 FROM "user") AND (first_account_email IS NULL OR first_account_email = $email) RETURNING`. The row lock makes the second of two simultaneous first sign-ups re-check and find the claim taken. That sign-up then goes through the normal rules (in Invitation only mode it is refused). This makes the gate atomic, not only the operator assignment.
  - `redeemHostInvitation(token, email, now)`: `UPDATE host_invitation SET used_at, used_by_email WHERE token_hash = $h AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now RETURNING`.
  - Refusals are thrown as `APIError("FORBIDDEN", { code: "HOST_INVITATION_REQUIRED" | "HOST_INVITATION_UNUSABLE" })`. The email form shows them through `authErrorMessage` (`Auth.errors`). A refused social sign-up lands on `/sign-in?socialError=1&error=<code>`, which shows the matching sentence (`Auth.signIn`). Other provider errors still get the generic message.
- `databaseHooks.user.create.after` → `seatNewHost`: `SET operator_id = coalesce(operator_id, $id), first_account_email = NULL WHERE first_account_email = $email`. Then, if the email is `OPERATOR_EMAIL`, `SET operator_id = $id`. The result is the same in either order when a first sign-up and the `OPERATOR_EMAIL` sign-up race.
- `OPERATOR_EMAIL` (`src/instance/env.ts`, normalized lowercase). It is promoted at every start in `src/instrumentation.ts` after migrations, if the account exists. That email is always let in, and it is the operator as soon as its account is created.

### Host invitations

- `host_invitation` table: `token_hash` (SHA-256 of 24 random bytes, base64url; only the hash is kept, like RSVP edit tokens), optional `email`, `created_at`, `expires_at` (+14 days), `used_at`, `used_by_email`, `revoked_at`.
- The link is `/host-invitation/<token>` (route handler, like `/r/<token>`). An unknown token gets the not-found page. Otherwise the handler sets an httpOnly, SameSite=Lax, one-hour, secure-on-https cookie and redirects to `/sign-up`. The create hook reads that cookie, so the invitation survives the Google/GitHub round trip.
- The sign-up page works out a notice with `signUpNotice` (pure): "invitation only, you need a host invitation", "you have a host invitation" (whatever the mode; it fills in the email when the invitation is addressed), or "this host invitation can no longer be used". An empty instance asks for nothing, so its first account can be made. Open mode says nothing about invitations.
- `/instance` ("Instance settings"):
  - Registration radio (Invitation only / Open) with Save.
  - Create form: optional email, plus an "Email the link to this address" checkbox rendered only when SMTP is configured.
  - The new link is shown once in a read-only field with Copy link. If sending fails, the page still shows the link with a message.
  - The list, newest first, shows a badge (Pending / Used / Revoked / Expired, from the pure `hostInvitationState`), "Expires in N days" or "Used by <email>", and Revoke on pending ones only. Revoke only affects an unused, unrevoked row, so a use and a revoke that race resolve to one of them.
- Not-found for everyone else: `requireOperator()` (`src/auth/session.ts`) calls `notFound()` for signed-out visitors and non-operators, in `generateMetadata` too. The page sits outside the `(host)` group because that layout redirects signed-out visitors to sign-in. I extracted the header into `src/app/(host)/host-header.tsx` and use it in both places. It shows "Instance settings" (a settings icon with an sr-only name at phone width) to the operator only. The browser test checks the status (404), the heading, and the `<title>` match an unknown URL.

## TDD evidence for the pure rules

Pure rules are in `src/instance/host-invitation.ts` (expiry, state, days left) and `src/instance/registration.ts` (`signUpRefusal`, `signUpNotice`, `isOperatorEmail`), with 20 tests in `host-invitation.test.ts` and `registration.test.ts`.

**RED:** I wrote the tests first, then stubs with the right signatures returning placeholder values, so they fail on behaviour rather than on a missing module.

```
$ pnpm exec vitest run src/instance
 ❯ src/instance/host-invitation.test.ts (6 tests | 5 failed)
     × is fourteen days after the invitation was made
     × expires at the end of its fourteen days, so a dead link never reads as live
     × is used once someone has signed up with it, however long ago
     × is revoked once the operator has revoked it, even after it would have expired
     × counts a part of a day as a day
 ❯ src/instance/registration.test.ts (14 tests | 6 failed)
     × refuses a sign-up without a host invitation while registration is invitation only
     × says so when the host invitation it came with can no longer be used
     × explains that a host invitation is needed while registration is invitation only
     × says a host invitation can no longer be used when that is what the visitor came with
     × welcomes a visitor with a pending host invitation, whatever the mode
     × matches the address OPERATOR_EMAIL names, ignoring case and surrounding spaces
AssertionError: expected 2026-09-24T10:00:00.000Z to deeply equal 2026-10-08T10:00:00.000Z
AssertionError: expected 'pending' to be 'expired'
AssertionError: expected null to be 'HOST_INVITATION_REQUIRED'
...
 Test Files  2 failed (2)
      Tests  11 failed | 9 passed (20)
```

(The 9 that passed against the stubs are the "lets in" / "null" cases, which a stub returning null or false satisfies. They are pinned by the mutation checks below.)

**GREEN:**

```
$ pnpm exec vitest run src/instance
 Test Files  2 passed (2)
      Tests  20 passed (20)
```

**Mutation checks.** Each of these made exactly one test fail, and I restored the code after each:

- `now < expiresAt` → `<=` in the state rule.
- `Math.ceil` → `Math.floor` in days left.
- Expiry checked before revoked in the state rule.
- Dropping `|| !facts.hasAccounts` from `signUpNotice`.
- Dropping the blank-setting guard in `isOperatorEmail`.

**Browser mutation.** I dropped `isNull(usedAt)` from the redemption query and rebuilt `app-fresh`. "a host invitation link lets one person sign up, and nobody after them" then failed, and the following serial tests did not run. Restored.

**Real concurrency.** A throwaway script, not committed, ran against a scratch database through a 10-connection pool. 60 concurrent `claimEmptyInstance` calls with different emails, and 60 concurrent redemptions of one invitation: exactly one of each won, in 3 of 3 runs. After an account existed, 40 further claims all failed. Seating the winner left it as the only operator.

## Test results

- `pnpm lint`: clean. `pnpm typecheck`: clean. `pnpm test`: 35 files, 277 tests pass (20 new).
- **Definitive browser runs** used freshly built images on the Compose `test` profile (`docker compose --profile test up -d --build --wait && pnpm exec playwright test`):
  - Local stack with the persistent main database: 174 passed, twice in a row after the final code change.
  - From nothing, as CI starts: a separate Compose project (`COMPOSE_PROJECT_NAME=openinvites-ci`, empty volumes), so the local database was kept. There, 174 passed. The operator setup was the first account on an empty main database. I then tore that project down with its volumes and images, and restored the local stack.
- The count is 162 existing tests, plus 1 operator setup, plus 2 new scenarios × 2 widths on `app`, plus 7 serial scenarios on `app-fresh`, which comes to 174.
- **Checked by hand:**
  - Pointing `OPERATOR_EMAIL` at an existing non-operator and restarting made that account the operator: it got the link and a 200 on `/instance`, while the previous operator got a 404. Setting it back reversed that.
  - With `SMTP_URL` empty there is no send checkbox, and the link is still shown.
  - `/sign-in?socialError=1&error=HOST_INVITATION_REQUIRED` and `...UNUSABLE` show the right sentences; `error=access_denied` shows the generic one.
  - Screenshots at 390px and desktop of the instance page, the header, and the invited sign-up page look right.

### Test design, and why it differs from the suggestion

- **Main `app` in Open mode, set through the product.** `app` sets `OPERATOR_EMAIL=operator@openinvites.test`, and `.env.development` sets the same value so the dev loop works. A Playwright **setup project** (`e2e/operator.setup.ts`) signs that account in, or signs it up if no earlier run left it, then opens `/instance`, picks Open, and saves. The `mobile` and `desktop` projects depend on it. Tests make no database writes. This works on an empty database (the account becomes the first account) and on a persistent one (a first run signs up through `OPERATOR_EMAIL`; later runs sign in).
- **The first account and the modes run on a separate instance whose database starts empty on every run.** This is `app-fresh` (port 3002) on **`db-fresh`**, a Postgres whose data directory is a **tmpfs**. `e2e/registration.spec.ts` runs in its own `fresh-instance` Playwright project, serially. Its `beforeAll` runs `docker compose --profile test up -d --force-recreate --no-deps --wait db-fresh app-fresh`.
  - Why not the one-shot reset service the brief suggested: I tried it with throwaway alpine services on Compose 5.5.1. A second `docker compose up` re-runs an exited one-shot but leaves an unchanged running dependent container alone, even with `depends_on.restart: true`. On the second local run, the database would be dropped under a running `app-fresh` that never re-migrates. So the reset has to be started by the test run itself. Recreating a tmpfs Postgres gives an empty database with no drop script. `--no-deps` leaves `db` and `mail`, which the other workers use, alone; with both services named, it still waits for `db-fresh` to be healthy before starting `app-fresh` (checked).
  - Retries on CI re-run the serial group, including `beforeAll`, so a retry also starts clean.
- **Viewports.** The spec is one instance, so it runs in one project. The operator uses a desktop context and the people signing up use 390px phone contexts, so the sign-up page with every notice is checked at phone width and the instance page at desktop. `e2e/instance-settings.spec.ts` covers the operator's header link and the not-found page for everyone else at both widths.

## Files changed

New:

- `src/instance/registration.ts`, `registration.test.ts`
- `host-invitation.ts`, `host-invitation.test.ts`
- `host-invitation-token.ts`
- `repository.ts`, `admission.ts`, `actions.ts`, `emails.ts`
- `src/app/instance/page.tsx`, `instance-forms.tsx`
- `src/app/host-invitation/[token]/route.ts`
- `src/app/(host)/host-header.tsx`
- `drizzle/0013_operator_and_host_invitations.sql`, `drizzle/meta/0013_snapshot.json`
- `e2e/operator.setup.ts`, `e2e/instance-settings.spec.ts`, `e2e/registration.spec.ts`

Modified:

- `src/db/schema.ts`
- `src/auth/auth.ts` (the hooks), `src/auth/session.ts` (`requireOperator`)
- `src/instance/env.ts` (`operatorEmail`)
- `src/instrumentation.ts` (promotion at start)
- `src/app/(host)/layout.tsx` (uses the extracted header)
- `src/app/(auth)/sign-up/page.tsx`, `sign-up-form.tsx` (notice, prefill)
- `src/app/(auth)/sign-in/page.tsx` (social refusal message)
- `messages/en.json`
- `drizzle/meta/_journal.json`
- `compose.yaml` (`OPERATOR_EMAIL` on `app`; `db-fresh`, `app-fresh`)
- `playwright.config.ts` (setup and fresh-instance projects)
- `e2e/hosts.ts` (`OPERATOR`, `submitSignUp`)
- `.env.development`
- `README.md` (Configuration row, a new "The operator, registration, and host invitations" section, Compose profiles, layout)
- `.github/workflows/ci.yml` (logs `app-fresh` on failure)
- `e2e/poster.spec.ts` (second commit)

Bookkeeping, not staged: `.scratch/openinvites/issues/04-operator-admin-settings.md` (status done, all seven boxes ticked, dated comment).

## New environment variables

- `OPERATOR_EMAIL`: the operator's own account. Optional. It is documented in README's Configuration table, and set in the test profile's `app` (`operator@openinvites.test`), `app-fresh` (`operator@fresh.openinvites.test`), and `.env.development` (`operator@openinvites.test`, so the dev loop's setup project works).

## Self-review

- **Glossary:** the interface says "host invitation" throughout; no new string uses "invite". The page is titled "Instance settings", not "admin", because the glossary keeps "admin" out as a word for the operator. The only "invite" left in `en.json` is the event page's pre-existing guest-facing "You're invited to".
- **Stays within the ticket:** no rate limits, legal pages, or contact changes (ticket 18). Existing code changed only where needed: the header extraction (no change in behaviour), `signUp` in `e2e/hosts.ts` split into `submitSignUp` + `signUp`, and the one-line poster test fix.
- **Security:**
  - The link is the credential: 192 random bits, stored hashed, shown once.
  - Every server action re-checks `requireOperator`.
  - The revoke action validates the UUID.
  - The invitation cookie is httpOnly, Lax, and one hour.
  - The not-found response matches an unknown URL in status, heading, and title.
- **Accessibility:** radios with labels inside a fieldset with a (screen-reader-only) legend; the icon-only header link at phone width has a screen-reader name; confirmations use `role="status"` on the sentence, as `FormOutcome` does.

## Concerns

1. **`OPERATOR_EMAIL` can be squatted.** Following the ruling, anyone who knows or guesses its value can sign up with it before the real operator does and become the operator. The email need not be verified, and with GitHub even an unverified provider email would do for a new account. The recovery is to change the variable and restart. A later ticket might require a verified email when SMTP is configured; at minimum the deployment docs (ticket 19) should say to create that account promptly.
2. **The social refusal and the invitation cookie across OAuth are not tested end to end.** No test can reach Google or GitHub. They rest on reading Better Auth's source (hook context, callback error redirect) and on the hand check of the sign-in page messages.
3. **Edge states that `OPERATOR_EMAIL` resolves:**
   - If the operator deletes their account, the instance has no operator.
   - If an admitted sign-up then fails to create its account (only a database failure, or the same email signing up twice at the same instant), its invitation stays used. On an empty instance, the claim also stays with that email, which may retry.
4. **An invitation is used up whenever a sign-up arrives with a still-valid one,** even when it would have been let in anyway (Open mode, or `OPERATOR_EMAIL`), so the list says who used it. That is my choice, not stated in the brief.
5. **Glossary overlap:** "Pending" is also the glossary's word for an RSVP awaiting approval (M3). The brief asked for Pending here, so I did not propose a CONTEXT.md change, but it may deserve a note there.
6. **Flaky specs under full-suite load, from other tickets:**
   - `poster.spec.ts` "switching back to the background..." failed in 2 of my first 3 full runs. It was a genuine race in the test (its wait could be satisfied before either save), not a product bug, because a page's server actions are processed in order. I fixed it in its own commit (`ba83345`), and it passed in every run since.
   - `guest-list.spec.ts` "the host sees every guest's details..." (a click that did not take, as if before hydration) and `rsvp-sheet.spec.ts` "a guest answers in a sheet..." (confirmation slower than 5 s) each failed once across 6 full runs. Both pass alone (repeated) and in the other runs. I left them alone. The suite now does a little more at the start (recreating `app-fresh`) and has 12 more tests, which may make such timing flakes slightly more likely.
7. **Dev loop:** running `e2e/registration.spec.ts` needs the test-profile image built (`docker compose --profile test build app-fresh`), because its `beforeAll` starts the containers itself. The README Compose profiles row describes `app-fresh`, and the ticket comment notes the build step.
8. Vitest prints a pre-existing warning about `vitest.config.ts` and Vite's native config loader on every run. It predates this ticket and I did not touch it.

---

# Fix round 1: OPERATOR_EMAIL takeover (review finding, Important, plan-mandated)

**Status:** DONE_WITH_CONCERNS (the finding is fixed; the concerns are at the end)

Commit: `b4be3cd` Operator: the OPERATOR_EMAIL address runs the instance only once it proves it holds it. It is a new commit; nothing was amended.

## What changed

The fix follows the coordinator's ruling, which replaces the earlier `OPERATOR_EMAIL` ruling.

- **The sign-up exemption is kept.** `admitNewHost` still lets the `OPERATOR_EMAIL` address in whatever the registration mode. Signing up no longer seats the account by itself.
- **One pure rule decides the seat.** `operatorEmailSeat(moment, account, mailConfigured)` (`src/instance/registration.ts`, unit tested) returns one of:
  - `take`: replace whoever holds the seat;
  - `takeIfEmpty`: take it only while nobody holds it;
  - `none`.

  The rule itself:
  - With mail: `take` when the account's email is verified, `none` otherwise, at any moment.
  - Without mail: at creation (`"account"`), `takeIfEmpty`; at start, `take`.
- **Where the rule is applied** (`src/instance/admission.ts`), only for the account whose email is the `OPERATOR_EMAIL` address:
  - **At creation:** `seatAdmittedHost`, the `databaseHooks.user.create.after` hook. Better Auth hands it the created user with `emailVerified` as the provider reported it (Google, or a verified GitHub email).
  - **On verification:** `seatVerifiedHost`, wired as `emailVerification.afterEmailVerification` in `src/auth/auth.ts`. I confirmed it in Better Auth 1.7.5 at `api/routes/email-verification.mjs:296` (ordinary verification) and `:229` (change-email verification, where the updated user carries the new address). It exists only when mail is configured, because `emailVerification` does.
  - **At start:** `promoteOperatorAtStart`, called from `src/instrumentation.ts`, reads the account's `email_verified` and applies the rule for `"start"`.
- **Repository** (`src/instance/repository.ts`):
  - `seatNewHost` is split into `seatFirstAccount` (the unchanged first-account claim resolution) and `takeOperatorSeat(hostId, seat)`. For `takeIfEmpty` the statement itself checks, as `UPDATE instance_settings SET operator_id = $id WHERE operator_id IS NULL`, so the vacancy check is atomic.
  - `promoteOperator` is replaced by `findAccountByEmail` plus the rule.
- **README:**
  - The `OPERATOR_EMAIL` row describes the new behaviour.
  - The recovery advice is now four numbered steps: use an address other than `OPERATOR_CONTACT_EMAIL`; sign up or sign in; verify, or without mail restart; then unset the variable and restart.
  - It says plainly that without mail, a restart trusts whoever holds the account with that address, and that any host can change their email to it at once, so the variable should be set only for the restart that needs it.
  - The Compose profiles row lists `app-no-mail` and `db-no-mail`.
- `.env.development`, `compose.yaml`, and the CI log step (now also `app-no-mail`) are updated to match.
- The first-account rule is unchanged: the first account on an empty instance is the operator whether or not it is verified.

## Covering tests

**Unit (test first).** Four new tests in `src/instance/registration.test.ts` under `operatorEmailSeat`:

- with mail, an unverified account is never seated, at creation or at start;
- with mail, a verified account takes the seat from whoever holds it;
- without mail, a new account takes the seat only while it is empty;
- without mail, a start hands the seat over.

RED ran against a stub returning `"take"`, which is the old, unconditional behaviour:

```
$ pnpm exec vitest run src/instance
     × with mail, never seats an account whose email is not verified, whenever it is asked
     × without mail, seats a new account only while nobody is the operator
AssertionError: expected 'take' to be 'none' // Object.is equality
AssertionError: expected 'take' to be 'takeIfEmpty' // Object.is equality
 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 22 passed (24)
```

GREEN:

```
$ pnpm exec vitest run src/instance
 Test Files  2 passed (2)
      Tests  24 passed (24)
```

Two unit mutations each made exactly one test fail, and I restored the code after each:

- the no-mail branch always returning `takeIfEmpty`;
- the mail branch ignoring verification.

**Browser, on `app-fresh` (mail through Mailpit).** `e2e/registration.spec.ts`, "the email OPERATOR_EMAIL names signs up anyway, and takes over as the operator once it is verified":

1. The sign-up succeeds in Invitation only mode, with the "Verify your email" banner, no Instance settings link, and not-found on `/instance`.
2. `app-fresh` is restarted (`recreate("app-fresh")`; the database is kept): the account still has no link, and the first account still does.
3. The verification link from Mailpit is opened: the account now has the link, and the first account lost it and gets not-found.

**Browser, a no-mail instance.** It wasn't too heavy to add. `app-no-mail` (port 3003) runs on `db-no-mail` (tmpfs), the same pattern as `app-fresh` without SMTP. `e2e/registration-without-mail.spec.ts` (serial, in the `fresh-instance` project, recreated in `beforeAll`) checks:

- the first account is the operator, has no "Email the link" box, and still gets a link to copy;
- a new `OPERATOR_EMAIL` sign-up does not displace the operator: no link and not-found for it, while the first account keeps the link;
- a restart hands the seat over: the new account gets the link, the first account loses it. This is also the first browser test of promotion at start.

**Harness changes:**

- `e2e/operator.setup.ts` now verifies the operator's email through Mailpit, after signing up, or after "Resend email" for an unverified account an earlier run left, before opening registration. On CI the account is the first account anyway.
- `latestMailTo` and `verifyEmail` take an `after` count, because Mailpit keeps mail for the fixed operator addresses across runs.
- `e2e/instances.ts` holds `recreate(...)`, used by both fresh-instance specs.

**Browser mutations**, each rebuilt into the image and restored afterwards:

- `operatorEmailSeat` always `"take"` (the old behaviour): the `app-fresh` scenario failed at "no Instance settings link after sign-up", and the no-mail scenario "does not take over from the operator" failed.
- Promotion at start treating the account as verified: the `app-fresh` scenario failed exactly at the post-restart assertion (`registration.spec.ts:78`). A first attempt at this mutation did not compile (TypeScript narrowing), and that run only exercised the previous image. I noticed the failed build and redid the mutation in a form that builds.

## Commands and output

```
$ pnpm lint                  → eslint, no findings
$ pnpm typecheck             → ✓ Types generated successfully (tsc clean)
$ pnpm test                  → Test Files 35 passed (35) · Tests 281 passed (281)
$ docker compose --profile test up -d --build --wait    → exit 0 (image rebuilt, 8 services healthy)
$ pnpm exec playwright test e2e/instance-settings.spec.ts e2e/registration.spec.ts e2e/registration-without-mail.spec.ts
                             → 15 passed (27.6s): operator setup, 7 app-fresh, 3 app-no-mail, 2×2 instance-settings
$ pnpm exec playwright test  → 177 passed (3.1m)   [local stack, persistent main database]
```

The setup's verify path ran against the local database's previously unverified operator account, which is now verified and still the operator.

From nothing, as CI starts (separate Compose project, empty volumes, torn down afterwards and the local stack restored): 176 passed, 1 failed. The failure was `rsvp-sheet.spec.ts:32` (desktop, ticket 11): after "Send RSVP", "You're a maybe." did not appear within 5 s, and the sheet was still on the plus-ones step. It ran as test #154 of 177, long after the fresh-instance specs, which finish within the first ~30 s. It is a guest RSVP step this ticket does not touch. It passes 8 of 8 alone at desktop, and it passed in every full run on the local stack. It also failed once in the from-nothing run before this fix.

## Files changed in this round

- `src/instance/registration.ts`, `registration.test.ts`, `repository.ts`, `admission.ts`, `env.ts`
- `src/auth/auth.ts`, `src/instrumentation.ts`
- `e2e/hosts.ts`, `e2e/instances.ts` (new), `e2e/operator.setup.ts`, `e2e/registration.spec.ts`, `e2e/registration-without-mail.spec.ts` (new)
- `compose.yaml`, `playwright.config.ts`, `README.md`, `.env.development`, `.github/workflows/ci.yml`

Bookkeeping: I updated the ticket comment's `OPERATOR_EMAIL` description, rewrote the "after hook" line, labelled the earlier hand check as before this round, removed the now-obsolete squatting note, and appended a dated fix-round entry.

## Concerns

1. On an instance without mail, promotion at restart still trusts whoever holds the account with the address, and any host can change their email to it at once. The ruling accepts this, and README now says to set the variable only for the restart that needs it.
2. With mail, the verification-at-creation path for Google and GitHub is still not exercised end to end, because no provider is reachable. It uses the same `create.after` hook and the provider's `emailVerified`, which I read in Better Auth's source.
3. `rsvp-sheet.spec.ts` "a guest answers in a sheet..." is intermittently slow or flaky in the from-nothing runs (2 of 3). It is unrelated to this ticket and I left it alone; it may deserve its own look.
4. The fresh-instance project now restarts containers twice mid-spec (`app-fresh` once, `app-no-mail` once, about 8 s each). This happens early in the run, while the main suite's first tests are running.
