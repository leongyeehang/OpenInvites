# Task 3 report: Announcements, and "send a reminder now"

**Status:** DONE_WITH_CONCERNS (every box is ticked; the concerns are decisions the reviewer or maintainer may want to overrule, listed at the end).

**Commit:** `6918434` Announcements: a host posts a message to the event page and emails it to the guests they choose

The ticket (`.scratch/m2-social/issues/03-announcements.md`) is set to done, with all eight boxes ticked and a dated comment. It is not staged.

## What I implemented

- **Schema and migration** `drizzle/0016_announcements.sql`: the `announcement` table (id, `event_id` not null with cascade, `body` text, `audience` `rsvp_status[]` not null, `created_at`) and `announcement_event_id_idx`. The file was renamed from drizzle's random name, and its journal tag with it, as 0014 and 0015 were.
- **`src/announcements/announcement.ts`** (pure):
  - `parseAnnouncement({ body, audience })` turns CR LF into LF, trims, and requires 1 to 2000 characters.
  - The audience must be non-empty, and every entry must be `going`, `maybe` or `cant`. It is kept as the ticked set, each status once, in button order.
  - `roomForAnother(posted)` is the ten cap.
  - Also exports `MAX_BODY`, `MAX_ANNOUNCEMENTS` and `DEFAULT_AUDIENCE` (Going, Maybe).
- **`src/announcements/audience.ts`** (pure): `recipients(rsvps, audience)` keeps a guest when `audience.includes(status)` and they have an email and a mail token, in the order given. Statuses are named positively, never by exclusion.
- **`src/announcements/repository.ts`**:
  - `listAnnouncements` returns newest first.
  - `createAnnouncement` locks the event row (`FOR NO KEY UPDATE`), counts, asks `roomForAnother` and inserts, all in one transaction. It returns null when the event is full.
  - `deleteAnnouncement` is scoped to the event.
