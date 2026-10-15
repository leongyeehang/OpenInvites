# Deferred minors (for the final fix wave or the ticket named)

## Task 1 (7041b69), review clean
- → ticket 06: `repliesAtLimit` is private to `src/rsvps/actions.ts` ("use server") and takes no `db`; move it to `src/rsvps/limit.ts` with `db = getDb()`, mirroring `src/events/limit.ts`, and call it inside the admit transaction.
- `src/app/(host)/dashboard/page.tsx:29-30`: `eventsOwnedAtLimit` runs after `countRsvpsByEvent`; one `Promise.all`.
- `docs/operator/configuration.md:61`: the Limits bullet sits between the Host invitations bullet and its continuation; move it after Registration (the cards' order).
- `src/rsvps/guest.ts:20`: a 150-column comment; rewrap near 100.
- `messages/*.json:184` `Instance.limits.description`: "The most a host or an event can take." reads oddly (Chinese 容纳); suggested "How many events a host may have and how many replies an event may take." → ticket 11's copy and Chinese pass, with "100,000" in the two invalid-value strings.
- `e2e/limits.spec.ts:70`: the name "refused where it is typed" overstates; "a limit outside the range is refused".
- `src/app/instance/instance-forms.tsx:55`: a refused value snaps back to the saved one (browser min/max stops it first); optional: echo the posted values as `defaultValue`.
- `compose.yaml:98`: the comment still says only `registration.spec.ts` recreates `db-fresh`.
- Noted, no change: after the operator lowers a limit below what a host owns, "You have 5 events, the most this instance allows" is not quite true (the ticket's wording); two creates at limit−1 at once can both pass (an abuse cap, accepted).
- Trailer: 7041b69 carries a `Claude-Session:` line after `Co-Authored-By` (the session's attribution reminder); accepted, not amended.

## Task 6 (b5bdb98), review Needs fixes → fix round 1
- → ticket 11: `Rsvp.errors.capacityFull` "Only {count} places left." counts the guest's own place; a guest alone asking for +1 with one place left is told "Only 1 place left." (reads as room for the plus-one). Reviewer's suggestion: "Your party can be at most {count}." Three files and the two spec assertions (capacity.spec:176, :236).
- → ticket 11: "1 of 1 people expected" at a capacity of one; pluralise on `{capacity}` or drop "people".
- → ticket 11 (hardening): a `capacityFull` refusal after a proven code throws the proof away — `tryEmailCode` deletes the code on success and the refusal comes later, so a Going guest who changes their email and raises their plus-ones in one save on an event with `verifyEmail` and a capacity is asked to prove the email again.
- → ticket 11 (for the maintainer): under the ticket's rule a new Going reply that fits takes a free place while a larger party waits at the front; "a large party is not skipped" holds within the waitlist, not against newcomers. Alternative: a new reply joins the back whenever anyone waits (and the full notice shows whenever the waitlist is non-empty), at the cost of empty places while a big party waits.
- `src/rsvps/repository.ts`: `promoted_at` is written, never read, never cleared; a promoted guest who later goes Maybe and then Going into a full event is waitlisted with `promoted_at` still set. Clear it when the status leaves Going if a later ticket reads it.
- `guest-row.tsx`: a hint under a waitlisted row's status select ("Saving keeps them on the waitlist; Move to Going promotes them") would be a nicety.
- Confetti on a self-promotion (a waitlisted guest lowering their own party until it fits) falls, with the "A place opened up" mail queued to a guest who is on the page; harmless. If the maintainer wants it strict, compare the written status rather than the saved one.

## Task 7 (1429bd1), review Needs fixes (tests only) → fix round 1
- → ticket 11: the replies-per-event limit counts pending replies (ruling) but nothing pins it: `repliesAtLimit` is an unfiltered `count(*)` (`src/rsvps/limit.ts:14`); a pending row in `limits.spec.ts` (fresh-instance project) would.
- → ticket 11 (copy, for the maintainer): the approval checkbox's hint "Guests see the invitation while they wait, but not who's coming or the comments." is untrue under "Always" visibility after the pending-is-a-visitor ruling; suggested "…but not the comments; the guest list follows its own setting."
- → ticket 11: the Poster's confirmation keeps its accent check mark (`rsvp-flow.tsx:596`) beside "The host wasn't able to accept your reply."; a visitor on a full event with approval on reads "This event is full. You can join the waitlist." though their reply will wait for approval first.
- `Mail.approved.subject` in zh-Hans reads "your reply was approved" rather than "You're in" (wording only; the body says 你已列入宾客名单) → ticket 11's Chinese pass.
- Approving or declining sets `updated_at`, so the row reads "Changed …" as after Move to Going; acceptable, noted.
- `PublicGuest.approval` is always approved (redundant, harmless; keeps one tally rule).

## Task 8 (5853860)

- `Events.manage.duplicateHint` lists "Replies, comments and announcements" as not copied, without invites.
- After a guest's withdrawal, the same page's form starts blank until a reload; then the invite fills it in again.
- `Invites.copyLabel` 复制链接给 {name} / 複製連結給 {name} reads as "copy the link to {name}"; 复制 {name} 的链接 is clearer.
- A copy of the database hands out the edit links of replies made through invites (the token is stored in clear by ruling); a backup note in the operator guide.
- The host guide: a link preview fetched by a chat app counts as Opened; the invites page does not refresh itself ("Opened" shows on the next load).
- The 500-invite switch on the invites page is covered only by `roomForInvite`'s unit test.
- The spec's "or through the share sheet" for invites is not offered (Copy only, per the ticket).

## Task 9 (753a86c)

- The Thread holds the last turn's controls until the check passes: the guest cannot type meanwhile (the other layouts let them), a screen reader hears nothing while it waits, and a token expiring or erroring mid-typing unmounts the composer under the cursor with focus dropping to the body (`focusNext` unset). First on the list.
- `keyboard.spec.ts` cannot run on `app-social`: the widget adds three Tab stops (Cloudflare's logo, Privacy, Help) inside a closed shadow root, each with a visible ring inside Cloudflare's frame, and the spec's ring check reads only the shadow host (3 of 7 fail). No axe or keyboard coverage exists with the widget present.
- The sign-up check runs before Better Auth's `signUp` rate limit, so each bogus token costs one siteverify round trip (up to 5 s) and one log line, unbounded; accepted (ruling), recorded here.
- A sign-up `checkFailed` clears name, email and password (React resets the form on every sign-up refusal; the check adds one more way to hit it).
- `remoteip` sends an IPv4-mapped address as `::ffff:a.b.c.d`; Cloudflare accepted it.
- The privacy placeholder's line on the optional bot check that talks to Cloudflare; `pnpm perf` on `app-social`; `configuration.md` read whole.
- Chinese: 人机验证 / 人機驗證 for "Bot check" (the English says "the check"); `checkFailed`; `Turnstile.unavailable` with 广告拦截器 / 廣告封鎖器.
- CONTEXT.md proposal: **Bot check** (avoid "captcha" and "Turnstile" in interface copy).
- (fix round) `verify.test.ts` asserts `signal instanceof AbortSignal`, not the five-second value: a `TIMEOUT_MS = 60000` mutation survives (fake timers, or `signal.aborted` after advancing 5 s).
- (fix round) The unavailable line's clear-on-arrival (`turnstile.tsx:77`, `setUnavailable(false)`) has no browser pin: a row releasing the held route after 11 s and expecting the line to go.

## Task 10 (b8a4f0e)

- The 0.4 upgrade note: the first sweep's warnings go into the outbox ahead of every other mail (oldest first), so hosts' notices and reminders wait behind a large burst; deletion lands at the first hourly sweep after the instant, up to an hour late, never sooner.
- `Host.dashboard.deletedOn` "Deleted on {date}" reads as past tense; the spec said "Will be deleted on"; the Chinese is already future.
- `withFreshSlug` does not check `retired_slug` (the ticket's premise); harmless — a 2^-59 draw, never of custom shape — but the ticket text and any doc line saying so should match the code.
- A retired custom slug of a deleted event can carry a name ("ada-lovelace-50th") forever; the ruling stands; a line in the privacy placeholder.
- Chinese: 活动保留天数 / 活動保留天數 ("Keep events for"), 永久保留, 将于 {date} 删除 / 將於 {date} 刪除, the mail body lines (这是实例对所有活动的规定; 记得给副本设定新的日期), 这个实例上的活动会在结束 {days} 天后删除, 这个活动已被删除, the reworded `Instance.limits.description`.
- CONTEXT.md proposal: **Retention period** (avoid expiry, archiving, TTL).
- (fix round) The Keep-forever race during a sweep has no test of its own (accepted: a concurrent save cannot be driven from the browser; the `which` re-check is covered by reasoning).
- (fix round) `retention.spec.ts`'s "notes" canary assumes `app-no-mail`'s first sweep (~60 s after boot) has not run before the canary exists; if the whole-suite run flakes there, create the canary first or restart before polling. The 150 s windows ride the minute tick.
