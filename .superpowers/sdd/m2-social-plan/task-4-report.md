# Task 4 report: automatic reminders

**Status:** DONE. Two commits on `m2-social`:

- `b1ec891` Mail: guest mail is written without a request, so the mail worker can write it too (the shared helper refactor; behaviour unchanged)
- `a521d29` Reminders: guests who gave an email are reminded a week before (Maybe) and the day before (Going)

The ticket file is updated: every box ticked, `**Status:** done`, and a dated comment. It is not staged.

## Before coding: the question and the rulings

I stopped before writing code (NEEDS_CONTEXT). The ticket's due rule (`publishedAt` before the reminder's time) meant an event published to start in 23 hours never gets a day reminder: its time is an hour before it was published. The browser test as written could not pass. The controller ruled:

1. **Option A.** Keep the rule. The test publishes the event to start at the first whole minute more than 24 h + 2 min away, and waits up to 120 s past the day reminder's time. A fence replaces the 90-second wait.
2. **A 24-hour window.** A reminder is due only while `now < time + 24h`. This adds the unit test "a reminder 25 hours past its time is not sent". It fixes the late-reminder defect I raised (reminders turned on late, an instance gaining mail, an outage).
3. My points 2 to 8 were accepted as described:
   - the `FOR NO KEY UPDATE SKIP LOCKED` claim;
   - the helper shape;
   - `messagesFor`;
   - `listMailableRsvps`/`queueMail` taking a transaction;
   - the `publishedAt` CASE;
   - queuing on every run;
   - the live hint;
   - `src/reminders/`.

I implemented against the ticket boxes as rewritten.

## What I implemented

### Commit 1: shared guest-mail helper (`b1ec891`)
- **`src/locale/messages.ts`**:
  - `messagesFor(locale)`: the locale's messages merged over English with `withEnglishFallback`, loaded as `request.ts` loaded them. `request.ts` now calls it, so the request config and the worker read one set.
  - `translatorFor(locale)`: `createTranslator` from `next-intl` over those messages.
  - `type Translator`.
- **`src/mail/guest-mail.ts`**:
  - `guestMail(guest, event, { subject, body }, t)` is now synchronous, takes the translator, and still uses `Mail.guestFooter`.
  - `guestMails(event, guests, write)` translates per guest in `guest.locale` and builds the rows.
- **`src/mail/queue-guest-mail.ts`**: `queueGuestMail(event, guests, write, about)`, the actions' path. It returns early with no guests, then runs `guestMails`, `queueMail`, `after(kickMailWorker)`, and catches and logs with the exact old log lines (`… about the cancellation of event <id>`, `… about an announcement to event <id>`). It is a separate file so the worker bundle never imports `after` and there is no worker → reminders → guest-mail → worker cycle.
- **`recipients`** moved from `src/announcements/audience.ts` to `src/rsvps/audience.ts`, with its test. There is now one exported `Addressable` type. `cancellationAudience` is `recipients(rsvps, ["going", "maybe"])`, and its test is unchanged and green.
- **Rerouted:** `notifyGuestsOfCancellation` and the announcement send in `postAnnouncementAction` go through `queueGuestMail`. The private `emailGuests` is gone.

### Commit 2: reminders (`a521d29`)
- **Schema and migration** (`drizzle/0017_automatic_reminders.sql`, journal tag renamed from the generated name). The four columns as the ticket gives them, plus:
  - `UPDATE … SET reminders_enabled = false` for every existing row;
  - `UPDATE … SET published_at = updated_at WHERE state IN ('published','cancelled')`.
- **`publishEvent`**: `publishedAt = CASE WHEN state = 'draft' THEN <now>::timestamptz ELSE published_at END`, plus `updatedAt: now`.
- **`src/reminders/due.ts`**: `remindersDue(event, now)` and `REMINDERS` (week: 7 days, Maybe; day: 1 day, Going).
  - Clauses: published, reminders on, `time <= now < time + 24h`, `publishedAt < time`, not sent.
  - Timed events: the start less N × 24 h.
  - All-day events: midnight in the event's zone on the date N days before, on the event's own calendar.
