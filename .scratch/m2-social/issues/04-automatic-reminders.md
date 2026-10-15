# 04: Automatic reminders

**What to build:** Guests who gave an email are reminded automatically: a week before the start if they said Maybe, the day before if they said Going. One per-event switch. The worker from ticket 01 queues them.

**Blocked by:** 03 Announcements

**Status:** done

- [x] Schema: `event.reminders_enabled` boolean not null default true, set **false** on existing rows by the migration; `event.published_at` timestamptz null, filled by the migration with `updated_at` for rows whose state is published or cancelled, and set by the publish action from now on; `event.week_reminder_sent_at` and `event.day_reminder_sent_at` timestamptz null.
- [x] `src/reminders/due.ts` (or inside Events): `remindersDue(event, now)` returns the subset of `["week", "day"]` that is due: the event is published, reminders are on, the reminder's time (start minus 7 days, start minus 1 day; for all-day events from midnight in the event's zone) is at or before `now`, `now` is less than 24 hours after that time (ruled 2026-10-07: a reminder a day late would say "in a week" or "tomorrow" when neither is true, as when a host turns reminders on late or an instance gains mail; an outage shorter than a day still delivers), `publishedAt` is before that time, and it has not been sent. Pure; unit tests for each clause, including an event published five days out never sending the week reminder, a reminder 25 hours past its time not sent, an all-day event, and a cancelled event.
- [x] The worker's tick (`sendDue` or beside it) first queues reminders: for every event with a due reminder, one `guestMail` per guest with an email whose status matches (week: Maybe; day: Going), then marks the reminder sent, in one transaction per event so two containers cannot both send it. Guests without an email, and events on an instance without mail, get nothing.
- [x] `Mail.reminderWeek` and `Mail.reminderDay`: subject "{title} is in a week" / "{title} is tomorrow"; body with the title, when (in the event's zone, the viewer's zone is unknown), where when set, the guest's own reply ("You said Maybe" / "You said Going, with 2 plus-ones"), the event link, then the footer. In the guest's locale.
- [x] The event form's settings gain "Remind guests by email (a week before to Maybe, the day before to Going)" (`remindersEnabled`), with the `askEmail` hint from ticket 03 when email is not asked for.
- [x] Browser test (`e2e/reminders.spec.ts`, long timeout): an event published to start at the first whole minute more than 24 hours and two minutes from now (so the day reminder's time, start minus 24 hours, falls two to three minutes after publishing, after the guests have replied; ruled 2026-10-07, replacing "in 23 hours", which the published-before rule would never remind), asking for email, with a Going guest and a Maybe guest who gave emails; within 120 seconds of that time Mailpit has the day reminder for the Going guest (subject "… is tomorrow", the guest's reply in the body, the footer) and nothing for the Maybe guest. A second event with reminders turned off, due a minute earlier, serves as the fence: once the first event's reminder has arrived, its guest has no email.
- [x] `docs/operator/configuration.md`, Mail: the list gains the reminders, and the note that they are sent by the app container's own queue, checked once a minute.

## Notes for the implementer

- The tick runs every 60 seconds (ticket 01); the browser test's wait is bounded by that plus sending. Do not add a test-only interval setting.
- The worker runs outside any request. Ticket 01's `notifyHostsOfRsvp` translates inside the action with `getTranslations({ locale })`, which is fine there; the reminder text is built by the worker, where `next-intl/server` may have no request to read. Use `createTranslator` from `next-intl` with the locale's messages loaded the way `src/locale/request.ts` loads them (a pure function of locale and messages), and test by hand that a reminder in `zh-Hans` comes out in Chinese. Ticket 01's report (`.superpowers/sdd/m2-social-plan/task-1-report.md`, concern 5) flagged this.
- Query only candidate events: published, reminders on, start between now and now plus 8 days, with a reminder not yet sent. Postgres does the filtering; `remindersDue` decides.
- Commit subject, e.g. `Reminders: guests who gave an email are reminded a week before (Maybe) and the day before (Going)`.

## Comments

