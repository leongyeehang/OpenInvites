# Task 1 report: the host is emailed when a guest replies

**Status:** DONE_WITH_CONCERNS
**Commit:** `cfe225d` Mail: the host is emailed when a guest replies, from a queue inside the app (on `m2-social`, staged by path; `.scratch/`, `CONTEXT.md`, `.superpowers/` untouched in the commit)
**Ticket:** `.scratch/m2-social/issues/01-host-emailed-on-replies.md`: all 9 boxes ticked, status `done`, dated comment appended (not staged).

## What I implemented

- **Migration `drizzle/0014_mail_outbox_and_reply_notifications.sql`**:
  - `mail_outbox` with the ticket's columns. `send_after` defaults to `now()`, and `event_id` gets an index, like every other event foreign key.
  - `event.notify_on_rsvp boolean not null default true`, plus a hand-added `UPDATE "event" SET "notify_on_rsvp" = false` for existing rows.
  - `event.locale text not null default 'en'`, typed `Locale` in `schema.ts`.
- **`src/mail/retry.ts`**: `nextAttempt(attempts, now)` returns `Date | null`, where `attempts` counts failures including the one just now. 1→+1m, 2→+5m, 3→+15m, 4→+60m, 5→null.
- **`src/mail/outbox.ts`**:
  - `queueMail(rows)`, where rows are `{ eventId, to, subject, text }`.
  - `sendDue(now)` loops over `sendOne`. Each `sendOne` is its own transaction: `SELECT … WHERE send_after <= now ORDER BY send_after, id LIMIT 1 FOR UPDATE SKIP LOCKED`, then `sendMail`.
  - A message that sends is deleted. A failure writes `attempts+1`, `last_error` and the next `send_after`.
  - The fifth failure deletes the row and logs one line: `Mail: gave up on a message to …@domain after 5 attempts: <error>`. The full address is also replaced inside the error text.
- **`src/mail/worker.ts`**:
  - `startMailWorker()` does nothing when `NEXT_PHASE === PHASE_PRODUCTION_BUILD` or mail is not configured. Otherwise it sets `setInterval(kick, 60s)`, once.
  - `kickMailWorker()` sends what is due now. A `running` flag and an `again` bit live on `globalThis[Symbol.for("openinvites.mailWorker")]`, because the instrumentation bundle and the action bundles are separate module instances in one process (same pattern as the rate limits).
  - Errors are logged and the next tick retries.
- **`src/instrumentation.ts`**: lazily imports the worker and starts it, after the start checks and the operator promotion.
- **`src/events/hosts.ts`**: `eventHosts(eventId)` → `{ id, name, email }[]`. It is a single select from `event` joined to `user`; ticket 05 changes only that query.
- **`src/rsvps/notice.ts`**: `rsvpNotice(before, after)`. It takes statuses, with null for no RSVP, and returns `"replied" | "changed" | "removed" | null`.
- **`src/rsvps/notify-hosts.ts`**: `notifyHostsOfRsvp(event, previous, current)`:
  - applies the rule, then checks `notifyOnRsvp` and `isMailConfigured()`;
  - translates with `getTranslations({ locale: event.locale, namespace: "Mail.rsvpReply" })`;
  - queues one row per host from `eventHosts`, then calls `after(kickMailWorker)`.
- **`src/rsvps/actions.ts`**: all four paths call it (guest save, guest withdraw, host edit, host removal).
  - `editRsvpAsHost` now returns the row as it was, read `FOR UPDATE` in the same transaction as the update.
  - `deleteRsvp` returns the removed row.
- **`src/locale/request.ts`**: honours the locale a caller names (`getTranslations({ locale })`). Before, it always resolved the visitor's cookie or Accept-Language locale, so an explicit locale was silently ignored. Behaviour without a named locale is unchanged.
- **Event form**:
  - New checkbox "Email me when a guest replies" (`notifyOnRsvp`), checked by default for a new event. It is parsed in `events/form.ts`, and `form.test.ts` was updated for the new field.
  - Both save actions now store `locale: await getLocale()`.