- **`src/reminders/queue.ts`**: `queueDueReminders(now)`.
  - **Candidate query:** published, reminders on, and for each reminder with a null mark, a start within `(now + (N−1)d − 2h, now + Nd + 2h]`. The 2 h covers an all-day event's midnight across a clock change. Ordered by start, then id.
  - **Per event, one transaction:**
    - re-select with the same conditions, `FOR NO KEY UPDATE SKIP LOCKED`;
    - `remindersDue`;
    - `listMailableRsvps(id, tx)`;
    - `guestMails` over `recipients(rsvps, [REMINDERS[kind].status])` for each due kind;
    - `queueMail(rows, tx)`;
    - set the due marks to `now`, even with no recipients.
  - **Failure:** the transaction rolls back, the error is logged as `Mail: could not queue the reminders for event <id>`, and the loop goes on to the next event.
- **`src/mail/worker.ts`**: each run does `await queueDueReminders(new Date()); await sendDue(new Date());`. The second clock comes after queuing, because outbox rows get `send_after = now()` from the database at insert, so a reminder goes out in the run that queued it.
- **`queueMail(rows, db = getDb())`** and **`listMailableRsvps(eventId, db = getDb())`**: `listMailableRsvps` now also returns `plusOnes`. `Db` is exported from `src/db/client.ts` as `PgDatabase<PostgresJsQueryResultHKT, typeof schema>`, which both the database and a transaction satisfy.
- **Messages** (en, zh-Hans, zh-Hant, in one change): `Mail.reminderWeek.{subject,body}`, `Mail.reminderDay.{subject,body}`, `Events.form.remindersEnabled`, and `Events.form.askEmailHint` (copied from `Announcements.askEmailHint`).
- **Event form**: the reminders checkbox after "Email me when a guest replies" (`defaultChecked={event?.remindersEnabled ?? true}`). `FieldContent` holds the label, and the hint shows while "Ask guests for an email address" is unticked, tied by `aria-describedby`. The ask-email checkbox became controlled state, like All day.
- **`EventInput`/`EventFormFields`** gain `remindersEnabled`. The action reads `remindersEnabled === "on"`, and `form.test.ts` fixtures gain the field.
- **`e2e/events.ts`**: `DraftFields.reminders?: boolean` (false unticks the box).
- **`e2e/reminders.spec.ts`**: the browser test as ruled (below).
- **`docs/operator/configuration.md`**: the Mail list gains the reminders, and the paragraph says the container checks the queue once a minute and queues due reminders then.

## Tests and results

| Check | Result |
| --- | --- |
| `pnpm lint` | clean |
| `pnpm typecheck` (after `rm -f tsconfig.tsbuildinfo`) | clean |
| `pnpm test` | 54 files, 423 tests passed (was 53 / 408; +15 `due.test.ts`). The Vite `configLoader` warning predates this ticket. |
| Browser, refactor (`b1ec891`), production build | `guest-mail`, `announcements`, `cancel-delete`, `notifications` with operator setup: **21 passed (1.8 min)** |
| Browser, definitive (`a521d29` source), production build | `reminders`, `guest-mail`, `announcements`, `notifications`, `events`, `cancel-delete` with operator setup, `--workers=2`: **41 passed (5.2 min)**. Server log clean. |

Every browser run used the **production-build loop**: `pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000, with `drizzle`, `public` and `.next/static` symlinked into `.next/standalone`, and the Compose dev profile up. `next dev` was never used.

### The browser test (`e2e/reminders.spec.ts`)
- One host, signed up first. Then "Ada's birthday" is published to start at `ceil((now + 24h + 2min) / 1min)`, asking for email, with a location and up to 2 plus-ones.
- Then "Mei's housewarming" (reminders unticked) is published to start one minute earlier: the fence.
- Replies:
  - the fence's Going guest;
  - then Ada's Maybe guest, before the Going guest, so a wrongly queued Maybe reminder would also come first;
  - then Ada's Going guest with +2.
- The test asserts every guest replied before the fence's due time, so a slow setup fails clearly.
- It polls Mailpit for the Going guest's mail with timeout = day reminder time + 120 s − now, every 2 s. It then asserts:
  - the subject "Ada’s birthday is tomorrow" and the body's first line;
  - `When: … GMT+8`;
  - `Where: Ah Ma’s house, 3rd floor`;
  - "You said Going, with 2 plus-ones.";
  - the event link and the footer regex;
  - 0 mails for the Maybe guest and 0 for the fence guest.
- Finally the form: the setting is ticked on a new event, and the hint shows until ask-email is ticked.
- `test.setTimeout(8 min)`. It takes about 3 minutes per project.

## TDD evidence

RED, with `remindersDue` stubbed to return `[]`:
```
$ pnpm exec vitest run src/reminders/due.test.ts
     × reminds a week before the start, and not a minute sooner
     × reminds the day before the start, and not a minute sooner
     × still sends a reminder after an outage of less than a day
     × never sends the week reminder for an event published five days out, but sends the day reminder
     × sends each reminder once
     × reminds of an all-day event from midnight in the event's zone
     × counts an all-day event's days on the event's own calendar when its clocks change
