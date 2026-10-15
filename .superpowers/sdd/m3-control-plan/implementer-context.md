# Context every implementer of an OpenInvites M3 ticket needs

You are implementing one ticket of OpenInvites M3, the control milestone of an open source, self-hostable invitation service (Next.js 16 App Router + TypeScript, Tailwind 4 + shadcn/ui, Drizzle on Postgres 18, Better Auth, next-intl, nodemailer). Repository: `/home/leong/rsvp`, branch `m3-control`. Work there directly; never switch branches.

## Sources of truth, in order

1. Your ticket file (`.scratch/m3-control/issues/NN-*.md`) — its checkboxes are the acceptance criteria, with the exact values to use.
2. `.scratch/m3-control/spec.md` — the M3 spec; it binds where the ticket is silent. Read the sections your ticket touches, and "Testing Decisions" in full. Then `.scratch/m2-social/spec.md`, the M2 spec, for the mail outbox, co-hosts, comments, announcements, reminders and the layouts you are extending.
3. `.scratch/openinvites/spec.md` — the M1 spec; it binds where both are silent. Its "Implementation Decisions" and "Testing Decisions" describe how the code you are extending was built.
4. `CONTEXT.md` — the glossary. Use its words in code, UI copy, and tests; never the words it lists under _Avoid_.
5. `docs/adr/` — hard decisions. `.scratch/openinvites/decisions.md` — every product decision, M3's included.
6. The `## Comments` sections of earlier tickets in `.scratch/m3-control/issues/`, `.scratch/m2-social/issues/` and `.scratch/openinvites/issues/` — handoff notes, including notes addressed to your ticket by number. Grep them for your ticket number (e.g. `grep -n "ticket 03\|Ticket 03" .scratch/m3-control/issues/*.md .scratch/m2-social/issues/*.md`).
7. `CLAUDE.md` at the repo root: this Next.js has breaking changes versus your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code, and heed deprecations.

The look was settled by a throwaway prototype on branch `prototype/event-page` (checked out read-only at `/home/leong/rsvp/.claude/worktrees/agent-a4e08520ae236ba41`; see its `PROTOTYPE.md`). It is the primary source for the Broadsheet and Thread layouts and the effects, not code to copy: it uses Motion, which is not a dependency here. Do not modify that worktree.

## How the repo works

