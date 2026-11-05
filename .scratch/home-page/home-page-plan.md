# The home page as an invitation: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Each task's requirements are its ticket; the steps are the ticket's checkboxes.

**Goal:** every instance opens on an invitation to it. The operator names it and chooses its posters, a fresh instance guides its installer, and a new operator is welcomed once.

**Architecture:** One pure module (`src/instance/home.ts`) holds the rules: normalising the texts, choosing the poster pool, the name fallback, the home page's theme. Five new columns on the one `instance_settings` row store the choices, and a sixth comes with the welcome sheet. The home page builds a `Theme` from a gallery poster and draws it with the event page's own parts (`ThemedPage`, `PosterHero`, `Glass`, the reply bar's frame), so it matches the event page by construction.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind 4 + shadcn/ui, Drizzle on Postgres 18, Better Auth, next-intl, Radix, Playwright, Vitest. No new runtime dependency.

**Spec:** `.scratch/home-page/spec.md`, with the mockup at `mockup/home-page.html`. Each task's requirements are its ticket under `.scratch/home-page/issues/`. The ticket binds for its task, the spec binds where the ticket is silent, and the M4, M3, M2 and M1 specs, in that order, bind where both are silent.

Branch: `home-page`, off `main` at a7cfbbf, in the main checkout. Tasks run one at a time, in order.

## Global Constraints

- This is Next.js 16 with breaking changes. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. `src/proxy.ts` is what older Next.js called middleware.
- `.superpowers/sdd/m3-control-plan/implementer-context.md` says how the repository works (sources of truth, the testing seams, the Compose test profile, the browser test loop). Read it first, and expect paths that M4 moved.
- Node 22 and pnpm are in `~/.local/opt/node/bin`, which is not on PATH. Prefix commands with `PATH=$HOME/.local/opt/node/bin:$PATH`.
- Never kill `next-server` by name: it also kills the Docker test app mid-run.
- Match the surrounding code: its comment density and voice (plain full sentences that say what a thing is for, citing the spec or a ticket where existing comments do), naming and idioms. Use `CONTEXT.md`'s words. Touch only what the ticket needs.
- Two testing seams only: the browser (Playwright against the real app, real Postgres, Mailpit) and pure rules called directly (Vitest). A test observes what a visitor, host or operator can observe. Test first where the logic is a pure rule.
- Settings that change what every page shows (the name, the posters, "Run by") are only ever saved in specs on `app-fresh` (the `home-instance` project), never on the shared `app`.
- Every interface string lives in `messages/en.json`, and every key added there is added, translated, to `zh-Hans.json` and `zh-Hant.json`, so that `translations.test.ts` stays green at every commit.
- No new runtime dependency. Nothing leaves the instance (ADR-0005).
- Migrations: edit `src/db/schema.ts`, then `pnpm db:generate`. The next numbers are 0041 and 0042. Hand-edit the SQL where a ticket says what existing rows become.
- Commit only the files the change touches, staged by path. Never stage `CONTEXT.md`, `.claude/` or `.superpowers/`, and never `git add -A`, `git add .` or `git commit -a`. Never push or tag.
- Commit style: a subject of the form `<Area>: <what is now true, in plain words>`, a body saying what was missing and what changed, wrapped near 100 columns, and the trailer `Co-Authored-By: Claude <Model> 5.5 <noreply@anthropic.com>`.
- Checks before reporting done: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the browser specs the ticket names plus any existing spec the change could affect. If `pnpm typecheck` reports missing next-intl keys that exist, delete `tsconfig.tsbuildinfo` and rerun.
- After the work, append a dated entry under `## Comments` in the ticket (M4's tickets are the model), tick the boxes met, and set `**Status:** done` only when every box is ticked. Commit the ticket with the work: this tracker is in git.

## Review Focus

Inputs the spec implies but a ticket's tests could miss. Each line names the ticket that owns the test.

1. A name with markup or an ampersand ("Lim & <Family>") shows literally in the page, the tab, the header and an email subject, never as HTML (ticket 03's browser test).
2. A 40-character name with no spaces, or 40 Chinese characters, wraps inside the title at 390 px without the page scrolling sideways (ticket 01's unit test for the count, ticket 02's browser test for the wrap).
3. Picked posters that a later release renames or removes: the home page still draws, from the posters that remain or from the whole gallery (ticket 01's `posterPool` unit test).
4. The operator deletes their account while "Run by" is on: the home page draws without the line (ticket 02's `runBy` unit test).
5. The operator switches registration between Open and Invitation only: the next visit's bar follows at once, with no stale cached page (ticket 02's browser test).

---

## Task 1: The Home page card in Instance settings

Ticket: `.scratch/home-page/issues/01-home-page-settings.md`. Model: Sonnet.

## Task 2: The home page as an invitation

Ticket: `.scratch/home-page/issues/02-the-home-page.md`. Model: Opus (the shared parts are reused, not copied, and the page must match the event page).

## Task 3: The instance name in the tab, the header and the emails

Ticket: `.scratch/home-page/issues/03-the-name-elsewhere.md`. Model: Sonnet.

## Task 4: The operator's welcome sheet

Ticket: `.scratch/home-page/issues/04-operator-welcome.md`. Model: Sonnet.

## Task 5: Translations, accessibility and docs

Ticket: `.scratch/home-page/issues/05-translations-accessibility-docs.md`. Model: Opus (the full suite and the two Chinese scripts).
