# M3, control: plan

> **For agentic workers:** this plan is executed with superpowers:subagent-driven-development, one task at a time, as M1 and M2 were: a fresh implementer (Opus or Sonnet, chosen per task) and a fresh reviewer per task, every ruling in the ledger at `.superpowers/sdd/m3-control-plan/progress.md`.

**Goal:** the host decides how many come and who, the guest proves who they are when the host asks, and the instance limits, protects, reports and forgets.

**Architecture:** one pure admission rule and one transaction decide what a saved reply becomes (approval, capacity, the waitlist); the M2 mail worker becomes the instance's clock and gains retention; new modules Invites, Reports, Retention and Turnstile; the Instance module gains limits and a reports inbox; every link to an event page goes through one helper that knows the custom slug.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind 4 + shadcn/ui, Drizzle on Postgres 18, Better Auth, next-intl, nodemailer, Playwright, Vitest. No new runtime dependency.

**Spec:** `.scratch/m3-control/spec.md`. Each task's requirements are its ticket under `.scratch/m3-control/issues/`. The ticket is the binding text for that task; the spec binds where the ticket is silent; the M2 spec (`.scratch/m2-social/spec.md`) and then the M1 spec (`.scratch/openinvites/spec.md`) bind where both are silent.

Branch: `m3-control`, off `m2-social` at c5c976a (PR #1, under review), in the main checkout (not a worktree). Tasks run one at a time, in order.

## Global Constraints

- This is Next.js 16.3 with breaking changes from older versions. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. `src/proxy.ts` is what older Next.js called middleware.
- Read `.superpowers/sdd/m3-control-plan/implementer-context.md` before anything else: it says how the repository works, the sources of truth in order, the testing seams, and the commit and bookkeeping rules.
- Match the surrounding code: its comment density and its voice (plain full sentences that say what a thing is for, citing the spec or a ticket where the existing comments do), naming, and idioms. Use `CONTEXT.md`'s words; never its _Avoid_ words. Touch only what the ticket needs.
- Two testing seams only (M1 spec, "Testing Decisions"): the browser (Playwright against the real app, real Postgres, Mailpit) and pure rules called directly (Vitest). A test observes what a host, guest or operator can observe; never database rows, component internals, or call order. Test first where the ticket's logic is a pure rule.
- Every interface string lives in `messages/en.json`, and every key you add there is added to `messages/zh-Hans.json` and `messages/zh-Hant.json` too, translated (not copied English), so that `translations.test.ts` stays green at every commit; the maintainer, who reads both scripts, reviews them in task 11. List the strings you were least sure of in your ticket comment.
- No new runtime dependency. No AI. Nothing leaves the instance but mail to the operator's SMTP server and, when the operator sets Turnstile's keys, the verification call to Cloudflare (ADR-0005).
- Every write of an RSVP goes through the one transaction that locks the event row and calls `admit` (from task 6 on); no later task writes an RSVP any other way.
- Every link to an event page goes through `eventPath(event)` (from task 3 on); no later task builds `/e/<slug>` by hand.
- Mail about events goes through the outbox (`queueMail`), never `sendMail`, except the verification code (task 5), which the guest is waiting for.
- Migrations: edit `src/db/schema.ts`, then `pnpm db:generate`; the next number follows the highest in `drizzle/` (0022 at the start of M3). Hand-edit the SQL where the ticket says what existing rows must become. An enum value is added with `ALTER TYPE ... ADD VALUE` in a migration of its own, since Postgres cannot use a new value in the transaction that adds it.
- Commit only the files your change touches, staged by path. Never stage or commit `CONTEXT.md`, `.scratch/`, `.claude/` or `.superpowers/`. Never use `git add -A`, `git add .` or `git commit -a`. Never push, tag, or amend a commit you did not make in this task.
- Commit style: a subject of the form `<Area>: <what is now true, in plain words>`, a body that says what was wrong or missing and what changed, wrapped near 100 columns, and the trailer `Co-Authored-By: Claude <Model> 5.5 <noreply@anthropic.com>` naming the model you are (Opus or Sonnet). No sign-off line.
- Checks before reporting DONE: `pnpm lint`, `pnpm typecheck`, `pnpm test` (all unit tests), and the browser specs the ticket names plus any existing spec your change could affect, in the loop the implementer context describes. If `pnpm typecheck` reports missing next-intl keys that exist, delete `tsconfig.tsbuildinfo` and rerun.
- After the work, append a dated entry (today's date) under `## Comments` in the task's ticket file, in the style of the M2 tickets' comments (`.scratch/m2-social/issues/05-co-hosts.md` is the model). Tick the boxes you met. Set `**Status:** done` only when every box is ticked.

## Review Focus

Inputs the spec implies but a task's tests could miss; each line names the task that owns the test.

1. Two guests reply Going at once for the last place: exactly one is Going and one is waitlisted, never both Going (task 6's browser test sends two replies concurrently).
2. The first retention sweep after the upgrade on an instance with years of events marks everything old and deletes nothing for 30 days, with or without mail (task 10's unit test of the sweep plan, and its browser test's first sweep).
3. A custom slug that equals an existing random slug, a retired slug, or a slug another event will be given later: the custom one is refused, and the random generator never issues a slug that a custom one holds (task 3's unit test of the collision check in both directions).
4. A guest at the `mail` rate limit asking for the code again sees a clear line and the step stays usable, not a stuck form (task 5's browser test against the test profile's low limit).
5. A pending or declined guest posting a comment or loading the guest list by a crafted request is refused exactly as a visitor without a reply is (task 7's browser test replays a comment post from a pending guest's device).

---

## Task 1: Operator limits

Ticket: `.scratch/m3-control/issues/01-operator-limits.md`. Read it first: it is your requirements, with the exact values to use. Model: Sonnet.

## Task 2: Report an event

Ticket: `.scratch/m3-control/issues/02-report-event.md`. Model: Sonnet.

## Task 3: The custom link

Ticket: `.scratch/m3-control/issues/03-custom-link.md`. Model: Sonnet.

## Task 4: Contact details: email optional or required, and a phone number

Ticket: `.scratch/m3-control/issues/04-contact-details.md`. Model: Opus.

## Task 5: The email proven by a code

Ticket: `.scratch/m3-control/issues/05-email-verified-by-code.md`. Model: Opus.

## Task 6: Capacity and the waitlist

Ticket: `.scratch/m3-control/issues/06-capacity-and-waitlist.md`. Model: Opus.

## Task 7: Approval

Ticket: `.scratch/m3-control/issues/07-approval.md`. Model: Opus.

## Task 8: Personal invite links

Ticket: `.scratch/m3-control/issues/08-personal-invite-links.md`. Model: Opus.

## Task 9: Turnstile

Ticket: `.scratch/m3-control/issues/09-turnstile.md`. Model: Opus.

## Task 10: Retention

Ticket: `.scratch/m3-control/issues/10-retention.md`. Model: Opus.

## Task 11: Translations, accessibility and performance pass, hardening, and the 0.4 notes

Ticket: `.scratch/m3-control/issues/11-translations-accessibility-docs.md`. Model: Opus.