- Modules live under `src/<module>/` with pure rules in plain `.ts` files next to their `*.test.ts`; route handlers and server actions stay thin. Follow the existing patterns — read two or three neighbouring files before writing a new one. M1's modules: Events, RSVPs, Themes, Questions, Calendar, Storage, Mail, Auth, Uploads, Sharing, Locale, RateLimit, Instance, Legal, RichText.
- Every interface string lives in `messages/en.json`, and every key you add there you also add to `messages/zh-Hans.json` (Simplified Chinese) and `messages/zh-Hant.json` (Traditional Chinese), translated with care (plain, warm, the register the existing Chinese strings use; never English copied over), keeping every ICU placeholder, with plurals folded to `other` where Chinese has no distinction. `translations.test.ts` fails on any key missing from either file, so `pnpm test` is green only when all three files agree. The maintainer reads both scripts and reviews M3's Chinese in ticket 11; list the strings you were least sure of in your ticket comment. Translation files are organised per screen; duplicate a string across namespaces rather than sharing keys between screens.
- Migrations: `pnpm db:generate` after editing `src/db/schema.ts`; the next number is whatever follows the highest in `drizzle/` (0022 at the start of M3). Hand-edit the generated SQL where your ticket says what existing rows must become (an `UPDATE` after the `ALTER`), as `0013` does for its one row.
- Mail: `src/mail/send.ts` sends one plain-text message over SMTP; `isMailConfigured()` says whether the instance has mail. Mail about events goes through the outbox (`src/mail/outbox.ts`) and its worker, never `sendMail` directly; Better Auth's own mails stay inline.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (Vitest unit tests), browser tests with Playwright (`e2e/*.spec.ts`, run at 390px and desktop; `e2e/test.ts` is the fixture every spec imports, `e2e/hosts.ts` and `e2e/events.ts` the helpers, Mailpit at `http://localhost:8025` for mail).
- Browser tests, fast loop: `docker compose --profile dev up -d --wait` then `NEXT_TELEMETRY_DISABLED=1 pnpm exec next dev` in the background on port 3000 (`pnpm dev` does both), then `pnpm exec playwright test <file> --workers=2 --grep-invert operator`. This machine has 4 GB of RAM and its swap is usually full: never more than two workers. When `next dev` makes tests time out on waits unrelated to your change (it did for task 1), take the definitive run against a production build: `pnpm build`, then `node --env-file=.env.development .next/standalone/server.js` in the background on port 3000 with the Compose dev profile up (see the M2 ledger `.superpowers/sdd/m2-social-plan/progress.md` and `.scratch/m2-social/issues/05-co-hosts.md` "Evidence" for the exact commands), and say in your report which loop each run used. Stop whatever is on port 3000 with `fuser -k 3000/tcp` — never `pkill -f 'next dev'`, it kills your own shell. Never `docker compose down -v`. When you finish, stop any server you started so the next ticket starts from a free port.
- `pnpm typecheck` can report a missing next-intl key that is plainly in `messages/en.json`: that is a stale `tsconfig.tsbuildinfo`. `rm -f tsconfig.tsbuildinfo` and re-run before believing it.
- Writing files through bash heredocs can collapse `\\` into `\`. Prefer the Write/Edit tools for source files. After writing anything with backslash escapes, verify with `python3 -c "print(repr(open(p).read()))"`-style checks, and mutation-check escaping or parsing logic (break it, see the test fail, restore).

## Testing rules (from the spec, binding)

- A good test observes what a host, guest, or operator can observe, and nothing else. Never assert on database rows, component internals, or call order.
- Two seams only: the browser (Playwright against the real app, real Postgres, Mailpit) and pure rules called directly (Vitest). No tests at other seams. Mail is observed in Mailpit, as `e2e/registration.spec.ts` and `e2e/hosts.ts` (`latestMailTo`, `linkIn`) already do.
- Test first where the ticket's logic is a pure rule: write the failing unit test, see it fail, then implement. Put RED and GREEN evidence in your report.
- Test output must be pristine: no stray warnings.

## Commit and bookkeeping

- Commit your work on `m3-control` in one commit (or a few coherent ones). Match the existing message style: a subject in the form `<Area>: <what a person can now do>` in plain prose, a short prose body about behaviour and any notable decision (see `git log -8`), and end the message with the line
  `Co-Authored-By: Claude <Model> 5.5 <noreply@anthropic.com>`, naming the model you are (Opus or Sonnet). No sign-off line.
- Stage files by explicit path. Never `git add -A` / `git add .` / `git commit -a`. Never stage `CONTEXT.md` or anything under `.scratch/`, `.claude/` or `.superpowers/`. `CONTEXT.md` and `.scratch/openinvites/decisions.md` hold the maintainer's uncommitted edits — do not modify them either; if you believe a glossary or decision change is needed, say so in your report. Ticket files are untracked on purpose: edit them, never stage them.
- Never push, tag, publish, or change anything outside this repository.
- When done, in your ticket file: set `**Status:** done` only if every box is ticked, tick the boxes you satisfied, and append a dated entry under `## Comments` in the shape the M1 tickets use (`.scratch/openinvites/issues/24-auth-secret-checked-at-start.md` is a good model): "**<date>, implementing agent.** Done. <checks that passed>", then "How it landed:", "Decisions and things to know:", and "Left for later tickets or noted:" (with notes addressed to later tickets by number), then "Evidence:" with the RED/GREEN runs and the browser runs. Anything you could not do, and why, goes there too — never claim a checkbox you did not satisfy.

## You do not dispatch subagents

Do all the work yourself. Never spawn a subagent, and never spawn a reviewer: a fresh reviewer is dispatched against your diff after you report.

## M3 particulars

- M1's modules plus M2's: Hosts (roles, co-hosts), Comments, Announcements, Reminders, and the outbox and worker in Mail. M3 adds Invites, Reports, Retention and Turnstile, and grows RSVPs (admission, the waitlist, contact verification), Instance (limits, the reports inbox) and Events (the custom link).
- Three layouts render the guest flow from one hook, `src/app/e/[slug]/use-rsvp-flow.ts`: Poster (`rsvp-flow.tsx`), Broadsheet (`src/themes/broadsheet-ballot.tsx`, `broadsheet-receipt.tsx`) and Thread (`src/themes/thread-composer.tsx`, `thread-script.ts`). A change to the flow's steps or its outcomes is made once in the hook and presented in each layout; the ticket says what each layout shows. Run `rsvp.spec.ts`, `broadsheet.spec.ts`, `thread.spec.ts` and `keyboard.spec.ts` after any flow change, at both widths.
- The Docker test profile (`docker compose --profile test up -d --build --wait`, then `CI=1 pnpm exec playwright test --workers=2`) is the definitive loop for anything that needs the `app`, `app-social`, `app-fresh` or `app-no-mail` containers (the operator command, social login, Turnstile, the fresh-instance specs, retention's test instance). The image takes a few minutes to build; `CI=1` turns on `failOnFlakyTests`, so a test that passes only on retry fails the run, and a locator that can match a random host name (`Ada <base36>`) must be exact.
- `app` and `app-social` share one database and both run the worker; a reminder or a promotion email may be queued by either, under its own `BASE_URL`. Assert links in mail by their path, not their host (see `e2e/reminders.spec.ts:110`).