AssertionError: expected [] to deeply equal [ 'week' ]
AssertionError: expected [] to deeply equal [ 'day' ]
      Tests  7 failed | 7 passed (14)
```
(The 7 passing are the negative cases; the mutation checks below show each one guards a clause.)

GREEN:
```
$ pnpm exec vitest run src/reminders/due.test.ts
      Tests  14 passed (14)
```
Then 15 passed, after I added "never sends the week reminder for an event published within the day after its time" (below).

**Mutation checks on `remindersDue`.** Each clause removed or loosened in turn fails at least one test:

| Mutation | Tests that fail |
| --- | --- |
| state check removed | the cancelled test |
| reminders-on check removed | the reminders-off test |
| `time <= now` removed | 9 tests |
| 24 h window removed | 7 tests |
| window `<` → `<=` | "stops at 24 hours past its time" |
| published-before removed | 3 tests (after the added test) |
| published-before `<` → `<=` | "published at the very moment" |
| not-sent check removed | "sends each reminder once" |
| all-day midnight replaced by start − N × 24 h | the New York clock-change test |

**Browser mutation checks** (each on its own rebuild, desktop, then restored and compared byte for byte):

| Mutation | Result |
| --- | --- |
| reminders-off ignored in both the query and the rule | fails at `expect(await mailCountTo(request, fenced)).toBe(0)`: "Expected: 0, Received: 1". The fence works. |
| the day reminder sent to Going and Maybe | fails at the Maybe guest's count: "Expected: 0, Received: 1" |

## Hand check: Chinese from the worker

I used a throwaway spec, deleted afterwards. One host published a day-reminder event (a little over 24 h out) and a week-reminder event (7 days and 2 minutes out). Guests replied through the language switcher. As received in Mailpit, written by the worker:

```
Subject: “Ada’s birthday”就在明天
“Ada’s birthday”就在明天。

时间：2026年10月8日星期四 GMT+8 15:27
地点：Ah Ma’s house, 3rd floor

你的回复是：参加，另带 1 位同伴。

活动页面：
http://localhost:3000/e/pHnj90Nikt

你收到这封邮件，是因为你回复“Ada’s birthday”时留下了邮箱。如果不想再收到关于这个活动的邮件，请打开这个链接：http://localhost:3000/m/LFXGCTKw8dDCLznUvZatvzxX
```
```
Subject: 「Mei’s housewarming」還有一週就到了
「Mei’s housewarming」還有一週就到了。

時間：2026年10月14日星期三 下午3:27 [GMT+8]

你的回覆是：待定，另外帶 2 位同伴。

活動頁面：
http://localhost:3000/e/pWf1XtY2lk

