# Task 2 report: guests are told when an event is cancelled, and can stop email about it

**Status:** DONE_WITH_CONCERNS. The concerns are below; none of them blocks a box.
**Commit:** `c69a2c7` Mail: guests who gave an email are told when the event is cancelled, and can stop email about it
**Ticket:** `.scratch/m2-social/issues/02-cancellation-notice-and-stop-emails.md`. Every box is ticked, the status is `done`, and a dated comment is added. The ticket file is not staged.

## What I implemented

- **Schema and migration** (`drizzle/0015_guest_mail.sql`, renamed from drizzle-kit's random name, with the journal tag to match):
  - `rsvp.mail_token`: text, null, with the unique constraint `rsvp_mail_token_unique`.
  - `rsvp.locale`: text, not null, default `'en'`, typed `Locale` like `event.locale`.
  - No data change.
- **Mail token** (`src/rsvps/token.ts`): `generateMailToken()` draws 24 characters of `SLUG_ALPHABET` with `node:crypto` `randomInt`.
- **`saveRsvp(eventId, input & { locale }, mine)`**:
  - It writes `locale` on every save. `saveRsvpAction` passes `getLocale()`.
  - Mail token:
    - A new RSVP with an email gets a fresh token.
    - A replaced RSVP saved with an email gets `coalesce(mail_token, <fresh>)`, so the token is made once and kept, even if two saves race.
    - A save without an email leaves the column alone, so a blanked email keeps its token.
  - The host's edit still writes only the answer.
- **Audience rule** (`src/rsvps/cancellation.ts`): `cancellationAudience(rsvps)` keeps Going and Maybe RSVPs with an email and a mail token, in order. Its type narrows both fields to strings.
- **`src/mail/guest-mail.ts`**: `guestMail(guest, event, { subject, body })` is async and returns one outbox row.
  - It adds a blank line and `Mail.guestFooter`, translated in `guest.locale`.
  - The footer's link is `${baseUrl()}/m/<mail token>`.
- **`src/rsvps/notify-cancellation.ts`**: `notifyGuestsOfCancellation(event)` has the same shape as `notifyHostsOfRsvp`.
  - It does nothing without mail.
  - It reads `listMailableRsvps` (reply order) and applies the audience rule.
  - It translates `Mail.cancelled` in each guest's locale and queues the rows, then calls `after(kickMailWorker)`.
  - It catches and logs any failure, so it never throws.
- **Cancel**:
  - `cancelEvent` now updates only `WHERE state = 'published'`.
  - `cancelEventAction` notifies only when it got the event back.
  - So a repeat press or a stale tab tells nobody twice.
- **Stop page** (`src/app/m/[token]/page.tsx`, with `actions.ts` and `stop-form.tsx` beside it):
  - It is drawn in the request's locale, under a new `StopMail` namespace.
  - It shows the event title, then either "The email on file for this event is {email}." with the button "Stop emails about this event", or "No email is on file for this event."
  - `stopMailAction(token)` blanks the email with one `UPDATE … FROM event … RETURNING title`. It answers "Done. You will get no more email about {title}.", or calls `notFound()` if the RSVP has gone.
  - The page is noindex. A GET changes nothing.
- **Proxy**:
  - `"/m/:path*"` is in the matcher.
  - `notFoundHere` sends a token no RSVP has to the not-found page, whole, with 404.
  - There is no rate limit.
- **Messages** (`en.json`, `zh-Hans.json`, `zh-Hant.json`): `Mail.cancelled.{subject,body}`, `Mail.guestFooter`, and `StopMail.{title,onFile,noEmail,stop,done}`. Both Chinese scripts are translated.
- **Browser tests** (`e2e/guest-mail.spec.ts`, new):
  1. **Cancelling, then stopping.**
     - Three guests reply: a Can't go guest first, then a Going guest, then a Maybe guest, each with an email. The host cancels.
     - The Going and Maybe guests each get exactly one email: an English subject, the body line, the event link, and the footer last.
     - The Can't go guest gets nothing.
     - Fetching the Maybe guest's stop link, as a mail client would, keeps their email.
     - The stop link's token, used as an edit link (`/r/<token>`), gets 404. So does an unknown `/m/` token.
     - The Going guest opens their stop link, sees the address, presses the button and sees the done message.
     - Opened again, the link says "No email is on file" and shows no button.
     - Their RSVP, opened through their edit link on a new device, shows no email, and Edit details has an empty Email field.
  2. **Simplified Chinese.**
     - A guest switches the page to Simplified Chinese with the switcher and replies.
     - Their notice has the Chinese subject, body line and footer.
     - The stop page, opened in the same browser, reads and answers in Chinese.

## Tests and results

All browser runs used the **production-build loop**: `pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000, with `drizzle`, `public` and `.next/static` symlinked into `.next/standalone` and the Compose dev profile up. I did not try `next dev`: ticket 01 found it times out on this 4 GB machine, and swap was 1022/1024 MB full when I started.

- `pnpm lint`: clean.
- `pnpm typecheck` (after `rm -f tsconfig.tsbuildinfo`): clean.
- `pnpm test`: **51 files, 393 tests passed.** The Vite `configLoader: 'native'` warning comes from the existing config.
- Browser runs (two workers, operator setup included):
  - `guest-mail.spec.ts` alone: **5 passed** (44.7 s).
  - `rsvp`, `cancel-delete` and `notifications`: **25 passed** (1.7 min).
  - **Definitive run on the committed code**, `guest-mail`, `rsvp`, `cancel-delete`, `notifications`, `locales`, `rsvp-sheet` and `guest-list`: **63 passed** (4.2 min). The server log has only the known pre-existing `The destination stream closed early.`
- Mutation checks. Each ran on its own rebuild and was then reverted, verified with `cmp` against saved copies:
  - The audience ignoring status: test 1 fails, `Expected: 0, Received: 1` (the Can't go guest's count).
  - `saveRsvpAction` writing `"en"`: test 2 fails, `Expected: "“Ada’s birthday”已取消" Received: "Ada’s birthday is cancelled"`.
  - The page blanking the email on GET: test 1 fails at the prefetch check, because "We’ll reach you at …" is gone.
- Forced failure: with `queueMail` throwing, the `cancel-delete` cancel test passed at both widths. The log had `Mail: could not queue the guests' email about the cancellation of event <id>: Error: forced queue failure` once per cancel. Afterwards `outbox.ts` was restored, `src` matched HEAD, and the build was rebuilt from HEAD.
- Mail as received in Mailpit:
  - Subject "Ada’s birthday is cancelled". The text was `'The host has cancelled Ada’s birthday.\r\n\r\nThe event page:\r\nhttp://localhost:3000/e/p0Okb1ManS\r\n\r\nYou are getting this because you gave your email when you replied to Ada’s birthday. To stop emails about this event: http://localhost:3000/m/PHbPL6zCzI4zKH9YP31lDnzC\r\n'`.
  - The Chinese mail has the same layout in Chinese.

## TDD evidence

- **RED, missing module:** `pnpm exec vitest run src/rsvps/cancellation.test.ts` gave `Error: Cannot find module './cancellation' imported from …/cancellation.test.ts`.
- **RED, stub that returns its input:** 4 failed, 1 passed:
  - `does not tell the guests who can’t go, though they gave an email`: `expected [ { status: 'cant', …(2) } ] to deeply equal []`
  - `does not tell the guests who gave no email, or blanked it`: `expected [ { status: 'going', …(2) }, …(1) ] to deeply equal []`
  - `does not tell a guest with no stop link to put at the foot of the email`: `expected [ { status: 'going', …(2) } ] to deeply equal []`
  - `keeps the guests it tells in the order they came`: `expected [ { status: 'maybe', …(2) }, …(3) ] to deeply equal [ … ]`
- **GREEN:** the same command gave `Test Files 1 passed (1)`, `Tests 5 passed (5)`.

## Files changed

- New:
  - `drizzle/0015_guest_mail.sql`
  - `drizzle/meta/0015_snapshot.json`
  - `e2e/guest-mail.spec.ts`
  - `src/app/m/[token]/actions.ts`
  - `src/app/m/[token]/page.tsx`
  - `src/app/m/[token]/stop-form.tsx`
  - `src/mail/guest-mail.ts`
  - `src/rsvps/cancellation.ts`
  - `src/rsvps/cancellation.test.ts`
  - `src/rsvps/notify-cancellation.ts`
- Modified:
  - `drizzle/meta/_journal.json`
  - `messages/en.json`, `messages/zh-Hans.json`, `messages/zh-Hant.json`
  - `src/db/schema.ts`
  - `src/events/actions.ts`
  - `src/events/repository.ts`
  - `src/proxy.ts`
  - `src/rsvps/actions.ts`
  - `src/rsvps/repository.ts`
  - `src/rsvps/token.ts`

## Self-review findings, all fixed before the commit

- The stop action first took an unused `_: FormState` as its last parameter, which lint flagged. I dropped it: `useActionState` accepts the shorter function.
- Two comments were stacked over the `saveRsvp` call. I moved `getLocale()` into its own line with its own comment.
- The proxy's two comment paragraphs ran past 100 columns, so I reflowed them.
- Checked that the mail token never reaches a browser:
  - `guestRsvp` picks its fields one by one.
  - The guest lists select explicit columns.
  - The full RSVP rows returned to actions stay on the server.
- Checked that `after()` runs although the cancel action ends in `redirect()`. The Next.js docs (`after.md`) say it does, and the browser tests got the notice within seconds.

## Concerns

1. **RSVPs saved before this change have no mail token.** Their guests get no guest mail, now or from tickets 03 and 04, until they save their RSVP again, and their `locale` reads `en`. I did not backfill in SQL: Postgres has no cryptographic random string without `pgcrypto`, and `random()` is not fit for a secret. The controller's rule (skip guests without a token) covers it, but an upgraded instance will quietly not email those guests. Options: a line in ticket 15's 0.3 upgrade note, or a backfill from the app at start (`generateMailToken` for each RSVP with an email and no token).
2. **`cancelEvent` now refuses anything but a published event.** That is what makes the notice go once. The UI only offered Cancel on published events, so the one change is that a crafted post can no longer cancel a draft. Tell me if that should be undone.
3. **The stop button is hidden when no email is on file.** I read the ticket's "one button" as shown when there is something to stop; the blank state says "No email is on file for this event", which is the spec's "says there is nothing to stop".
4. **Box 5 (opting back in) is shown only in part.** The edit-details path is unchanged and still edits the email (`rsvp.spec.ts`), and after a stop the edit form opens with an empty Email field. Re-adding the email and then getting mail cannot be shown here, because the only guest mail is the cancellation and a cancelled event takes no edits. Ticket 03's stop test can show it.
5. **`guestMail` translates the footer with `next-intl/server`'s `getTranslations`.** That may not work inside the worker for ticket 04, as ticket 01 warned. This is noted in the ticket for 04.
6. The cancel dialog's text does not mention that guests are now emailed, and the operator docs' Mail list does not name the notice yet; that list is ticket 15's job. Neither was asked for here.
7. The Chinese strings I was least sure of are listed in the ticket comment for ticket 15: the footer, the button, "on file", "Done", and the tab title.

## Workspace

- Nothing is listening on :3000, and the Compose dev containers are stopped.
- `.next` holds a build of HEAD, with no symlinks left in it.
- `CONTEXT.md` and `.scratch/openinvites/decisions.md` are untouched.

---

# Fix report 1: backfill the mail token (controller's ruling on concern 1)

**Status:** DONE. **Commit:** `8fe6d93` Mail: guests who replied before the upgrade get a stop link too, so their mail reaches them. `c69a2c7` is not amended.

## What changed

- **`drizzle/0015_guest_mail.sql`**, edited in place because 0015 has not shipped. After the unique constraint is added, it runs:
  `UPDATE "rsvp" SET "mail_token" = replace(gen_random_uuid()::text, '-', '') WHERE "email" IS NOT NULL AND "email" <> '' AND "mail_token" IS NULL;`
  A comment above it says why: Postgres cannot draw the app's 24 characters of the slug alphabet from a cryptographic source without an extension, so these tokens are a random UUID's 32 hex digits (122 random bits). Lookups are exact, so both shapes work, and every token made from now on is the app's.
- **`src/db/schema.ts`**: the `mailToken` comment now mentions the 32-hex tokens from migration 0015.
- **`src/rsvps/cancellation.ts`**: the comment no longer says that older RSVPs have no token.
- **No route change was needed.** `/m/[token]`, `stopMailAction` and `notFoundHere` look the token up exactly and never check its shape.

## What I saw on the dev database

1. **Before.** 301 RSVPs had an email, and 281 of them had no token.
2. **Rollback.** I put the database back to how it stood before the upgrade:
   - dropped `rsvp_mail_token_unique`, `mail_token` and `locale`;
   - deleted 0015's row (`created_at` 1791351469623) from `drizzle.__drizzle_migrations`.
3. **Migration.** I rebuilt (`pnpm build`) and started `node --env-file=.env.development .next/standalone/server.js`. `register()` applied 0015, and the migrations table has a new row for it.
4. **After.**
   - All 301 RSVPs with an email have a token, and none without an email has one.
   - All 301 tokens match `^[0-9a-f]{32}$`, and all 301 are distinct.
   - The RSVP `01a0c6dd-d913-717a-b702-1e950a16e977` (priya@example.test, "Ada’s birthday", replied 2026-09-22) got `7062179d7f1045e58efeade1662fa7c0`.
   - The RSVP `01a0c6dd-e344-…`, which has no email, stayed without a token.
5. **The stop page for that token.**
   - `curl /m/7062179d7f1045e58efeade1662fa7c0` answered **200**. Outside its scripts, the page had:
     - `<title>Emails about this event</title>`;
     - `<h1>Ada’s birthday</h1>`;
     - "The email on file for this event is priya@example.test.";
     - the "Stop emails about this event" button.
   - After that GET, the email was still in the row.
   - `/m/00000000000000000000000000000000` (an unknown 32-digit hex token) answered **404**.
6. **Pressing the button.** In a one-off Playwright script (chromium, en-US), I opened the page and pressed the button:
   - the page then said "Done. You will get no more email about Ada’s birthday.";
   - a reload said "No email is on file for this event.";
   - the row's email was null, and its token was kept.

## Checks

- `pnpm lint` passes. `pnpm typecheck` passes after `rm -f tsconfig.tsbuildinfo`. `pnpm test` passes: 51 files, 393 tests.
- Browser specs ran on the production build (same loop as before, operator setup included, two workers). `e2e/guest-mail.spec.ts` and `e2e/cancel-delete.spec.ts` gave **11 passed** (51.4 s). The server log is clean.

## Bookkeeping

- **Ticket comment:**
  - The header now lists both commits.
  - The schema bullet and the "RSVPs from before this change" bullet are corrected.
  - A dated pre-review fix entry, with the evidence above, is appended.
- **Workspace:**
  - Nothing is listening on :3000.
  - The build's symlinks are removed.
  - The Compose dev containers are stopped again.
  - The dev database's RSVP `01a0c6dd-d913-…` now has a blank email, from the button test.
