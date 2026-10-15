# 02: Guests are told when an event is cancelled, and can stop email about it

**What to build:** The first email to guests. Cancelling a published event emails every Going and Maybe guest who gave an address. Every email to a guest, this one and every later one, ends with why they got it and a link to a page where one tap stops further email about that event. Guests get mail in the language they replied in.

**Blocked by:** 01 The host is emailed when a guest replies

**Status:** done

- [x] Schema: `rsvp.locale` text not null default `'en'`, set from the request's locale whenever a guest saves their RSVP. `rsvp.mail_token` text null unique: a random token from the slug alphabet, 24 characters, made by `saveRsvp` when an RSVP is saved with an email and has none yet, kept when the email changes, kept (not cleared) when the email is blanked so an old link still lands on the page and says there is nothing to stop. Stored in clear (spec, "Guest mail": the worker needs it later, and it can only blank an email).
- [x] `src/mail/guest-mail.ts` (in the Mail module or RSVPs, whichever reads better): `guestMail(rsvp, event, { subject, body })` returns an outbox row for one guest: the body in the guest's locale, followed by a blank line and the footer from `Mail.guestFooter`: "You are getting this because you gave your email when you replied to {title}. To stop emails about this event: {url}", where the url is `${baseUrl()}/m/<mail token>`.
- [x] `/m/[token]`: a small page in the guest's language showing the event title, the address on file (or "No email is on file for this event" when blank), and one button "Stop emails about this event". The button posts a server action that blanks the RSVP's email and shows "Done. You will get no more email about {title}." A token no RSVP has is answered with the not-found page, as `/r/[token]` is (`src/proxy.ts`: add `/m/:path*` to the matcher and a `notFoundHere` clause; no rate limit, as for edit links). A GET changes nothing.
- [x] Cancelling a published event (the existing cancel action) queues one email per Going or Maybe guest with an email: `Mail.cancelled` (subject "{title} is cancelled", body with the title, that the host cancelled it, and the event link), through `guestMail`, then kicks the worker. Can't go guests get nothing. Without mail, nothing is queued.
- [x] The RSVP confirmation's edit-details path still lets a guest add or change their email, so a stopped guest can opt back in by editing their RSVP.
- [x] Unit test: the audience of the cancellation notice (Going and Maybe with an email; not Can't go; not guests without an email) as a pure function.
- [x] Browser test (`e2e/guest-mail.spec.ts`): two guests with emails (Going and Maybe) and one Can't go with an email reply to an event that asks for email; the host cancels; Mailpit shows one notice to each of the first two, in English, ending with the footer, and none to the third. One guest opens the footer link, presses the button, sees the done message; their RSVP, opened through their edit link, shows no email.
- [x] Browser test: a guest who replied with the page in Simplified Chinese (through the switcher) gets the cancellation notice with the Chinese fallback-to-English rule as it stands today (the subject and body keys exist in `en.json`; the Chinese files fall back until ticket 15). Assert the locale was honoured by checking the footer's language once ticket 15 lands; until then assert the mail arrived.

## Notes for the implementer

- Why a second token: the edit token is stored hashed (`rsvp.edit_token_hash`), so the server cannot put it in an email queued later (cancellation, announcements, reminders). The mail token is a different secret with a tiny power; it must never be accepted by `/r/[token]` or anything that edits or reveals an RSVP.
- `src/rsvps/token.ts` has the token helpers and `src/events/slug.ts` the alphabet; `src/app/r/[token]/route.ts` is the edit link.
- Commit subject, e.g. `Mail: guests who gave an email are told when the event is cancelled, and can stop email about it`.

## Comments

**2026-10-07, implementing agent.** Done, every box ticked. Commits `c69a2c7` (the feature) and `8fe6d93` (the mail token backfill for RSVPs that already had an email; see the fix entry below). Lint, type check and `pnpm test` (51 files, 393 tests) pass. `e2e/guest-mail.spec.ts` (new), `rsvp.spec.ts`, `cancel-delete.spec.ts`, `notifications.spec.ts`, `locales.spec.ts`, `rsvp-sheet.spec.ts` and `guest-list.spec.ts` pass at 390px and desktop against a production build (63 of 63, two workers).

How it landed:
- **Schema** (`drizzle/0015_guest_mail.sql`): `rsvp.mail_token` text null with the unique constraint `rsvp_mail_token_unique`, and `rsvp.locale` text not null default `'en'` (typed `Locale` in `schema.ts`, as `event.locale` is). Existing RSVPs read `en`. Since `8fe6d93`, every existing RSVP with an email is given a mail token by the migration, as 32 hex digits (below).
- **`src/rsvps/token.ts`**: `generateMailToken()`, 24 characters of `SLUG_ALPHABET` drawn with `randomInt` from `node:crypto`, the module `generateEditToken` draws from.
- **`saveRsvp(eventId, input & { locale }, mine)`** (`src/rsvps/repository.ts`): writes `locale` on every save. A new RSVP with an email gets a fresh mail token. A replaced RSVP saved with an email gets `coalesce(mail_token, <fresh>)`, so it is made once and kept, even if two saves race. A save without an email leaves the column alone, so a blanked email keeps its token. `saveRsvpAction` passes `getLocale()`. The host's edit (`editRsvpAsHost`) still writes only the answer, so neither the host's language nor the token is touched.
- **`src/rsvps/cancellation.ts`**: `cancellationAudience(rsvps)` keeps Going and Maybe RSVPs with an email and a mail token, in the order given, typed so that `email` and `mailToken` are strings.
- **`src/mail/guest-mail.ts`**: `guestMail(guest, event, { subject, body })` is async. It translates `Mail.guestFooter` with `getTranslations({ locale: guest.locale, namespace: "Mail" })` and returns `{ eventId, to, subject, text: body + "\n\n" + footer }`, with the url `${baseUrl()}/m/<mail token>`. `guest` is `{ email, mailToken, locale }`, all non-null: the caller skips guests without them.
- **`src/rsvps/notify-cancellation.ts`**: `notifyGuestsOfCancellation(event)`, shaped like `notifyHostsOfRsvp`. It returns at once without mail. Otherwise it reads the event's RSVPs (`listMailableRsvps`, ordered by `replied_at`), applies the audience, writes `Mail.cancelled` in each guest's locale, queues the rows with `queueMail` and calls `after(kickMailWorker)`. It catches and logs `Mail: could not queue the guests' email about the cancellation of event <id>`.
- **Cancel**: `cancelEvent` now updates only where `state = 'published'`, and `cancelEventAction` notifies only when it got the event back. So a second press from a stale tab, or a crafted post, tells nobody twice. The UI already offered Cancel only on published events; the one behaviour change is that a crafted post can no longer cancel a draft.
- **`/m/[token]`** (`page.tsx`, `actions.ts` and `stop-form.tsx` beside it): the page is drawn in the request's locale. It shows the event title as the heading, and either "The email on file for this event is {email}." with the button, or "No email is on file for this event." with no button. `stopMailAction(token)` (bound in the client form, posted through `useActionState`) runs `blankEmailByMailToken`, one `UPDATE rsvp … FROM event … RETURNING title`, and returns "Done. You will get no more email about {title}." in the page's language. If the RSVP has gone meanwhile it calls `notFound()`. Neither touches `updated_at`, so the host's guest list does not show the stop as a change of answer. The page is `noindex`.
- **Proxy**: `"/m/:path*"` in the matcher, and a `notFoundHere` clause using `findByMailToken`, so an unknown token gets the not-found page whole, in the visitor's language, with 404. There is no rate limit, as for edit links. Server-action posts pass through, as before.
- **Messages**: `Mail.cancelled.subject` "{title} is cancelled", `Mail.cancelled.body` "The host has cancelled {title}.", then "The event page:" and the link (laid out like the reply email's "Your guest list:"), and `Mail.guestFooter` verbatim from this ticket. The stop page has a namespace of its own, `StopMail`: `title` "Emails about this event" (the tab), `onFile`, `noEmail`, `stop` and `done`. All in `en.json`, `zh-Hans.json` and `zh-Hant.json`.

Decisions and things to know:
- **The stop button is hidden when no email is on file.** The ticket's "one button" is shown whenever there is an address to stop; an old link lands on a page that says only "No email is on file for this event", which is the spec's "says there is nothing to stop".
- **Box 5 (opting back in)**: no code was needed. The edit-details path is unchanged: `rsvp.spec.ts` "a guest goes, brings someone…" still edits a saved email, and `guest-mail.spec.ts` shows that after a stop, the edit link's Edit details opens with an empty Email field. Re-adding the email cannot be shown end to end in this ticket, because the only guest mail so far is the cancellation, and a cancelled event takes no edits. Ticket 03's browser test can show it (stop, re-add through Edit details, next announcement arrives).
- **Box 8 is stronger than written**, as the controller asked: the Chinese keys exist, so the test asserts the Simplified Chinese subject, body line and footer. It also asserts that the stop page, opened in the same browser, reads and answers in Simplified Chinese.
- **"Nothing to the Can't go guest" is checked by order.** The Can't go guest replies first, the audience keeps reply order, and the outbox sends in queue order. So a notice wrongly queued for them would reach Mailpit before the two the test waits for.
- **RSVPs from before this change** get their mail token from migration 0015 (`8fe6d93`). Those tokens are `replace(gen_random_uuid()::text, '-', '')`, 32 hex digits with 122 random bits, because Postgres cannot draw the app's 24 characters of the slug alphabet from a cryptographic source without an extension. The stop page and the proxy look the token up exactly and never check its shape, so both shapes work. Every token made from now on is the app's 24 characters. Older RSVPs' `locale` reads `en`, so their guests get English mail until they save their RSVP again.
- The cancel dialog's text ("Guests who open the link will see that it is called off…") does not mention the email. The ticket does not ask for a change; it could say so when the mail is on.

Left for later tickets or noted:
- **Tickets 03 and 04**: build each row with `await guestMail({ email, mailToken, locale }, { id, title }, { subject, body })`, translating subject and body in `rsvp.locale`, and skip guests without an email or mail token, as `cancellationAudience` does. `listMailableRsvps(eventId)` returns status, email, mail token and locale in reply order. Then `queueMail(rows)` and `after(kickMailWorker)`.
- **Ticket 04**: `guestMail` uses `getTranslations` from `next-intl/server` for the footer. Inside the worker (instrumentation bundle, no request) that may not work, as ticket 01 warned. If it does not, give `guestMail` a translator (or switch it to `createTranslator` with the messages `src/locale/request.ts` loads), keeping the footer key `Mail.guestFooter`.
- **Ticket 03**: the spec's browser test "the stop-email page blanks the address and a later announcement does not reach it" can reuse `guest-mail.spec.ts`'s helpers. A stop link is the 24-character token after `/m/` (`STOP_LINK` in that spec). `linkIn()` returns the first link in the text, which is the event link in a guest email, not the stop link.
- **Ticket 15, the Chinese I was least sure of**:
  - The footer, `你收到这封邮件，是因为你回复“{title}”时留下了邮箱。如果不想再收到关于这个活动的邮件，请打开这个链接：{url}` / `你收到這封郵件，是因為你回覆「{title}」時留下了電子郵件。如果不想再收到關於這個活動的郵件，請開啟這個連結：{url}`. Its second sentence follows the reply email's 如果不想再收到这类邮件 / 如果不想再收到這類郵件.
  - The button 不再接收这个活动的邮件 / 不再接收這個活動的郵件, which may read better as 停止接收….
  - `onFile` 你为这个活动留下的邮箱是 {email}。 / 你為這個活動留下的電子郵件是 {email}。 and `noEmail` 这个活动目前没有你的邮箱。 / 這個活動目前沒有你的電子郵件。 ("on file" has no close equivalent; I chose "the address you left").
  - `done` 好了，你不会再收到关于“{title}”的邮件。 / 好了，你不會再收到關於「{title}」的郵件。 (好了 for "Done.").
  - The tab title 关于这个活动的邮件 / 關於這個活動的郵件.
  - The subject “{title}”已取消 / 「{title}」已取消, and the body 主办人已经取消了“{title}”。 with 活动页面： / 活動頁面：, echoing `EventPage.cancelled`.
- **Ticket 15, docs**: the Mail section's list gains the cancellation notice and the stop link.

Evidence:
- **RED**: `pnpm exec vitest run src/rsvps/cancellation.test.ts` with no module: `Cannot find module './cancellation'`. With a stub returning its input unfiltered: 4 failed, 1 passed (e.g. `expected [ { status: 'cant', …(2) } ] to deeply equal []`).
- **GREEN**: the same command, 5 passed. Then `pnpm test`: 51 files, 393 passed. `pnpm lint` is clean. `pnpm typecheck` is clean after `rm -f tsconfig.tsbuildinfo`.
- **Browser, production build every time** (`pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000, with `drizzle`, `public` and `.next/static` symlinked into `.next/standalone`; Compose dev profile for Postgres and Mailpit). `next dev` was not used, after ticket 01's experience on this 4 GB machine (swap full at the start).
  - `guest-mail.spec.ts` alone: 5 passed (operator setup and two tests at two widths).
  - `rsvp`, `cancel-delete` and `notifications`: 25 passed.
  - Definitive run on the committed code: those four plus `locales`, `rsvp-sheet` and `guest-list`: **63 passed (4.2 min)**. The server log has only the known pre-existing `The destination stream closed early.`.
- **Mutation checks**, each on its own rebuild, then reverted (the files compared byte for byte with the saved copies):
  - The audience ignoring the status: the first test fails at the Can't go count, `Expected: 0, Received: 1`.
  - `saveRsvpAction` writing `locale: "en"`: the Chinese test fails, `Expected: "“Ada’s birthday”已取消"`, `Received: "Ada’s birthday is cancelled"`.
  - The stop page blanking the email on GET: the first test fails at the prefetch check, because the Maybe guest's "We’ll reach you at …" is gone.
- **A failure to queue never fails the cancel**: with `queueMail` made to throw, rebuilt, `cancel-delete.spec.ts` "a cancelled event keeps its page…" passed at both widths, and the server log had one `Mail: could not queue the guests' email about the cancellation of event <id>: Error: forced queue failure` per cancel. `outbox.ts` was restored, and `src` matched HEAD again.
- **Mailpit, as received**: "Ada’s birthday is cancelled", with the body "The host has cancelled Ada’s birthday.", then "The event page:" and `http://localhost:3000/e/p0Okb1ManS`, then "You are getting this because you gave your email when you replied to Ada’s birthday. To stop emails about this event: http://localhost:3000/m/PHbPL6zCzI4zKH9YP31lDnzC". In Chinese: "“Ada’s birthday”已取消", with 主办人已经取消了“Ada’s birthday”。, 活动页面：, the link, and the Chinese footer.
- **Migration**: on the dev database, `\d rsvp` shows `mail_token text`, `locale text not null default 'en'` and `rsvp_mail_token_unique`.

**2026-10-07, implementing agent (pre-review fix).** The controller ruled that guests who replied before the upgrade must get guest mail too. Commit `8fe6d93` edits migration 0015 in place, as it has not shipped. After the unique constraint is added, the migration runs `UPDATE "rsvp" SET "mail_token" = replace(gen_random_uuid()::text, '-', '') WHERE "email" IS NOT NULL AND "email" <> '' AND "mail_token" IS NULL`, with a comment saying why these tokens are 32 hex digits and not the app's 24 characters. The comments in `schema.ts` and `cancellation.ts` say the same. The stop page and `notFoundHere` look tokens up exactly, so a 32-character hex token needs no other change.

Evidence:
- **The dev database, rolled back and migrated again.**
  - Before: 301 RSVPs had an email, and 281 of them had no token.
  - I dropped `rsvp_mail_token_unique`, `mail_token` and `locale`, and deleted 0015's row from `drizzle.__drizzle_migrations`, so the database stood as before the upgrade.
  - I started a production build; `register()` applied 0015 (the migrations table has a new row with `created_at` 1791351469623).
  - After: 301 RSVPs with an email, 0 of them without a token, 0 RSVPs without an email but with a token. All 301 tokens match `^[0-9a-f]{32}$`, and all 301 are distinct.
  - The RSVP `01a0c6dd-d913-…` (priya@example.test, "Ada’s birthday", replied on 2026-09-22) got `7062179d7f1045e58efeade1662fa7c0`. An RSVP with no email stayed without a token.
- **The stop page for that token.**
  - `GET /m/7062179d7f1045e58efeade1662fa7c0` answered 200, with the title "Emails about this event", the heading "Ada’s birthday", "The email on file for this event is priya@example.test." and the button. The GET left the email in place.
  - An unknown 32-digit hex token got 404.
  - In a browser, pressing the button showed "Done. You will get no more email about Ada’s birthday.". A reload said "No email is on file for this event.", and the row's email was null with the token kept.
- **Checks.** Lint and type check pass, and `pnpm test` passes (51 files, 393 tests). `guest-mail.spec.ts` and `cancel-delete.spec.ts` passed at both widths against the production build, 11 of 11 with the operator setup, and the server log was clean.
- **Ticket 15**: the 0.3 notes can say that guests who gave an email before the upgrade can be emailed and can stop it, and that their mail is in English until they next save their RSVP.