你收到這封郵件，是因為你回覆「Mei’s housewarming」時留下了電子郵件。如果不想再收到關於這個活動的郵件，請開啟這個連結：http://localhost:3000/m/kGTIpyfu4wZ0j4dVp1VyVLoR
```
The English pair, from the same run:
- "Ada’s birthday is tomorrow": "When: Thursday, October 8, 2026 at 3:27 PM GMT+8", "Where: Ah Ma’s house, 3rd floor", "You said Going."
- "Mei’s housewarming is in a week": "You said Maybe, with 1 plus-one.", no place line.

So `createTranslator` with `messagesFor` works in the instrumentation bundle (the minute's interval) and in the action bundles (kicks). The week reminder works end to end too.

## Other hand checks
- **Migration on the dev database**:
  - all 8,226 events read `reminders_enabled = false`;
  - 7,083 published and 320 cancelled have `published_at = updated_at`;
  - 823 drafts have none;
  - `\d event` shows the four columns.
- **After a run**:
  - published events have `published_at` at publish time;
  - both "Ada's birthday" events have `day_reminder_sent_at` 07:23:39 (due 07:23:00);
  - the reminders-off events have no marks.
- **Screenshots of the form** at 390px and desktop: the setting is under "Email me when a guest replies", the long label wraps at 390px, and the hint shows in the description style until ask-email is ticked.

## Files changed

Commit 1:
- `src/locale/messages.ts` (new), `src/locale/request.ts`
- `src/mail/guest-mail.ts`, `src/mail/queue-guest-mail.ts` (new)
- `src/rsvps/audience.ts` and `src/rsvps/audience.test.ts` (moved from `src/announcements/`), `src/rsvps/cancellation.ts`, `src/rsvps/notify-cancellation.ts`
- `src/announcements/actions.ts`

Commit 2:
- `drizzle/0017_automatic_reminders.sql`, `drizzle/meta/0017_snapshot.json`, `drizzle/meta/_journal.json`
- `src/db/schema.ts`, `src/db/client.ts`
- `src/reminders/due.ts`, `src/reminders/due.test.ts`, `src/reminders/queue.ts` (new)
- `src/mail/worker.ts`, `src/mail/outbox.ts`, `src/rsvps/repository.ts`
- `src/events/form.ts`, `src/events/form.test.ts`, `src/events/actions.ts`, `src/events/repository.ts`
- `src/app/(host)/events/event-form.tsx`
- `messages/en.json`, `messages/zh-Hans.json`, `messages/zh-Hant.json`
- `e2e/events.ts`, `e2e/reminders.spec.ts`
- `docs/operator/configuration.md`

Not staged: `.scratch/m2-social/issues/04-automatic-reminders.md` (updated), `CONTEXT.md` and `.scratch/openinvites/decisions.md` (the maintainer's, untouched).

## Self-review findings
1. **Fixed: a raw `Date` in a Drizzle `sql` template.** The first browser run failed on Publish: postgres-js refuses a `Date` passed through `sql`. The CASE now passes `now.toISOString()::timestamptz`. Column comparisons and `.set()` encode Dates themselves, so `queue.ts` was fine.
2. **Fixed: a test gap after the window ruling.** With the 24 h window, "published five days out never sends the week reminder" passes even without the published-before clause, because the window closes the week reminder first. I kept that test (the ticket asks for it) and added a case inside the week reminder's own day. The mutation now fails 3 tests.
3. **Got right at design time: the send clock.** The send clock is taken after queuing. With one clock for both, a reminder's outbox row (`send_after = now()` at insert) would wait a minute for the next run.
4. **Checked:**
   - the reminder path never calls `after()` or kicks the worker;
   - `queue-guest-mail.ts` keeps `after` and the worker out of the worker's import graph;
   - `updated_at` is not touched by the marks, so preview cards are not redrawn;
   - `updateEvent`/`createEvent` write `remindersEnabled` through `EventInput`.
5. **Behaviour difference in the refactor, invisible to anyone:** `queueGuestMail` returns early when no guest is left. The cancellation notice used to call `after(kickMailWorker)` even with nobody to email. The kick would have found nothing to send.

## Concerns
- **The spec is out of date.** Its "Testing Decisions" still says the reminder test publishes an event "to start in 23 hours". The ticket box and the spec's "Automatic reminders" section were rewritten; that line was not. I did not edit the spec.
- **Test time.** `e2e/reminders.spec.ts` takes about 3 minutes per project, by design (the minute tick, and a due time that must come after publishing). On CI it ties up a worker for that long.
- **Reminders are checked on every worker run, including each action's kick.** That is one candidate query over `event` per run, filtered by state, setting and a `starts_at` range. `starts_at` has no index. That is trivial at the dev database's 8k events, but noted.
- **Events published inside a reminder's window** (e.g. 23 hours out) stay candidates until the window closes. Each run claims the row for a moment and finds nothing due, for at most about a day.
- `src/events/repository.ts` (~200 lines) and `event-form.tsx` (~155 lines) grew slightly; neither is tangled.

## Workspace
Nothing listens on :3000. The Compose dev containers are stopped (not removed). The build's symlinks are removed. The throwaway specs are deleted.
