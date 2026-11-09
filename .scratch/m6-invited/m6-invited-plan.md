# M6, invited guests and the day: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Each task's requirements are its ticket; the steps are the ticket's checkboxes.

**Goal:** a host can make an event invite-only, write a letter to each invited person and email the invitation; choose who sees the album and approve photos; and list the day's schedule, which the event page follows by the clock.

**Architecture:** One per-request gate (`src/invites/gate.ts`) decides whether a viewer is in, from the session, the RSVP cookie, the invite cookie and a signed pass cookie; the page and every slug-loading action and route ask it. The invite list is the one list of invited people. The album's rules split seeing from adding and photos carry a status. The schedule is a child table saved as a whole, with pure clock rules a client panel applies.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind 4 + shadcn/ui, Drizzle on Postgres 18, Better Auth, next-intl, Radix (`radix-ui`), nodemailer, Playwright, Vitest. No new runtime dependency.

**Spec:** `.scratch/m6-invited/spec.md`. Each task's requirements are its ticket under `.scratch/m6-invited/issues/`. The ticket binds for its task, the spec binds where the ticket is silent, and the dashboard, home page, M4, M3, M2 and M1 specs, in that order, bind where both are silent.

Branch: `m6-invited`, off `main` at be16712, in the main checkout. Tasks run one at a time, in order; 01–02 (schedule) and 03–04 (album) are independent of 05–09 (invites) and may be reordered among themselves.

## Global Constraints

- This is Next.js 16 with breaking changes. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. `src/proxy.ts` is what older Next.js called middleware. `cookies().set` works only in Server Functions and Route Handlers, never in a page.
- `docs/contributing/` and the M4 tickets under `.scratch/m4-extras/issues/` are the model for how the repository works (sources of truth, the testing seams, the Compose test profile, the browser test loop).
- Node 22 and pnpm are in `~/.local/opt/node/bin`, which is not on PATH. Prefix commands with `PATH=$HOME/.local/opt/node/bin:$PATH`.
- Never kill `next-server` by name: it also kills the Docker test app mid-run. Start a dev server on a port of its own and stop it by that port.
- Match the surrounding code: its comment density and voice (plain full sentences that say what a thing is for, citing the spec or a ticket where existing comments do), naming and idioms. Use `CONTEXT.md`'s words in code, and this spec's glossary proposals for the new ones. Touch only what the ticket needs.
- Two testing seams only: the browser (Playwright against the real app, real Postgres, Mailpit) and pure rules called directly (Vitest). A test observes what a visitor, host or operator can observe. Test first where the logic is a pure rule. Browser tests use the real clock for what the page shows; `page.clock` only to run an interval forward.
- Every interface string lives in `messages/en.json`, and every key added there is added, translated, to `zh-Hans.json` and `zh-Hant.json`, so that `translations.test.ts` stays green at every commit. A client component reads only namespaces its page passes (`client-messages.test.ts`).
- In the interface, "site" never "instance"; the host area is light only; colours are tokens in `src/app/globals.css`, not literals in components. The event page always shows its theme; the locked page shows no theme.
- Migrations take the next free number in `drizzle/` when the ticket starts (`pnpm db:generate`, then the repo's leading comment), and `docker compose --profile test up -d --build --wait` rebuilds the test app after a schema change.
- No new runtime dependency. Nothing leaves the instance (ADR-0005). Mail is plain text through the outbox, and every guest mail carries its stop link.
- Commit only the files the change touches, staged by path. Never stage `CONTEXT.md`, `.claude/` or `.superpowers/`, and never `git add -A`, `git add .` or `git commit -a`. Never push or tag.
- Commit style: a subject of the form `<Area>: <what is now true, in plain words>`, a body saying what was missing and what changed, wrapped near 100 columns, and the trailers the session's attribution reminder gives (for example `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
- Checks before reporting done: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the browser specs the ticket names plus any existing spec the change could affect, against the Docker test profile rebuilt with the change (`CI=1`, `--workers=2` on this two-core machine; the full suite takes over an hour and is ticket 10's). If `pnpm typecheck` reports missing next-intl keys that exist, delete `tsconfig.tsbuildinfo` and rerun.
- After the work, append a dated entry under `## Comments` in the ticket (the dashboard's tickets are the model: how it landed, decisions and things to know, what is left for later tickets, evidence), tick the boxes met, and set `**Status:** done` only when every box is ticked. Commit the ticket with the work: this tracker is in git.

## Review Focus

Inputs the spec implies but a ticket's tests could miss. Each line names the ticket that owns the test.

1. A guest who replied before invite-only was switched on and gave an email: on their next visit they are asked for a code, and after it their reply shows as theirs with its edit link working (ticket 08).
2. A host deletes an invite whose guest holds a pass: the next request finds no invite, the pass is void and the page locks (ticket 07).
3. An invite-only event that is still a date poll: the locked page applies and voting is refused to an outsider (ticket 07, the gated poll action).
4. A letter in Chinese with line breaks: kept in the email and on the Thread layout's bubble (tickets 06 and 09).
5. Album under "Only the hosts" with approval on: the guest's pending photo shows to them as awaiting approval; once approved, still only the hosts and that guest see it (ticket 03).
6. A multi-day event with an item the day before the event's start: day headings show, and the live window starts at that item (ticket 02).
7. Invite-only switched on at the 500-invite cap: the replied guests still get invites (ticket 08).
8. Reduced motion with a "Now" item on screen: nothing animates; axe on greyed items reads the muted token's contrast (ticket 02).
9. The Settings sheet saved while letters are on: `letters_enabled` is untouched, since it is not part of the sheet's form (ticket 05).
10. An outsider asks for a code with an email that is on the list of a different event: nothing is sent, the neutral sentence shows (ticket 07).

---

## Task 1: The host lists the day's timed items

Ticket: `.scratch/m6-invited/issues/01-schedule-sheet.md`. Model: Opus 5.5.

## Task 2: The event page follows the clock

Ticket: `.scratch/m6-invited/issues/02-schedule-panel.md`. Model: Opus 5.5.

## Task 3: The host chooses who sees the album, and may approve photos

Ticket: `.scratch/m6-invited/issues/03-album-visibility-approval.md`. Model: Opus 5.5.

## Task 4: The hosts are emailed when photos wait

Ticket: `.scratch/m6-invited/issues/04-album-notify.md`. Model: Opus 5.5.

## Task 5: A phone, a letter and a pasted list for each invite

Ticket: `.scratch/m6-invited/issues/05-invite-list.md`. Model: Opus 5.5.

## Task 6: The invitation email and a Share button

Ticket: `.scratch/m6-invited/issues/06-invitation-mail.md`. Model: Opus 5.5.

## Task 7: An invite-only event opens only to a device with a pass

Ticket: `.scratch/m6-invited/issues/07-invite-only-pass.md`. Model: Opus 5.5 (the riskiest ticket: every slug loader is gated).

## Task 8: Turning invite-only on invites everyone who replied

Ticket: `.scratch/m6-invited/issues/08-invite-only-switch.md`. Model: Opus 5.5.

## Task 9: A personal letter on the guest's invitation

Ticket: `.scratch/m6-invited/issues/09-letter-panel.md`. Model: Opus 5.5.

## Task 10: Translations, accessibility, docs

Ticket: `.scratch/m6-invited/issues/10-final-pass.md`. Model: Opus 5.5 (the full suite and the two Chinese scripts).