- **`src/announcements/actions.ts`**:
  - `postAnnouncementAction`:
    1. `requireHost` and `findHostEvent`, then parse.
    2. With mail: `listMailableRsvps`, then `recipients`. If anyone is left, `consume("mail", headers)` once, before anything is written; a refusal shows the "too fast" message.
    3. Create the announcement; a full event gets the "Ten announcements…" error.
    4. Queue one `guestMail` per recipient (subject `Mail.announcement.subject` in the guest's locale, body as written), then `after(kickMailWorker)`. Queuing is caught and logged like `notifyGuestsOfCancellation`.
    5. `revalidatePath` the page. The answer says how many guests were emailed, or "No email was sent." without mail.
  - `deleteAnnouncementAction` checks the host's event and `isUuid`.
- **`/events/[id]/announcements`** (server page plus the client `announcement-form.tsx`):
  - From the top: the back link, the heading, the explainer (verbatim), the `askEmail` hint when it is off, and a no-mail line when the instance has no mail.
  - The form: a textarea, "Send a reminder now", the three checkboxes (Going and Maybe ticked; disabled without mail), and "Send". The form's fields are React state, so a refusal keeps them, and they reset after a successful post.
  - The list, newest first. Each item has its time (event zone, host's locale), "Sent to Going and Maybe" (`format.list`), the body with its line breaks, and Delete behind an `AlertDialog`.
- **Reminder draft**: rendered on the server in the host's language as `Announcements.reminderDraft`, from the title, `formatWhen(event, locale)` (the event's zone; the date only for an all-day event), "Where: …" only when there is a location (ICU `select`), and the link. The button sets the textarea to it, client side.
- **Manage page**: an "Announcements" button after "Share". **Proxy**: `/announcements` added to `notFoundHere`'s `/events/` pattern.
- **Event page**: `listAnnouncements` is loaded in the existing `Promise.all`. `PosterLayout` takes `announcements` (id, body, createdAt) and draws a Glass card under "From the host" after the description card. Each item is dated with `formatMoment` (the event's zone, the viewer's locale) and its body keeps line breaks (`whitespace-pre-line`). The not-ready page returns before the layout. A cancelled event keeps the card.
- **Messages**: `Mail.announcement.subject`, `Events.manage.announcements`, `EventPage.announcements`, and the `Announcements` namespace, in en, zh-Hans and zh-Hant.
- **Docs**: the `RATE_LIMIT_MAIL` sentence and table row in `docs/operator/configuration.md`, which ticket 01 had worded as "account emails only".

## Tests and results

- `pnpm lint`: clean. `pnpm typecheck` (after `rm -f tsconfig.tsbuildinfo`): clean. `pnpm test`: **53 files, 408 tests passed**. Vite's existing `configLoader: 'native'` warning about `vitest.config.ts` is printed, as before this change.
- **Browser, production-build loop for every run**: `pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000, with `drizzle`, `public` and `.next/static` symlinked into `.next/standalone` and the Compose dev profile up. `next dev` was not used.
  - `e2e/announcements.spec.ts`: 4 tests × 2 widths. The first run failed only the eleventh test, on a locator: Next.js's route announcer is also `role="alert"`, so I scoped the check to the form. Then 9 of 9 passed with the operator setup.
  - **Definitive, on the committed source**: `announcements`, `events`, `guest-mail`, `rsvp`: **47 passed (2.1 min)**. Also `poster`, `accessibility`, `cancel-delete`, `sharing`, `guest-list`, `notifications`, `keyboard`: **67 passed (5.4 min)**. The server log has only the known pre-existing `The destination stream closed early.`.
- **The browser tests in `announcements.spec.ts`**:
  1. Three guests with emails, one per status; the host sends to Going only. The Going guest gets one mail: subject "Ada’s birthday: a message from the host", body exactly "The gate code is 1234.\nRing twice.", then the footer with the stop link. The Maybe and Can't go guests get none; they replied first, so a wrongly queued mail would arrive before the Going one. A guest who has not replied sees it under "From the host" with its line break (`innerText`). The host deletes it, and it is gone from both pages.
  2. "Send a reminder now" fills the form with "A reminder: Ada’s birthday is coming up.", "When: Saturday, March 6, 2027 … 7:00 PM", "Where: 12 Orchard Road" and the link. The host adds a line and sends it. After cancelling the event, the page still shows it.
  3. The eleventh announcement is refused with the message, its text kept, and ten Delete buttons on the page.
  4. The case the controller added: two Going guests get announcement A. The first opens the stop link from A and stops. Announcement B says "emailed to 1 guest" and reaches the second guest as their second mail, while the first keeps one.
- `e2e/events.spec.ts`'s "mistyped" test now also covers `/events/not-an-event/announcements` and `/events/new/announcements`.
- **Mutation checks**, each on its own rebuild, then restored and compared byte for byte:
  - `recipients` ignoring the audience: test 1 fails (`Received: "…emailed to 3 guests."`).
  - Cap never refusing: test 3 fails.
  - Proxy pattern without `/announcements`: the "mistyped" test fails, getting the empty `__next_error__` shell.
  - `whitespace-pre-line` removed: test 1's line-break check fails.
  - `queueMail` throwing: test 1 passes the posted message and "Sent to Going", then fails waiting for mail, and the log has `Mail: could not queue the guests' email about an announcement to event …: Error: forced queue failure`. A failure to queue never fails the post.
- **Without mail, by hand**: the same build with `SMTP_URL=` and a throwaway spec (deleted) at both widths. The no-mail line shows, the boxes are disabled, the answer is "Posted to the event page. No email was sent.", and the list has no "Sent to". The guest page shows the announcement. I also looked at screenshots of both pages.
- **Strings**: rendered with `use-intl`'s `createTranslator` in all three locales (the reminder with and without a location, the plural at 0, 1 and 3, the list at 1, 2 and 3, the subject).

## TDD evidence

RED, with stubs (the parser accepting everything, the cap always true, `recipients` returning its input). Before the stubs, the same command failed with `Cannot find module './announcement'` and `'./audience'`.

```
$ pnpm exec vitest run src/announcements
     × leaves out the guests whose status the host did not pick, though they gave an email
     × reaches the guests who can't go only when the host picks them
     × leaves out the guests who gave no email, or blanked it
     × leaves out a guest with no stop link to put at the foot of the email
     × keeps the guests it emails in the order they came
     × takes the host's words trimmed, with their line breaks
     × wants something to say
     × carries up to 2000 characters and no more
     × counts a line break as one character, as the browser posts it or not
     × wants at least one status to email
     × refuses a status no guest can give
     × keeps each status once, in the order the RSVP buttons show them
     × lets an event have ten announcements, and refuses the eleventh
 Test Files  2 failed (2)
      Tests  13 failed | 1 passed (14)
```

Two of the failure messages: `expected { ok: true, announcement: { …(2) } } to deeply equal { ok: false, error: 'bodyTooLong' }` and `AssertionError: expected true to be false`.

GREEN:

```
$ pnpm exec vitest run src/announcements
 Test Files  2 passed (2)
      Tests  14 passed (14)
```

Mutation check: dropping the CR LF normalisation fails exactly "counts a line break as one character, as the browser posts it or not" (1 failed, 13 passed). Restoring it brings back 14 passed.

## Files changed

- New:
  - `drizzle/0016_announcements.sql`, `drizzle/meta/0016_snapshot.json`
  - `e2e/announcements.spec.ts`
  - `src/announcements/actions.ts`, `announcement.ts`, `announcement.test.ts`, `audience.ts`, `audience.test.ts`, `repository.ts`
  - `src/app/(host)/events/[id]/announcements/page.tsx`, `announcement-form.tsx`
- Modified:
  - `docs/operator/configuration.md`, `drizzle/meta/_journal.json`
  - `e2e/events.spec.ts`
  - `messages/en.json`, `messages/zh-Hans.json`, `messages/zh-Hant.json`
  - `src/app/(host)/events/[id]/page.tsx`, `src/app/e/[slug]/page.tsx`
  - `src/db/schema.ts`, `src/proxy.ts`, `src/themes/poster-layout.tsx`

## Self-review findings (fixed before commit)

- The eleventh test's `getByRole("alert")` also matched Next.js's route announcer. It is now scoped to the form.
- Ticket 01's operator-guide wording ("`RATE_LIMIT_MAIL` counts the account emails") became wrong with this change, so I corrected the paragraph and the table row. I left the Mail section's list for ticket 15, as ticket 02 did.
- The proxy change had no test, so the existing "mistyped" test now covers both announcements paths, and the proxy mutation shows it bites.
- `PosterLayout` takes the announcements as data, not as a drawn ReactNode. Broadsheet (a headed section) and Thread (dated bubbles) will draw them differently from the same list.
- I checked that the event page sends no audience to the browser: `PosterLayout` is a server component and draws only the date and the body.

## Concerns (decisions to confirm)

1. **The mail rate limit counts an announcement only when it emails at least one guest.** The spec says "Creating an announcement counts once against the `mail` rate limit, however many guests it reaches", and the brief says "once per announcement sent, before queuing". I read these as counting whenever mail goes out. One that reaches nobody (or is posted without mail) sends nothing, and the limit exists to protect inboxes. Counting every post would also have made the eleventh-announcement browser test fight `RATE_LIMIT_MAIL=5/1m`, since every request in a test shares one client address. If every post should count, it is one condition in `postAnnouncementAction`, and test 3 would need to switch addresses part way.
2. **Without mail**, disabled checkboxes post nothing, so the action stores the default audience (Going, Maybe) and the list omits "Sent to …". If the instance gains mail later, those old rows would read "Sent to Going and Maybe" although they were never emailed. That seemed an acceptable edge.
3. **Drafts and cancelled events can take announcements**, as the ticket sets no state rule. A draft's announcements reach no one (it has no guests) and appear once it is published. The spec's "Drafts have none" holds for guests, who see only the not-ready page.
4. **Docs touched outside the ticket's list**: two lines of `docs/operator/configuration.md`, to keep the rate-limit statement true.
5. **Chinese strings I am least sure of** are listed in the ticket comment for ticket 15. The main ones are the heading 主办人的话 / 主辦人的話, the legend 邮件发给回复以下状态的宾客, and "Sent to" as 发送对象：.
6. `src/app/e/[slug]/page.tsx` is busy. I added one query and one prop and did not restructure it.
7. `CONTEXT.md` needs nothing new ("Announcement" is defined). I did not touch it or `decisions.md`.

## Workspace

Nothing is listening on port 3000; I stopped every server I started (the exit-137 notices were those stops). The Compose dev containers are stopped (`docker compose --profile dev stop`, no volumes removed). The build's symlinks are removed from `.next/standalone`. The throwaway spec is deleted. The working tree has only the maintainer's `CONTEXT.md` and `decisions.md` edits and the untracked `.scratch/` files.
