# 10: Translations, accessibility, docs

**What to build:** The milestone's last pass: the Chinese strings reviewed, the keyboard, locale and reduced-motion specs extended to every new screen, the docs, the glossary proposals collected, the release note, and the full browser run.

**Blocked by:** 01 to 09

**Status:** ready-for-agent

- [ ] zh-Hans and zh-Hant: every key added in 01 to 09 read in context (the Invites page, the Settings sheet's Album group, the Schedule sheet, the locked page, the letter and schedule panels, the mails); the strings the implementers were least sure of listed in this ticket's comment for the maintainer.
- [ ] Keyboard rows: the Schedule sheet (add, remove, the radios, Done); the locked form (email, Send, the code, Send it again); Approve and Remove in the album viewer; the Invites page's Send, Send again, Share and the letter fields. Locale rows for each new screen in one Chinese script. Reduced motion: `expectStill` with a "Now" item and with the letter panel.
- [ ] Docs: `docs/operator/configuration.md` (the invitation, pass-code and photos mails among what mail sends; `RATE_LIMIT_MAIL`; the photos limit and pending photos); the host guide (invite-only and how guests get in, letters, album visibility and approval, the schedule and the freshness setting); the upgrade note.
- [ ] The glossary proposals from the spec (Invite list, Invite-only, Pass, Letter, Schedule, the widened Album) collected in one comment for the maintainer's `CONTEXT.md`; not edited here.
- [ ] `.scratch/m6-invited/release-note-0.6.0.md` drafted.
- [ ] The full browser suite on the Docker test profile rebuilt from the branch, `CI=1 pnpm exec playwright test --workers=2`, every project; the counts and any flake in the comment; `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes for the implementer

- CI fails on any flake (`failOnFlakyTests`): a row that passes only on retry is a bug in the wait, not in the app.
- Commit subject, e.g. `M6: translations, accessibility and docs`.

## Comments

### 2026-11-07 — Hardening batch (before 10)

The seventeen code-level minors the reviews of Tasks 1–9 deferred, in one commit. Unit evidence is
`pnpm test` (all green); browser evidence is the named specs on the Docker test profile rebuilt
from the tree, `CI=1 … --workers=2`.

1. Pass signed for its purpose — `src/invites/pass.ts` signs `pass:eventId:inviteId:expires`;
   `pass.test.ts` "is signed for its purpose" (an unprefixed signature reads as no pass).
2. Switch race — `saveRsvp` invites a new reply through no invite on an invite-only event under
   the lock (`invitesNewReply` in `src/invites/invite.ts`, unit-tested; `inviteFromRsvp`, fresh
   token, reply tied both ways, `MyRsvp.inviteToken` its token); comment above
   `inviteRepliedGuests` says so. No browser row: the race cannot be staged without timing.
3. `inviteRepliedGuests` inserts a thousand at a time (`chunks`) and ties replies back with one
   `UPDATE … FROM invite` naming no ids; covered by the 500-cap row of `invite-only.spec.ts`.
4. `MyRsvp` is a union that keeps one token at least; `planRsvp` carries the held tokens
   generically; `editLinkOf` no longer throws. `pnpm typecheck`; `plan.test.ts`, `guest.test.ts`.
5. Send on a deleted invite answers `Invites.errors.inviteGone` before the mail limit is spent
   (`src/invites/actions.ts`); `invites.spec.ts` paste row, Send from a stale tab.
6. A stopped invite's stop link (stopped through it or through the reply's link) shows "No email
   is on file" (`findInviteByMailToken`, `mailStopped`); `invites.spec.ts` stop rows for Mei and
   Ravi.
7. `listInvites` orders by `created_at` desc then id asc, so a paste keeps its order;
   `invites.spec.ts` paste row checks the three names in order.
8. "Add several" splits on `,` or `，`; `invite.test.ts` full-width row. Hint left as is.
9. The schedule's minute tick skips a refresh under 30 s after the last (`refreshDue` in
   `src/schedule/clock.ts`, unit-tested); `schedule.spec.ts` minute and reload rows green.
10. Thread schedule bubble on `bg-theme-glass`, named by its heading (`aria-labelledby`);
    `schedule.spec.ts` checks the named region; `accessibility.spec.ts` green.
11. A cancelled event shows no schedule (`scheduleFor`); `cancel-delete.spec.ts` row.
12. Approving one photo disables only its own Approve, in the grid and the viewer (`useOptimistic`
    set of ids in `album.tsx`); `album-settings.spec.ts` green. No row for two at once: timing.
13. Thumbnail Approve and Delete are named "Approve/Delete photo {n} by {name}" (new keys in all
    three locales); `album-settings.spec.ts` asserts the names.
14. Schedule and poll times are validated whole (`fieldTime` in `src/polls/poll.ts`; seconds still
    taken); `schedule.test.ts` and `poll.test.ts` "19:00junk" rows.
15. Null-token row in `invite-only.spec.ts`, through Dev's invite link (no email, so no code and no
    30-second resend wait): a third device changes his reply and keeps it on reload.
16. The page uses the gate's invite before asking `deviceInvite` again (`src/app/e/[slug]/page.tsx`).
17. `letterFor`'s comment moved onto the function; one line left on `Letter`.
