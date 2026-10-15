# Context every implementer of an OpenInvites ticket needs

You are implementing one ticket of OpenInvites M1, an open source, self-hostable invitation service (Next.js 16 App Router + TypeScript, Tailwind 4 + shadcn/ui, Drizzle on Postgres 18, Better Auth, next-intl). Repository: `/home/leong/rsvp`, branch `m1-remaining`. Work there directly; never switch branches.

## Sources of truth, in order

1. Your ticket file (`.scratch/openinvites/issues/NN-*.md`) — its checkboxes are the acceptance criteria.
2. `.scratch/openinvites/spec.md` — the M1 spec; it binds where the ticket is silent. Read the sections your ticket touches, and "Testing Decisions" in full.
3. `CONTEXT.md` — the glossary. Use its words in code, UI copy, and tests; never the words it lists under _Avoid_.
4. `docs/adr/` — hard decisions. `.scratch/openinvites/decisions.md` — every product decision.
5. The `## Comments` sections of earlier tickets in `.scratch/openinvites/issues/` — handoff notes, including notes addressed to your ticket by number. Grep them for your ticket number (e.g. `grep -n "ticket 10\|Ticket 10" .scratch/openinvites/issues/*.md`).
6. `CLAUDE.md` at the repo root: this Next.js has breaking changes versus your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code, and heed deprecations.

The look was settled by a throwaway prototype on branch `prototype/event-page` (checked out read-only at `/home/leong/rsvp/.claude/worktrees/agent-a4e08520ae236ba41`; see its `PROTOTYPE.md`). It is a primary source for the look and flow, not code to copy. Do not modify that worktree.

## How the repo works

- Modules live under `src/<module>/` with pure rules in plain `.ts` files next to their `*.test.ts`; route handlers and server actions stay thin. Follow the existing patterns — read two or three neighbouring files before writing a new one.
- Every interface string lives in `messages/en.json`. The Chinese files (`zh-Hans.json`, `zh-Hant.json`) fall back to English key by key (`src/locale/fallback.ts`) and are filled in by ticket 20, so earlier tickets add English only. Translation files are organised per screen; duplicate a string across namespaces rather than sharing keys between screens.
- Migrations: `pnpm db:generate` after editing `src/db/schema.ts`; the next number is whatever follows the highest in `drizzle/`. Hand-written SQL migrations follow the existing ones.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (Vitest unit tests), browser tests with Playwright (`e2e/*.spec.ts`, run at 390px and desktop).
- Browser tests, fast loop: `docker compose --profile dev up -d --wait` then `next dev` on port 3000 (`pnpm dev` does both), then `pnpm exec playwright test <file>`. Definitive run before committing: stop the dev server (`fuser -k 3000/tcp` — never `pkill -f 'next dev'`, it kills your own shell), then `docker compose --profile test up -d --build --wait && pnpm exec playwright test` (image build ≈ 4 min). Both stacks share the db and mail containers and port 3000: stop the `app` container (`docker compose --profile test stop app`) before running `next dev`. When you finish, stop any dev server you started (`fuser -k 3000/tcp`) so the next ticket starts from a free port.
- `pnpm typecheck` can report a missing next-intl key that is plainly in `messages/en.json`: that is a stale `tsconfig.tsbuildinfo`. `rm -f tsconfig.tsbuildinfo` and re-run before believing it.
- Writing files through bash heredocs can collapse `\\` into `\`. Prefer the Write/Edit tools for source files. After writing anything with backslash escapes, verify with `python3 -c "print(repr(open(p).read()))"`-style checks, and mutation-check escaping or parsing logic (break it, see the test fail, restore).

## Testing rules (from the spec, binding)

- A good test observes what a host, guest, or operator can observe, and nothing else. Never assert on database rows, component internals, or call order.
- Two seams only: the browser (Playwright against the real app, real Postgres, fake mail from the Compose test profile) and pure rules called directly (Vitest). No tests at other seams.
- Test first where the ticket's logic is a pure rule: write the failing unit test, see it fail, then implement.
- Test output must be pristine: no stray warnings.

## Commit and bookkeeping

- Commit your work on `m1-remaining` in one commit (or a few coherent ones). Match the existing message style: a subject in the form `<Area>: <what a person can now do>` in plain prose, a short prose body about behaviour and any notable decision (see `git log -5`), and end the message with the line
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- Stage files by explicit path. Never `git add -A` / `git add .`. Never stage `CONTEXT.md` or `.scratch/openinvites/decisions.md` (they hold the maintainer's uncommitted planning edits — do not modify them either; if you believe a glossary or decision change is needed, say so in your report). Never stage anything under `.claude/` or `.superpowers/`. Issue files under `.scratch/openinvites/issues/` are untracked on purpose; edit them but do not stage them.
- Never push, tag, publish, or change anything outside this repository.
- When done, in your ticket file: set `**Status:** done`, tick the checkboxes you satisfied, and append a dated entry under `## Comments` (create the heading if absent) in the same shape earlier tickets use: "**2026-09-23, implementing agent.** Done. <checks that passed>", then "How it landed:", "Decisions and things to know:", and "Left for later tickets or noted:" (with notes addressed to later tickets by number). Anything you could not do, and why, goes there too — never claim a checkbox you did not satisfy.

## You do not dispatch subagents

Do all the work yourself. Never spawn a subagent, and never spawn a reviewer: a fresh reviewer is dispatched against your diff after you report.
