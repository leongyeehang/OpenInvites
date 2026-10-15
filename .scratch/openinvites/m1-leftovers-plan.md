# M1 leftovers: plan

Spec: `.scratch/openinvites/spec.md` (M1). Each task's requirements are its ticket. The ticket is the binding text for that task.

Branch: `m1-leftovers`, off `main` at 23fbfa6, in the main checkout (not a worktree).

## Global Constraints

- This is Next.js 16.3 with breaking changes from older versions. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. `src/proxy.ts` is what older Next.js called middleware.
- Match the surrounding code: its comment density and its voice (plain full sentences that say what a thing is for, citing the spec or a ticket where the existing comments do), naming, and idioms. Touch only what the ticket needs.
- Commit only the files your change touches, staged by path. Never stage or commit `CONTEXT.md`, `.scratch/`, `.claude/` or `.superpowers/`. Never use `git add -A`, `git add .` or `git commit -a`. Never push, tag, or amend a commit you did not make in this task.
- Commit style: a subject of the form `<Area>: <what is now true, in plain words>`, a body that says what was wrong and what changed, wrapped near 100 columns, and the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No sign-off line.
- Checks before reporting DONE: `pnpm lint`, `pnpm typecheck`, `pnpm test` (all unit tests), and the browser specs the ticket names, run in the fast loop. If `pnpm typecheck` reports missing next-intl keys that exist, delete `tsconfig.tsbuildinfo` and run it again.
- Fast loop for browser specs: `docker compose --profile dev up -d --wait`, then `NEXT_TELEMETRY_DISABLED=1 pnpm exec next dev` in the background on port 3000, then `pnpm exec playwright test <spec files> --grep-invert operator`. Stop the dev server with `fuser -k 3000/tcp`, never `pkill`. Never run `docker compose down -v` or anything that removes volumes.
- After the work, append a dated entry (2026-10-02) under `## Comments` in the task's ticket file. Say what changed, the commits, and the test evidence, in the style of the earlier tickets' comments. Tick the boxes you met. Set `**Status:** done` only if every box is ticked; otherwise leave it and say which box is open and why. The ticket file is untracked: edit it, never commit it.

## Task 1: Not found for unknown edit and host invitation links

Ticket: `.scratch/openinvites/issues/22-not-found-for-unknown-token-links.md`. Read it first: it is your requirements, with the exact values to use.

Browser specs to run: `e2e/rsvp.spec.ts`, `e2e/events.spec.ts`, and the spec holding the new host invitation test.

## Task 2: The Design drawer's thumbnail loads a small rendition

Ticket: `.scratch/openinvites/issues/23-drawer-thumbnail-size.md`. Read it first: it is your requirements, with the exact values to use.

Browser specs to run: `e2e/uploads.spec.ts`, `e2e/poster.spec.ts`, `e2e/design.spec.ts`.

## Task 3: AUTH_SECRET checked at start

Ticket: `.scratch/openinvites/issues/24-auth-secret-checked-at-start.md`. Read it first: it is your requirements, with the exact values to use.

Browser specs to run: `e2e/host-accounts.spec.ts` (sign-in still works with the secret now passed through `authSecret()`).