- **Messages** (English only, `messages/en.json`): `Mail.rsvpReply.{subject,body}.{replied,changed,removed}` and `Mail.rsvpReply.status.{going,maybe,cant}`, plus `Events.form.notifyOnRsvp`.
- **Docs**: `docs/operator/configuration.md`, Mail section. The list gains the reply email, and a new paragraph says event mail goes from a queue inside the app container and a failed message is retried a few times (about an hour and a half) before it is dropped and logged.
- **Browser test** `e2e/notifications.spec.ts`. `e2e/events.ts` `createPublished` now also returns the host's `email`.

## TDD evidence

RED, with stubs returning `null` (before that, the command also failed with `Cannot find module './notice'` / `'./retry'`):

```
$ pnpm exec vitest run src/rsvps/notice.test.ts src/mail/retry.test.ts
 FAIL  src/mail/retry.test.ts > nextAttempt > tries a failed message again after 1, 5, 15 and then 60 minutes
AssertionError: expected null to deeply equal 2027-03-06T10:01:00.000Z
 FAIL  src/rsvps/notice.test.ts > rsvpNotice > tells the hosts when a guest replies for the first time, whatever they answer
AssertionError: expected null to be 'replied' // Object.is equality
 FAIL  src/rsvps/notice.test.ts > rsvpNotice > tells the hosts when the RSVP status changes
AssertionError: expected null to be 'changed' // Object.is equality
 FAIL  src/rsvps/notice.test.ts > rsvpNotice > tells the hosts when the RSVP is removed
AssertionError: expected null to be 'removed' // Object.is equality
 Test Files  2 failed (2)
      Tests  4 failed | 3 passed (7)
```

GREEN:

```
$ pnpm exec vitest run src/rsvps/notice.test.ts src/mail/retry.test.ts
 Test Files  2 passed (2)
      Tests  7 passed (7)
```

## Tests run and results

