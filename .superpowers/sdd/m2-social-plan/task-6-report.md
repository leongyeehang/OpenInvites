# Task 6 report: Comments (ticket 06)

**Status:** DONE_WITH_CONCERNS (the concerns are design notes, below; every box is ticked and every check passes)

Commit on `m2-social`: `eafe760` Comments: guests who have replied and the hosts talk on the event page.

## What I implemented

- **Schema and migration** (`src/db/schema.ts`, `drizzle/0019_comments.sql`, its snapshot and journal entry): `comment` (id, `event_id` not null cascade, `rsvp_id` cascade, `host_id` referencing `user` cascade, `body`, `created_at`), check `comment_one_author` `(rsvp_id is null) <> (host_id is null)`, indexes on `event_id`, `rsvp_id`, `host_id`. `event.comments_enabled` and `event.notify_on_comment`, boolean not null default true; the migration is hand-edited with `UPDATE "event" SET "comments_enabled" = false, "notify_on_comment" = false` after the `ALTER`s.
- **`src/comments/comment.ts`**: `parseComment` (CR LF to LF, trim, 1 to 1000 characters: `bodyRequired`, `bodyTooLong`), `MAX_BODY`, `MAX_COMMENTS = 500`, `roomForAnother`, and the delete rule `mayDelete(viewer, comment)`.
- **`src/comments/visibility.ts`**: `CommentViewer` (`host` | `guest` with `rsvpId` | `visitor`), `commentsView(viewer)` (`locked` for a visitor, else `open`), `takesComments(event, viewer)` (comments on, not locked, not cancelled, a draft only for hosts), and the layout's prop types `ShownComment` and `CommentsShown`.
- **`src/comments/repository.ts`**: `listComments` (oldest first, name `coalesce(rsvp.name, user.name)`), `countComments`, `createComment` (event row `FOR NO KEY UPDATE` while counting; null at the cap), `findComment`, `deleteComment` (both scoped to the event).
- **`src/comments/actions.ts`**: `postCommentAction(slug, state, formData)`: `consume("comment", await headers())` before anything is looked up; the viewer decided on the server (signed-in host through `findHostEvent` + `can(role, "comments")` first, else the RSVP on this device); `closed` when `takesComments` refuses; parser errors; `tooMany` at 500; then `notifyHostsOfComment` and `revalidatePath('/e/<slug>')`. `deleteCommentAction(slug, id)`: same viewer, `findComment`, `mayDelete`, delete, revalidate; a refusal leaves things as they are.
- **`src/comments/notify-hosts.ts`**: `notifyHostsOfComment`, a sibling of `notifyHostsOfRsvp`: `notifyOnComment` and `isMailConfigured()`, `Mail.comment` in `event.locale` via `getTranslations({ locale, namespace })`, every host from `eventHosts` except the author by id, `queueMail`, `after(kickMailWorker)`, inside a catch that logs.
- **Rate limit**: `comment` in `LimitName`/`LIMITS` (`RATE_LIMIT_COMMENT`, default `30/10m`); row in `docs/operator/configuration.md`'s table, plus the Mail list and its rate-limit paragraph; `deploy/.env.example` lists it.
- **Event page** (`src/app/e/[slug]/page.tsx`): the viewer from `isHost`/`mine`; `commentsFor(event, viewer)` in the `Promise.all` (nothing when off; only the count when locked, so no comment reaches a guest who has not replied; else the list with `deletable` and `canPost`); `PosterLayout` gets `comments` (data) and `commentForm` (slot).
- **Poster layout** (`src/themes/poster-layout.tsx`): the Comments card after the guest list: locked ("{count} comments" with `=0` "No comments yet", "Reply to join the conversation"), or open (list oldest first: name, "Host" pill, time via `formatMoment`, Delete with an `AlertDialog` rendered on the server like the announcements page's, body `whitespace-pre-wrap`; "No comments yet" when empty; the form when `canPost`).
- **`src/app/e/[slug]/comment-form.tsx`**: client form, labelled textarea ("Add a comment", `maxLength` 1000), "Post", text kept on refusal and cleared when posted, refusal in `role="alert"` (the RSVP's "too fast" sentence for the limit).
- **Event form**: "Comments" (with a one-line hint) and "Email me when a guest comments", ticked for new events; `parseEventForm`, `EventInput`, `EventFormFields`, and `fields()` in `src/events/actions.ts`.
- **Messages**: `EventPage.comments.*`, `Mail.comment.{subject,body}`, `Events.form.{commentsEnabled,commentsEnabledHint,notifyOnComment}` in `en.json`, `zh-Hans.json`, `zh-Hant.json`.
- **Whitespace ruling**: announcements switched from `whitespace-pre-line` to `whitespace-pre-wrap` in the Poster layout and on the announcements page.
- **Browser spec** `e2e/comments.spec.ts`, five tests at 390 and desktop.

## TDD evidence

RED, with no modules: `pnpm exec vitest run src/comments src/rate-limit/config.test.ts src/events/form.test.ts` → `Cannot find module './comment'`, `Cannot find module './visibility'`, plus the config and form tests failing on the missing limit and settings.

RED, with compiling stubs (parser accepts anything, cap always true, `mayDelete` always true, `commentsView` always open, `takesComments` always true), same command:

```
 FAIL  src/comments/comment.test.ts > parseComment > wants something to say
AssertionError: expected { ok: true, body: '' } to deeply equal { ok: false, error: 'bodyRequired' }
 FAIL  src/comments/comment.test.ts > parseComment > carries from 1 to 1000 characters and no more
AssertionError: expected { ok: true, …(1) } to deeply equal { ok: false, error: 'bodyTooLong' }
 FAIL  src/comments/comment.test.ts > roomForAnother > lets an event have 500 comments, and refuses the 501st
AssertionError: expected true to be false // Object.is equality
 FAIL  src/comments/comment.test.ts > mayDelete > lets a guest delete their own comment and nobody else's
AssertionError: expected true to be false // Object.is equality
 FAIL  src/comments/visibility.test.ts > commentsView > locks them for anyone who has not replied
AssertionError: expected 'open' to be 'locked' // Object.is equality
 FAIL  src/comments/visibility.test.ts > takesComments > takes none on a cancelled event, whose comments stay to be read
AssertionError: expected true to be false // Object.is equality
 FAIL  src/events/form.test.ts > parseEventForm > turns wall-clock times in the event's zone into instants
AssertionError: expected { ok: true, input: { …(14) } } to deeply equal { ok: true, input: { …(16) } }
 FAIL  src/rate-limit/config.test.ts > rateLimitConfigFromEnv > has a limit for everything it protects when nothing is set, behind one reverse proxy
 Test Files  4 failed (4)
      Tests  15 failed | 16 passed (31)
```

GREEN, same command:

```
 Test Files  4 passed (4)
      Tests  31 passed (31)
```

Unit mutations: dropping the CR LF normalisation fails exactly "counts a line break as one character…"; `mayDelete` letting any guest delete fails exactly "lets a guest delete their own comment and nobody else's". Both restored (`cmp` against the backup).

## Tests and results

- `pnpm lint`: clean. `pnpm typecheck` (after `rm -f tsconfig.tsbuildinfo`): clean. `pnpm test`: 59 files, 453 passed (Vite's existing `configLoader: 'native'` warning only).
- **Browser, every run against a production build** (`pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on :3000 with `drizzle`, `public`, `.next/static` symlinked into `.next/standalone`; Compose dev profile for Postgres and Mailpit; two workers). `next dev` was never used.
  - First run of `comments.spec.ts`: 9 of 11; the first test failed at both widths on my own inbox count (expected 2, received 3). Mailpit showed the host's inbox in order: "Verify your email for OpenInvites", "Priya Nair replied to Ada’s birthday: Going", "Priya Nair commented on Ada’s birthday": `notifyOnRsvp` is on for a new event, so the reply email is there too. Fixed the expectation to 3; then 11 of 11.
  - Definitive, rebuilt from the committed source `eafe760`:
    - `comments`, `rsvp`, `guest-list`, `announcements`: **51 passed (3.1 min)**
    - `cancel-delete`, `accessibility`, `rate-limits`: **37 passed (3.4 min)**
    - `poster`, `keyboard`, `events`, `notifications`, `locales`, `reduced-motion`, `co-hosts` (container command test left out with `--grep-invert`, as ticket 05 did): **65 passed (2.9 min)**
    - Server log: only the known `The destination stream closed early.` and Better Auth's "User not found" warnings from the wrong-password tests.
- **Browser mutation checks** (five in one rebuild, then restored byte for byte and rebuilt): no author exclusion in the hosts' email → first test fails `Expected: 3, Received: 4`; `deletable` always true → delete test fails (guest sees Delete on the host's comment); `commentsFor` ignoring `commentsEnabled` → comments-off test fails at the heading; `takesComments` ignoring cancelled → cancelled test fails at the box; no `consume` → rate test fails (no alert).
- **Rate-limit environment**: neither the Compose dev/test profiles nor `.env.development` set `RATE_LIMIT_COMMENT`, so the "31st post" test runs against the default 30/10m. I left them unset. Note that the same test's address uses about 34 of `RATE_LIMIT_EVENT_PAGE=40/1m` (each guest post redraws the page and is counted), so it is close to that limit.
- **Migration**: on the dev DB, all 8,488 existing events read `comments_enabled = f, notify_on_comment = f`; `\d comment` shows columns, indexes, check and cascading FKs; in rolled-back transactions the check refused no-author and two-author rows and accepted an RSVP-authored one.
- **Strings** rendered with `use-intl`'s `createTranslator` in all three locales (count 0/1/3, locked line, mail subject and body with a line break and `{candles}` in the comment, form strings).
- **By eye**: screenshots at 390 and desktop of the locked card, the open card (host pill, indentation kept), the host's view, and the delete dialog.

## Files changed

New: `drizzle/0019_comments.sql`, `drizzle/meta/0019_snapshot.json`, `e2e/comments.spec.ts`, `src/app/e/[slug]/comment-form.tsx`, `src/comments/{actions,comment,comment.test,notify-hosts,repository,visibility,visibility.test}.ts`.

Modified: `deploy/.env.example`, `docs/operator/configuration.md`, `drizzle/meta/_journal.json`, `messages/{en,zh-Hans,zh-Hant}.json`, `src/app/(host)/events/[id]/announcements/page.tsx` (whitespace only), `src/app/(host)/events/event-form.tsx`, `src/app/e/[slug]/page.tsx`, `src/db/schema.ts`, `src/events/{actions,form,form.test}.ts`, `src/rate-limit/{config,config.test}.ts`, `src/themes/poster-layout.tsx`.

Not staged, as the rules say: `.scratch/m2-social/issues/06-comments.md` (ticked, `done`, dated comment), this report. `CONTEXT.md` and `.scratch/openinvites/decisions.md` untouched.

## Self-review findings

- Fixed before committing: an open section with no comments and no form (a cancelled event nobody commented on) would have been a heading over nothing; it now says "No comments yet" whenever the open list is empty.
- Fixed in the spec: the inbox count forgot the reply email (above).
- Checked: no remaining `whitespace-pre-line` on announcements (the two left are the rich-text description, outside the ruling); every new key is in all three files (`translations.test.ts` passes); `client-messages.test.ts` passes (the form reads `EventPage.comments`, covered by the page's `EventPage`); the stub files were fully replaced (the commit has the real modules, unit tests green after the browser mutations were restored).

## Concerns (design notes for the reviewer)

1. **Layout props: data plus a slot.** The brief asked that the layout take the comments and the viewer's standing as props, and that the section's components live under `src/app/e/[slug]/`. Nothing in `src/themes/` imports from `src/app/`, and client pieces reach the layout as slots (`rsvp`, the Design drawer). So `PosterLayout` takes `comments?: CommentsShown` (data) and `commentForm?: ReactNode` (the client form from `src/app/e/[slug]/comment-form.tsx`), and renders the delete confirmation itself as the announcements page does (a server-rendered `AlertDialog` with `deleteCommentAction` bound). Tickets 12/13 take the same two props; the delete markup would be copied or pulled into a shared server component then.
2. **One post action.** "Post as guest" and "post as host" are two branches of `postCommentAction`, which works out on the server who is posting; I did not export two actions.
3. **Hosts can comment on a draft.** The ticket hides the form only when the event is cancelled, and only hosts see a draft.
4. **Deletes are allowed on a cancelled event**, and by a crafted request when comments are off (no Delete is shown then).
5. **A sibling notifier, not a shared helper**: the shared part is about five lines of plumbing; the rule, the exclusion, the values and the link differ, and merging would rewrite ticket 01's tested code.
6. **`deploy/.env.example`** gained the `RATE_LIMIT_COMMENT` line beside the other limits, and the operator guide's Mail list gained the comment email. The brief named only the table row; I treated these as part of documenting the variable and the mail.
7. **Focus after a delete** falls to the document (the comment and its dialog leave the page), as on the announcements page; noted for ticket 15.
8. **Page size**: `src/app/e/[slug]/page.tsx` is 226 lines; this adds `commentsFor`, the viewer, one query and two props.
9. The ticket comment is dated 2026-10-07 as the brief said, though the machine's clock passed midnight during the work.
