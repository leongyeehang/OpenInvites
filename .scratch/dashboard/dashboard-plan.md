# The dashboard as a shelf of invitations: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Each task's requirements are its ticket; the steps are the ticket's checkboxes.

**Goal:** a host who signs in sees their events as their posters, the next one first with what needs them, inside a header and ground that match the rest of M4; the interface says "site" where it said "instance".

**Architecture:** One pure module (`src/dashboard/shelves.ts`) decides Next up, the shelves, each tile's chip and number. The dashboard page draws its result with a new `PosterTile`, built on the M4 theme pieces (`resolveTheme`, the title fonts), so a tile matches its event page by construction. The host layout gains the tinted ground and a header with a New event pill and an account menu on Radix `DropdownMenu`. The wording change is messages only.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind 4 + shadcn/ui, Drizzle on Postgres 18, Better Auth, next-intl, Radix (`radix-ui`), Playwright, Vitest. No new runtime dependency.

**Spec:** `.scratch/dashboard/spec.md`, with the mockup at `mockup/dashboard-directions.html` (direction A). Each task's requirements are its ticket under `.scratch/dashboard/issues/`. The ticket binds for its task, the spec binds where the ticket is silent, and the home page, M4, M3, M2 and M1 specs, in that order, bind where both are silent.

Branch: `dashboard`, off `main` at 5e9b672, in the main checkout. Tasks run one at a time, in order.

## Global Constraints

- This is Next.js 16 with breaking changes. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. `src/proxy.ts` is what older Next.js called middleware.
- `.superpowers/sdd/m3-control-plan/implementer-context.md`, if it still exists, says how the repository works (sources of truth, the testing seams, the Compose test profile, the browser test loop); expect paths that M4 and the home page moved. Otherwise `docs/contributing/` and the M4 tickets under `.scratch/m4-extras/issues/` are the model.
- Node 22 and pnpm are in `~/.local/opt/node/bin`, which is not on PATH. Prefix commands with `PATH=$HOME/.local/opt/node/bin:$PATH`.
- Never kill `next-server` by name: it also kills the Docker test app mid-run.
- Match the surrounding code: its comment density and voice (plain full sentences that say what a thing is for, citing the spec or a ticket where existing comments do), naming and idioms. Use `CONTEXT.md`'s words in code. Touch only what the ticket needs.
- Two testing seams only: the browser (Playwright against the real app, real Postgres, Mailpit) and pure rules called directly (Vitest). A test observes what a visitor, host or operator can observe. Test first where the logic is a pure rule.
- Every interface string lives in `messages/en.json`, and every key added there is added, translated, to `zh-Hans.json` and `zh-Hant.json`, so that `translations.test.ts` stays green at every commit. A key no code reads any more is removed from all three.
- In the interface, never "instance": "this site" / "the site" in English, 本站 in both Chinese scripts, "Site settings" / 站点设置 / 網站設定 for the settings page. Message keys, code, URLs (`/instance`) and the database keep `instance`.
- The host area is light only. Colours are tokens in `src/app/globals.css`, not literals in components.
- No new runtime dependency (`DropdownMenu` comes from the `radix-ui` package already in `package.json`). Nothing leaves the instance (ADR-0005).
- Commit only the files the change touches, staged by path. Never stage `CONTEXT.md`, `.claude/` or `.superpowers/`, and never `git add -A`, `git add .` or `git commit -a`. Never push or tag.
- Commit style: a subject of the form `<Area>: <what is now true, in plain words>`, a body saying what was missing and what changed, wrapped near 100 columns, and the trailers `Co-Authored-By: Claude <Model> 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_015A26bH9WbrYaMGBoHXvsaz`.
- Checks before reporting done: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the browser specs the ticket names plus any existing spec the change could affect, against the Docker test profile rebuilt with the change (`CI=1`). If `pnpm typecheck` reports missing next-intl keys that exist, delete `tsconfig.tsbuildinfo` and rerun.
- After the work, append a dated entry under `## Comments` in the ticket (the home page's tickets are the model), tick the boxes met, and set `**Status:** done` only when every box is ticked. Commit the ticket with the work: this tracker is in git.

## Review Focus

Inputs the spec implies but a ticket's tests could miss. Each line names the ticket that owns the test.

1. A host with many past events: on a phone the Past row scrolls sideways inside itself, the page does not, and Tab reaches every tile (ticket 03's browser test, ten past events).
2. An untitled draft with no date, and a long or all-Chinese title: the tile shows "Untitled event" and "No date yet", and a 60-character title wraps inside its tile at 390 px (ticket 01's unit test for the labels, ticket 03's browser test for the wrap).
3. An event whose poster is an upload: the tile shows that picture, at a thumbnail rendition, and an event whose upload is gone falls back as its event page does (ticket 03's browser test with an upload; `resolveTheme` with `null` already covers the fallback).
4. A co-host's dashboard: a co-hosted event can be Next up, its tile says Co-host, and its Guests button opens a page the co-host may see (ticket 03, through `co-hosts.spec.ts`).
5. A host at the event limit on a page other than the dashboard (Account): the header has no New event pill (ticket 02's browser test in `limits.spec.ts`).

---

## Task 1: The shelves, as pure rules

Ticket: `.scratch/dashboard/issues/01-shelves.md`. Model: Sonnet.

## Task 2: The frame of every signed-in page

Ticket: `.scratch/dashboard/issues/02-host-frame.md`. Model: Sonnet.

## Task 3: The dashboard as a shelf of invitations

Ticket: `.scratch/dashboard/issues/03-dashboard.md`. Model: Opus (the poster pieces are reused, not copied, and five specs that read the dashboard move to its new shape).

## Task 4: "Instance" becomes "site" in the interface

Ticket: `.scratch/dashboard/issues/04-site-wording.md`. Model: Sonnet.

## Task 5: Translations, accessibility, screenshot and docs

Ticket: `.scratch/dashboard/issues/05-final-pass.md`. Model: Opus (the full suite and the two Chinese scripts).