- `pnpm lint`: clean. `pnpm typecheck` (after `rm -f tsconfig.tsbuildinfo`): clean.
- `pnpm test`: 385 passed, **2 failed**: `translations.test.ts` › "the translation files give zh-Hans/zh-Hant every English message", which reports `Mail.rsvpReply is missing` and `Events.form.notifyOnRsvp is missing`. See concern 1. Everything else passes. Vite also prints its `configLoader: 'native'` warning about `vitest.config.ts`, which comes from the existing config and not from this change.
- **Browser, production build** (`pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000, Compose dev profile for Postgres and Mailpit):
  - `notifications.spec.ts`, `rsvp.spec.ts` and `guest-list.spec.ts` with the operator setup, `--workers=2`: **35/35 passed** (1.9 min).
  - After committing, I rebuilt `cfe225d` and ran `guest-list.spec.ts` + `notifications.spec.ts` (18/18) and rsvp's "removes their RSVP" (2/2). Mailpit then showed:
    - host edit: "replied … Going", then "changed their RSVP … Maybe", and nothing for the plus-one-only edit;
    - host removal and guest withdraw: "replied … Going", then "removed their RSVP …", with the body "Their RSVP said Going.".
- **Browser, `next dev` fast loop** (as the context file asks; this 4 GB VM had swap 100% full throughout):
  - `notifications.spec.ts`: 2/2 at `--workers=1`. At `--workers=2`, the guest's first `page.goto` hit the 90 s timeout.
  - `rsvp.spec.ts` and `guest-list.spec.ts` at `--workers=1`: 2 and 8 failures, all 5-second waits after an action.
  - Control runs with `notifyHostsOfRsvp` returning at once still failed: the rsvp "edit link" test twice on mobile, and guest-list 5 (different tests). So the failures are `next dev` load, not this change. That is why I took the definitive run against a production build.
- **Mutation checks on the browser test's "nothing arrives" fence**: ignoring `event.notifyOnRsvp`, and making `rsvpNotice` return "changed" for an unchanged status, each fails with `Expected: 4, Received: 5`. Both mutations were reverted.
- **Outbox by hand** (`next dev` with `SMTP_URL=smtps://127.0.0.1:1025` so that sending fails at once, rows inserted with psql):
  - At the first tick, a 0-attempt row went to `attempts 1`, `send_after` +1 min, with the OpenSSL error in `last_error`.
  - At the same tick, a 4-attempt row was deleted, and the log read `Mail: gave up on a message to …@example.test after 5 attempts: …wrong version number…`.
  - At the next due tick, the first row went to `attempts 2`, `send_after` +5 min.
  - I cleaned up the rows afterwards.
- **Locale by hand** (a throwaway spec, deleted afterwards, with a marked copy of `Mail.rsvpReply` put in `zh-Hans.json` and then restored):
  - Event saved in English, guest replying in Chinese: the subject was English.
  - Host re-saved the form in Chinese, then an English guest replied: the subject was the marked Chinese one.
- **`next build`**: `pnpm build` with no `DATABASE_URL` succeeded. `register()`, whose migrations would throw without it, never ran, so nothing started during the build. Next.js 16.3's `registerInstrumentation` also returns early under `phase-production-build`.
- **Server log noise**: the production run logged one `⨯ Error: The destination stream closed early.`. HEAD `51453b1`, built and run the same way (my work stashed, then restored and verified byte for byte), logs the same line for `rsvp.spec.ts` + `guest-list.spec.ts`, so it was already there.

## Files changed

`docs/operator/configuration.md`, `drizzle/0014_mail_outbox_and_reply_notifications.sql`, `drizzle/meta/0014_snapshot.json`, `drizzle/meta/_journal.json`, `e2e/events.ts`, `e2e/notifications.spec.ts`, `messages/en.json`, `src/app/(host)/events/event-form.tsx`, `src/db/schema.ts`, `src/events/actions.ts`, `src/events/form.test.ts`, `src/events/form.ts`, `src/events/hosts.ts`, `src/events/repository.ts`, `src/instrumentation.ts`, `src/locale/request.ts`, `src/mail/outbox.ts`, `src/mail/retry.test.ts`, `src/mail/retry.ts`, `src/mail/worker.ts`, `src/rsvps/actions.ts`, `src/rsvps/notice.test.ts`, `src/rsvps/notice.ts`, `src/rsvps/notify-hosts.ts`, `src/rsvps/repository.ts`.

## Self-review findings (fixed before commit)

- The guest-withdraw and host-removal calls nested `await deleteRsvp(...)` inside the notify call. I split them for readability.
- The outbox's success, retry and give-up branches were tangled. I rewrote them as three early-return branches.
- A misplaced comment in `events/repository.ts` (the Birthday-theme note had ended up above the new type) is fixed.
- The test's form save first waited on "Saved." with no reload between saves, so the second save could match the first save's message and race on. Each save now reloads the manage page first.
- I tidied the `event.locale` schema comment and the instrumentation comment.
- I checked `rsvp-flow.tsx`: it is untouched.

## Concerns

1. **`pnpm test` is red from this ticket until ticket 15.** `translations.test.ts` requires every English key in both Chinese files, but the context file and plan say "English only per ticket; Chinese is task 15". Every M2 ticket that adds strings will add to the failure list.
   - I followed the binding "English only" rule and changed neither the test nor the Chinese files.
   - The controller or maintainer should decide: accept red until 15, or have each ticket copy English placeholders into the Chinese files. Placeholders would hide from ticket 15 which keys still need translating.
2. **The browser test proves "nothing arrives" with a fence rather than a wait.** After the two silent saves, the host turns emails back on and the second guest changes to Can't go. The test then expects exactly four emails, relying on the outbox sending in queue order. The test goes a little beyond the ticket's wording; this is so it is deterministic without waiting out the minute.
3. **Retry timing is tick-bound.** `send_after = run start + delay`, and the next tick comes about 60 s after this one, so a 1-minute retry can miss it by milliseconds and go a minute later (seen by hand). This is inherent in minute polling; I left it as is.
4. **A hung SMTP connection holds a run, and its transaction, until nodemailer's timeout** (2 minutes for a dropped connection). Runs never overlap, so this only delays mail.
5. **For ticket 04**: `getTranslations({ locale })` now works in actions. Whether `next-intl/server` works inside the worker (instrumentation bundle, no request) is untested. `createTranslator` with the locale's messages may be needed there.
6. The "Email me when a guest replies" checkbox shows even without mail. Hiding it would post it unchecked and quietly turn events off. A host who edits a guest's status on their own guest list is emailed about it too, as the ticket says.
7. **No glossary change needed.** I avoided "reply" as a noun for an RSVP in code and copy ("changed their RSVP", "removed their RSVP"). The ticket's `Mail.rsvpReply` key name is kept as given.

---

# Fix report 1 (pre-review): Chinese translations, `pnpm test` green

**Status:** DONE
**Commit:** `7573412` Translations: the reply email and its setting read in Simplified and Traditional Chinese. This is a second commit on `m2-social`, after `cfe225d`, with `messages/*.json` staged by path.

## What changed

- **Chinese translations.** `messages/zh-Hans.json` and `messages/zh-Hant.json` gain `Mail.rsvpReply.subject.{replied,changed,removed}`, `Mail.rsvpReply.body.{replied,changed,removed}`, `Mail.rsvpReply.status.{going,maybe,cant}` and `Events.form.notifyOnRsvp`.
  - They use the register of the existing mail strings and the RSVP screens' own words: 回复/回覆, 更改 (as in 更改回复/更改回覆), 宾客名单/賓客名單, 同伴, 参加/待定/无法参加 and 參加/待定/無法參加, and each script's own quotation marks around the title (“” and 「」).
  - Every ICU placeholder is kept. The plural becomes `{plusOnes, plural, =0 {} other {，另带 # 位同伴}}` (and `另外帶` in Traditional), folded to `other` with its `#`.
  - The footer quotes the checkbox exactly as the form labels it: 有宾客回复时给我发邮件 / 有賓客回覆時寄電子郵件給我.
- **English removal wording (one change beyond the translations).**
  - `cfe225d` said "{name} removed their RSVP to {title}". That was wrong when a host removed the guest from the guest list, which sends the same email.
  - It now reads "{name}’s RSVP to {title} was removed" and "… was removed. It said {status}…". Both Chinese scripts use the same neutral 已移除.
  - No test asserts the removal text.

## Covering tests and output

```
$ pnpm exec vitest run src/locale/translations.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ pnpm test
 Test Files  50 passed (50)
      Tests  387 passed (387)
```

- `pnpm lint` passes. `pnpm typecheck` passes after `rm -f tsconfig.tsbuildinfo`.
- I rendered every `Mail.rsvpReply` string in all three locales with `use-intl`'s `createTranslator` (the formatter next-intl uses): a reply with 2 plus-ones, a change to Maybe with none, and a removal with 1. Samples:
  - `Priya Nair 回复了“Ada’s birthday”：参加，另带 2 位同伴。`
  - `Priya Nair 更改了對「Ada’s birthday」的回覆：待定。`
  - `Priya Nair’s RSVP to Ada’s birthday was removed. It said Going, bringing one more person.`
- **No browser rerun.** The test reads only the English reply and change mails, and those strings are unchanged.

## Bookkeeping

- **Ticket comment updated:**
  - The header now names both commits and says lint, type check and `pnpm test` (387) pass.
  - The "pnpm test is red" note is replaced by the Chinese I was least sure of, addressed to ticket 15: the neutral 已移除 removal and its 原来的回复是 sentence, the checkbox wording quoted in the footer, the appended plus-ones fragment, and 你的宾客名单 / 活动设置.
  - The GREEN evidence and the removal wording are updated.
- Nothing is listening on port 3000. The Compose dev containers are stopped.

## Concerns

None new. The removal wording change goes slightly beyond "add the translations", for the reason above.

---

# Fix report 2 (review round 1)

**Status:** DONE
**Commit:** `00aaeab` RSVPs: a failure to queue the hosts' email no longer fails a guest's saved RSVP. This is a new commit; `cfe225d` and `7573412` are untouched.

## Finding 1 (Important): a queue failure could fail a saved RSVP

The two parts of the fix, which are the ones the reviewer asked for:

- **`src/rsvps/notify-hosts.ts`.** Everything after the guard now runs inside `try/catch`: the translator, `eventHosts`, `queueMail` and `after(kickMailWorker)`.
  - A failure logs `Mail: could not queue the hosts' email about an RSVP to event <id>:` with the error, and the function returns normally.
  - The comment now says it never throws, and why.
  - This also protects the host's own edit and removal paths.
- **`src/rsvps/actions.ts`.** The two guest actions now call it only after the device's cookie is written:
  - `saveRsvpAction` sets the cookie before notifying.
  - `removeRsvpAction` deletes the cookie before notifying, as `const removed = mine && (await deleteRsvp(...))`, then deletes the cookie, then notifies.

## Finding 2 (Docs): rate-limit wording

In `docs/operator/configuration.md`:

- **Mail section.** The sentence now reads: "Every request that sends one of the account emails (verification, password reset, an email change, a host invitation) counts against `RATE_LIMIT_MAIL`. The hosts' reply emails come from guests' RSVPs, so `RATE_LIMIT_RSVP` bounds them."
- **Limits table.**
  - The `RATE_LIMIT_RSVP` row adds "This also bounds the emails that tell hosts about replies."
  - The `RATE_LIMIT_MAIL` row now says "Every request that sends an account email: …".

## Covering tests (production build; `next dev` is too slow on this machine)

Each step ran `pnpm build`, then served `node --env-file=.env.development .next/standalone/server.js` on :3000 with the Compose dev profile's Postgres and Mailpit:

1. **Forced failure, fix in place.** `queueMail` was temporarily made to throw. `pnpm exec playwright test e2e/rsvp.spec.ts --workers=2 --no-deps` gave `16 passed (56.2s)`. The server log has 16 lines of `Mail: could not queue the hosts' email about an RSVP to event …: Error: forced queue failure`.
2. **Forced failure, pre-fix actions.** I restored `actions.ts` and `notify-hosts.ts` from HEAD for this run only, with the same command. 12 of 16 failed: every test whose guest saves an RSVP. The confirmation never appeared ("You’re going!", "We’ll miss you.", "Bringing Arjun." not found). The four that passed save no RSVP ("a draft takes no RSVPs", "an edit link nobody was given", each at two widths).
3. **Real run.** I put the fix back and removed the forced throw. `pnpm exec playwright test e2e/notifications.spec.ts e2e/rsvp.spec.ts --workers=2 --grep-invert operator` gave **`19 passed (1.4m)`**: the operator setup, notifications ×2 and rsvp ×16. The only server log line is the known pre-existing `The destination stream closed early.`.
4. `pnpm lint` passes. `pnpm typecheck` passes after `rm -f tsconfig.tsbuildinfo`. `pnpm test`: `Test Files 50 passed (50)`, `Tests 387 passed (387)`.

## Bookkeeping

- **Ticket comment:**
  - The commit list now includes `00aaeab`.
  - The descriptions of `notify-hosts.ts`, the actions and the docs are updated.
  - The forced-failure evidence is added.
- **Workspace:** nothing is listening on port 3000. The dev containers are stopped. The build's symlinks are removed.

## Concerns

None.