**2026-10-07, implementing agent.** Done, every box ticked, against the boxes as the controller rewrote them on 2026-10-07 (the 24-hour window, and the browser test publishing a little over a day out). Commits `b1ec891` (the shared guest-mail helper, behaviour unchanged) and `a521d29` (the reminders). Lint, type check and `pnpm test` (54 files, 423 tests) pass. `e2e/reminders.spec.ts` (new), `guest-mail`, `announcements`, `notifications`, `events` and `cancel-delete` pass at 390px and desktop against a production build (41 of 41, two workers, 5.2 min).

How it landed:
- **Schema** (`drizzle/0017_automatic_reminders.sql`): `event.reminders_enabled` (boolean, not null, default true), `published_at`, `week_reminder_sent_at`, `day_reminder_sent_at` (timestamptz, null). The generated SQL is hand-edited with `UPDATE "event" SET "reminders_enabled" = false` and `UPDATE "event" SET "published_at" = "updated_at" WHERE "state" IN ('published', 'cancelled')`. On the dev database all 8,226 events read `reminders_enabled = false`; all 7,083 published and 320 cancelled events got `published_at = updated_at`; the 823 drafts have none.
- **`publishEvent`** sets `publishedAt` with `CASE WHEN state = 'draft' THEN <now> ELSE published_at END`, which reads the state from before the update, so only a draft's first publish records it. Nothing else about publishing changed.
- **`src/reminders/due.ts`**: `remindersDue(event, now)` returns the subset of `["week", "day"]` that is due: published, reminders on, time ≤ now < time + 24 h, `publishedAt` < time, not sent. A timed event's reminder times are the start less 7 × 24 h and 24 h. An all-day event's are midnight in its zone on the date 7 days or 1 day before, counted on its own calendar, so a clock change moves them by nothing (unit-tested in New York across 14 March 2027). `REMINDERS` maps each reminder to its days and its status (week: Maybe, day: Going).
- **`src/reminders/queue.ts`**: `queueDueReminders(now)`. Postgres finds the candidates: published, reminders on, and for each reminder with a null mark, a start within (now + (N − 1) days, now + N days], widened by 2 hours each side for an all-day event's midnight across a clock change. Candidates are taken soonest start first. Each event then gets one transaction:
  - it re-selects the row with the same conditions, `FOR NO KEY UPDATE SKIP LOCKED`;
  - asks `remindersDue`;
  - reads the RSVPs (`listMailableRsvps(id, tx)`, now with `plusOnes`);
  - builds the rows with `guestMails` per due reminder over `recipients(rsvps, [status])`;
  - queues them with `queueMail(rows, tx)`;
  - sets the due marks to `now`, even when no guest is reminded.

  A failure rolls that event back, is logged as `Mail: could not queue the reminders for event <id>`, and the next run tries again; other events go on. `updated_at` is not touched, so the link's preview card is not redrawn by a reminder.
