# M2, the social layer: plan

Spec: `.scratch/m2-social/spec.md`. Each task's requirements are its ticket under `.scratch/m2-social/issues/`. The ticket is the binding text for that task; the spec binds where the ticket is silent; the M1 spec (`.scratch/openinvites/spec.md`) binds where both are silent.

Branch: `m2-social`, off `main` at 51453b1 (release 0.2.0), in the main checkout (not a worktree). Tasks run one at a time, in order.

## Global Constraints

- This is Next.js 16.3 with breaking changes from older versions. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. `src/proxy.ts` is what older Next.js called middleware.
- Read `.superpowers/sdd/m2-social-plan/implementer-context.md` before anything else: it says how the repository works, the sources of truth in order, the testing seams, and the commit and bookkeeping rules.
- Match the surrounding code: its comment density and its voice (plain full sentences that say what a thing is for, citing the spec or a ticket where the existing comments do), naming, and idioms. Use `CONTEXT.md`'s words; never its _Avoid_ words. Touch only what the ticket needs.
- Two testing seams only (M1 spec, "Testing Decisions"): the browser (Playwright against the real app, real Postgres, Mailpit) and pure rules called directly (Vitest). A test observes what a host, guest or operator can observe; never database rows, component internals, or call order. Test first where the ticket's logic is a pure rule.
- Every interface string lives in `messages/en.json`, and every key you add there is added to `messages/zh-Hans.json` and `messages/zh-Hant.json` too, translated (not copied English), so that `translations.test.ts` stays green at every commit; the maintainer, who reads both scripts, reviews them in task 15. Dates, times, numbers and lists use the locale's formatting. Host-written content is shown as written.
- No new runtime dependency. No AI or external API. Nothing leaves the instance (ADR-0005).
- Migrations: edit `src/db/schema.ts`, then `pnpm db:generate`; the next number follows the highest in `drizzle/`. Hand-edit the SQL where the ticket says what existing rows must become.
- Commit only the files your change touches, staged by path. Never stage or commit `CONTEXT.md`, `.scratch/`, `.claude/` or `.superpowers/`. Never use `git add -A`, `git add .` or `git commit -a`. Never push, tag, or amend a commit you did not make in this task.
- Commit style: a subject of the form `<Area>: <what is now true, in plain words>`, a body that says what was wrong or missing and what changed, wrapped near 100 columns, and the trailer `Co-Authored-By: Claude <Model> 5.5 <noreply@anthropic.com>` naming the model you are (Opus or Sonnet). No sign-off line.
- Checks before reporting DONE: `pnpm lint`, `pnpm typecheck`, `pnpm test` (all unit tests), and the browser specs the ticket names plus any existing spec your change could affect, run in the fast loop. If `pnpm typecheck` reports missing next-intl keys that exist, delete `tsconfig.tsbuildinfo` and run it again.
- Fast loop for browser specs: `docker compose --profile dev up -d --wait`, then `NEXT_TELEMETRY_DISABLED=1 pnpm exec next dev` in the background on port 3000, then `pnpm exec playwright test <spec files> --workers=2 --grep-invert operator`. Stop the dev server with `fuser -k 3000/tcp`, never `pkill`. Never run `docker compose down -v` or anything that removes volumes. This machine has 4 GB of RAM and its swap is usually full: never more than two Playwright workers, and when `next dev` makes tests time out on waits that have nothing to do with your change, take the definitive run against a production build instead: `pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` on port 3000 with the Compose dev profile up (task 1 did this; its report shows the commands). Say in your report which loop each run used.
- After the work, append a dated entry (today's date) under `## Comments` in the task's ticket file. Say what changed, the commits, and the test evidence, in the style of the M1 tickets' comments (`.scratch/openinvites/issues/24-*.md` is a good model). Tick the boxes you met. Set `**Status:** done` only if every box is ticked; otherwise leave it and say which box is open and why. The ticket file is untracked: edit it, never commit it.

## Task 1: The host is emailed when a guest replies

Ticket: `.scratch/m2-social/issues/01-host-emailed-on-replies.md`. Read it first: it is your requirements, with the exact values to use. It also builds the mail outbox and worker every later task's email goes through (spec, "Mail outbox and worker").

## Task 2: Guests are told when an event is cancelled, and can stop email about it

Ticket: `.scratch/m2-social/issues/02-cancellation-notice-and-stop-emails.md`. Read it first: it is your requirements, with the exact values to use.

## Task 3: Announcements, and "send a reminder now"

Ticket: `.scratch/m2-social/issues/03-announcements.md`. Read it first: it is your requirements, with the exact values to use.

## Task 4: Automatic reminders

Ticket: `.scratch/m2-social/issues/04-automatic-reminders.md`. Read it first: it is your requirements, with the exact values to use.

## Task 5: Co-hosts

Ticket: `.scratch/m2-social/issues/05-co-hosts.md`. Read it first: it is your requirements, with the exact values to use.

## Task 6: Comments

Ticket: `.scratch/m2-social/issues/06-comments.md`. Read it first: it is your requirements, with the exact values to use.

## Task 7: Sign in with an emailed link

Ticket: `.scratch/m2-social/issues/07-magic-link-login.md`. Read it first: it is your requirements, with the exact values to use.

## Task 8: Multiple-choice questions

Ticket: `.scratch/m2-social/issues/08-multiple-choice-questions.md`. Read it first: it is your requirements, with the exact values to use.

## Task 9: Duplicate an event

Ticket: `.scratch/m2-social/issues/09-duplicate-event.md`. Read it first: it is your requirements, with the exact values to use.

## Task 10: How often the event page was opened

Ticket: `.scratch/m2-social/issues/10-view-count.md`. Read it first: it is your requirements, with the exact values to use.

## Task 11: Effects

Ticket: `.scratch/m2-social/issues/11-effects.md`. Read it first: it is your requirements, with the exact values to use.

## Task 12: The Broadsheet layout

Ticket: `.scratch/m2-social/issues/12-broadsheet-layout.md`. Read it first: it is your requirements, with the exact values to use.

## Task 13: The Thread layout

Ticket: `.scratch/m2-social/issues/13-thread-layout.md`. Read it first: it is your requirements, with the exact values to use.

## Task 14: Backgrounds from the host's picture

Ticket: `.scratch/m2-social/issues/14-derived-backgrounds.md`. Read it first: it is your requirements, with the exact values to use.

## Task 15: Translations, accessibility and performance pass, and the 0.3 notes

Ticket: `.scratch/m2-social/issues/15-translations-accessibility-docs.md`. Read it first: it is your requirements, with the exact values to use.