- **Worker**: every `kickMailWorker` run (the minute's interval and every action's kick) calls `queueDueReminders(new Date())`, then `sendDue(new Date())`. The second clock is taken after queuing, so a reminder goes out in the run that queued it (the outbox row's `send_after` is the database's `now()` at insert). Without mail there is no worker, so nothing is queued.
- **`Mail.reminderWeek` / `Mail.reminderDay`**: subject "{title} is in a week" / "{title} is tomorrow". The body has the title line, "When: …" (`formatWhen(event, guest.locale)`, in the event's zone), "Where: …" only when there is a location (ICU `select` on `located`, as `Announcements.reminderDraft` does), "You said Maybe" / "You said Going" with ", with # plus-one(s)" when there are any, then "The event page:" and the link. `guestMail` appends the footer. The status is written into each message, since the week reminder only ever goes to Maybe guests and the day reminder to Going guests.
- **Event form**: "Remind guests by email (a week before to Maybe, the day before to Going)" (`remindersEnabled`) right after "Email me when a guest replies", checked for a new event (`event?.remindersEnabled ?? true`). While "Ask guests for an email address" is unticked, `Events.form.askEmailHint` (copied from `Announcements.askEmailHint`) shows under it and is tied to the checkbox with `aria-describedby`. The ask-email box is now controlled state, like All day, so the hint follows it live.
- **Shared helper** (`b1ec891`):
  - `src/locale/messages.ts` has `messagesFor(locale)` (the messages with English fallback, now also what `request.ts` loads) and `translatorFor(locale)` (`createTranslator` from `next-intl`).
  - `guestMail(guest, event, content, t)` takes the translator and still uses `Mail.guestFooter`.
  - `guestMails(event, guests, write)` builds the rows.
  - `src/mail/queue-guest-mail.ts` has `queueGuestMail(event, guests, write, about)`, the actions' path: build, `queueMail`, `after(kickMailWorker)`, catch and log with the old log lines. It is a file of its own so the worker never imports `after` or itself.
  - `recipients` moved to `src/rsvps/audience.ts` (one `Addressable` type), and `cancellationAudience` is `recipients(rsvps, ["going", "maybe"])`.
  - The cancellation notice and the announcement send go through `queueGuestMail`. The reminders use `guestMails` with `queueMail(rows, tx)`: no `after()`, no kick.
- **Docs**: the Mail list gains the reminders, and the paragraph says the container checks its queue once a minute and queues due reminders then.

Decisions and things to know:
- **Reminders live in `src/reminders/`**, not in Events. They are the one thing that runs on the clock, they read events, RSVPs and mail, and the due rule, its cadence and its queuing belong together. Events keeps only the columns and `publishedAt`.
- **The claim is `FOR NO KEY UPDATE SKIP LOCKED`** (controller-approved), not `FOR UPDATE`. Two containers still exclude each other, but guests' RSVP inserts, whose foreign key takes `KEY SHARE`, never wait on it, as in `createAnnouncement`.
- **An event published inside a reminder's window** (say 23 hours out) stays a candidate until the window closes. Each run claims its row for a moment and finds nothing due, for at most a day and two hours.
- **The browser test's fence**:
  - "Mei's housewarming" has reminders off and starts a minute before "Ada's birthday", so its day reminder would fall due a minute sooner and be queued in the same run or an earlier one. Within a run, events go in start order.
  - On Ada's birthday the Maybe guest replies before the Going guest, so a wrongly queued Maybe reminder would also be queued, and sent, first.
  - Once the Going guest's reminder is in Mailpit, both others must have 0 emails. The test fails with "every guest replied before the reminders fell due" if the setup was too slow, rather than flaking.
  - The poll's timeout is the day reminder's time plus 120 s. Each project's run takes about 3 minutes.
- **A raw `Date` inside a Drizzle `sql` template** is refused by postgres-js ("The 'string' argument must be of type string … Received an instance of Date"). The first browser run caught it on Publish. The `CASE` passes `now.toISOString()::timestamptz`. Column comparisons (`gt`, `lte`) and `.set()` map Dates themselves.
- The test also checks the form: the setting is ticked on a new event, and the hint shows until "Ask guests for an email address" is ticked.

Left for later tickets or noted:
- **Ticket 15, the Chinese I was least sure of**:
  - Subjects: “{title}”还有一周就到了 / 「{title}」還有一週就到了, and “{title}”就在明天 / 「{title}」就在明天. The first lines repeat them with 。.
  - The reply line: 你的回复是：待定 / 你的回覆是：待定 and 参加 / 參加, echoing `Mail.rsvpReply`'s 原来的回复是：. The plus-ones fragment is the existing one (，另带 # 位同伴 / ，另外帶 # 位同伴); =0 is empty.
  - The setting: 发邮件提醒宾客（提前一周提醒待定的宾客，提前一天提醒参加的宾客） / 寄電子郵件提醒賓客（提前一週提醒待定的賓客，提前一天提醒參加的賓客）. Traditional uses 寄電子郵件, as `notifyOnRsvp` does.
  - 时间：/ 時間：, 地点：/ 地點：, 活动页面：/ 活動頁面：, as in `Announcements.reminderDraft`. The time is Intl's own format: "2026年10月8日星期四 GMT+8 15:27" and "2026年10月14日星期三 下午3:27 [GMT+8]".
- **Ticket 15, docs and upgrade note**:
  - Reminders start off on existing events and on for new ones; a host turns them on in the event's settings.
  - Existing events' `published_at` is their last change, which can only make a reminder less likely to go.
  - A reminder more than a day late is never sent, so turning reminders on late, or adding mail to an instance, sends no stale "in a week".
  - The Mail list still lacks the cancellation notice and announcements (tickets 02 and 03 left them to you).
- **Ticket 09 (Duplicate)**: copy `remindersEnabled`; leave `publishedAt`, `weekReminderSentAt` and `dayReminderSentAt` null on the new draft, as the spec says.
- **Any later mail written outside a request** (anything the worker builds) uses `translatorFor(locale)` from `src/locale/messages.ts`. Guest mail from an action uses `queueGuestMail`.
- **For the controller**: the spec's "Testing Decisions" still says the reminder browser test publishes an event "to start in 23 hours"; the ticket box and the spec's "Automatic reminders" section were rewritten, that line was not.
- `src/app/e/[slug]/page.tsx` and the layouts were not touched.

Evidence:
- **RED**: `pnpm exec vitest run src/reminders/due.test.ts` with `remindersDue` stubbed to return `[]`: 7 failed, 7 passed (the negative cases), e.g. `AssertionError: expected [] to deeply equal [ 'week' ]` and `… [ 'day' ]`.
- **GREEN**: the same command, 14 passed; with the controller's 25-hour test and one I added (the week reminder for an event published within the day after its time), 15 passed. `pnpm test`: 54 files, 423 passed.
- **Mutation checks on `remindersDue`**: each clause removed or loosened in turn fails at least one test:
  - state: the cancelled test;
  - reminders on: the reminders-off test;
  - time ≤ now: 9 tests;
  - the 24-hour window: 7 tests;
  - `<` → `<=` in the window: "stops at 24 hours past its time";
  - published before: 3 tests;
  - `<` → `<=` there: "published at the very moment";
  - not sent: "sends each reminder once";
  - all-day midnight: the New York clock-change test.

  Without the published-before clause, the five-days-out test still passed (the window closes the week reminder anyway), so I added the week case inside its own day.
- **Browser mutation checks** (production build, desktop, each then restored and compared byte for byte):
  - reminders-off ignored in both the query and the rule: fails at `expect(await mailCountTo(request, fenced)).toBe(0)`, "Expected: 0, Received: 1";
  - the day reminder sent to Going and Maybe: fails at the Maybe guest's count, "Expected: 0, Received: 1".
- **Browser, production build every time** (`pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000, with `drizzle`, `public` and `.next/static` symlinked into `.next/standalone`; Compose dev profile). `next dev` was not used.
  - Refactor (`b1ec891`): `guest-mail`, `announcements`, `cancel-delete`, `notifications`: 21 of 21.
  - Definitive, on `a521d29`'s source: `reminders`, `guest-mail`, `announcements`, `notifications`, `events`, `cancel-delete` with the operator setup: **41 passed (5.2 min)**. The server log was clean.
- **By hand, on the dev database**, after a reminders run: both "Ada's birthday" events had `published_at` at publish time and `day_reminder_sent_at` 07:23:39 for a reminder due 07:23:00; both "Mei's housewarming" events (reminders off) had no marks.
- **The worker's mail in each language** (a throwaway spec, deleted): one host, a day-reminder event and a week-reminder event (published 7 days and 2 minutes out), guests replying in Simplified Chinese (Going +1), English (Going), Traditional Chinese (Maybe +2) and English (Maybe +1). As received in Mailpit:
  - "“Ada’s birthday”就在明天": 时间：2026年10月8日星期四 GMT+8 15:27 / 地点：Ah Ma’s house, 3rd floor / 你的回复是：参加，另带 1 位同伴。/ 活动页面： and the link / the Chinese footer.
  - "Ada’s birthday is tomorrow": When: Thursday, October 8, 2026 at 3:27 PM GMT+8 / Where: … / You said Going. / the link / the footer.
  - "「Mei’s housewarming」還有一週就到了": 時間：2026年10月14日星期三 下午3:27 [GMT+8] (no place line) / 你的回覆是：待定，另外帶 2 位同伴。/ 活動頁面： / the Traditional footer.
  - "Mei’s housewarming is in a week": You said Maybe, with 1 plus-one.
- **The form, by eye** (screenshots at 390px and desktop): the setting sits under "Email me when a guest replies", its long label wraps at 390px, and the hint shows in the description style under it until "Ask guests for an email address" is ticked.
- **Workspace**: nothing listens on :3000, the dev containers are stopped, and the build's symlinks are removed.
