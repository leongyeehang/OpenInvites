# Task 5 report: Co-hosts (ticket 05)

**Status:** DONE_WITH_CONCERNS (concerns are small and listed at the end; every box is ticked)

**Commit:** `e060ae0` Co-hosts: a host shares an event's management through a co-host link (one commit: the gate change and the feature share the schema and `hostedBy`, so they did not split cleanly).

## What I implemented

- **Schema, migration 0018** (`drizzle/0018_co_hosts.sql`): `event_host` (event cascade, host cascade, `added_at`, PK on both, index on `host_id`) and `co_host_link` (modelled on `host_invitation`; `event_id` cascade + index; `used_by_id` → user, `ON DELETE SET NULL`).
- **`src/hosts/`**: `role.ts` (`ACTIONS`, `Role`, `can`, `roleOf`), `co-host-link.ts` (7-day expiry, state, cap of 10, token gen/hash/url), `repository.ts` (`hostedBy` SQL condition, memberships, links, `acceptCoHostLink` in one locked transaction), `actions.ts` (make/revoke link, remove co-host, leave, accept). Unit tests for `role` and `co-host-link`.
- **The gate**: `findHostEvent` returns `HostEvent = Event & { role }` via `hostedBy`; `listHostEvents` returns owned + co-hosted with role. Repository writes use `hostedBy` (delete stays owner-only). Every event action calls the gate and `can(role, action)`: edit, publish, cancel, delete, resetLink, design (theme, alt text, upload route), guests (edit/remove guest), announcements (post/delete), manageCoHosts. Refusals answer as for another host's event.
- **Proxy**: `/co-host/:path*` matcher, counts against `signIn`, not-found for a never-made link, `/events/…/hosts` in the pattern.
- **`eventHosts`**: query only — owner first, then co-hosts by `added_at` (union all).
- **Pages**: `/events/[id]/hosts` (owner view; co-host sees only Leave with confirmation); `/co-host/[token]` (owner / existing co-host / used-revoked-expired / signed out with sign-in link and account sentence by registration mode / Accept); manage page badge, owner-only Hosts button, `DangerZone` `deletable` with a "Leave this event" link for co-hosts; dashboard badge; event page "Hosted by" via `format.list` and `isHost` for every host (draft preview, Design drawer, redraw exemption).
- **Sign-in `next`**: `src/auth/next-path.ts` (`nextPath`, unit tested); sign-in page, form (hidden field), `signIn` action, and social buttons (`callbackURL`).
- **Messages** (all three languages): `Hosts`, `CoHostLink`, `Events.manage.{hosts,coHost,leave}`, `Host.dashboard.coHost`, `EventPage.hostedBy` takes `{hosts}`, `Account.delete.confirmDescription`, and the controller's neutral `Mail.rsvpReply.*.changed` ("{name}’s RSVP to {title} is now {status}").
- **Docs**: `RATE_LIMIT_SIGN_IN` row names the co-host link.
- **Specs**: new `e2e/co-hosts.spec.ts` (6 tests × 2 widths); `notifications.spec.ts` follows the neutral wording; `events.spec.ts` "mistyped" covers `/hosts`; `e2e/events.ts` `createPublished` also returns the host's `name`.

## TDD evidence

RED (no modules): `pnpm exec vitest run src/hosts src/auth/next-path.test.ts` → `Cannot find module './role'` / `'./co-host-link'` / `'./next-path'`.

RED (wrong stubs), same command:
```
 FAIL  src/auth/next-path.test.ts > nextPath > sends anything else to the dashboard, so the sign-in never leads off the instance
AssertionError: "": expected '' to be '/dashboard' // Object.is equality
 FAIL  src/hosts/co-host-link.test.ts > coHostLinkExpiry > is seven days after the link was made
AssertionError: expected 2026-10-07T10:00:00.000Z to deeply equal 2026-10-14T10:00:00.000Z
 FAIL  src/hosts/co-host-link.test.ts > coHostLinkState > works once: used, it stays used, however long ago
AssertionError: expected 'pending' to be 'used' // Object.is equality
 FAIL  src/hosts/role.test.ts > can > lets a co-host do everything but delete the event or manage its co-hosts
AssertionError: expected [ 'edit', 'publish', 'cancel', …(10) ] to deeply equal [ 'edit', 'publish', 'cancel', …(8) ]
 ...
 Test Files  3 failed (3)
      Tests  9 failed | 3 passed (12)
```
GREEN, same command: `Test Files 3 passed (3) / Tests 12 passed (12)`. Then `pnpm test`: 57 files, 437 passed.

Mutation checks on `nextPath` (each clause removed fails one case): `//elsewhere.example`, `/\elsewhere.example`, `/\telsewhere.example`.

## Tests run and results

- `pnpm lint`: clean. `pnpm typecheck` (after `rm -f tsconfig.tsbuildinfo`): clean. `pnpm test`: 57 files, 437 passed (Vite's existing `configLoader` warning only).
- **Browser, production build loop every time** (`pnpm build`; `node --env-file=.env.development .next/standalone/server.js` on :3000 with `drizzle`, `public`, `.next/static` symlinked; Compose dev profile). `next dev` was not used.
  - `co-hosts.spec.ts`: 13/13 (first run failed only on an ambiguous `getByLabel`, fixed to the textbox role).
  - Definitive on committed source: `co-hosts, events, host-accounts, announcements, guest-list` → **75 passed (2.7 min)** with `--grep-invert "command inside the container"` (the operator password-reset test needs the Compose `app` container, absent in this loop; it failed 2/2 for that reason only in an earlier run). `design, uploads, notifications, cancel-delete` → **35 passed (1.5 min)**. `rate-limits, locales, poster, accessibility` → **49 passed (4.0 min)**.
  - `social-login.spec.ts`: 3/3 against the same build served on :3001 with `app-social`'s environment. A throwaway spec there showed the social sign-in with `next=/co-host/abc` reaches Google (stubbed) and Better Auth's stored state has `callbackURL: "/co-host/abc"`.
  - Server log: only the known pre-existing `The destination stream closed early.` and Better Auth warnings from wrong-password tests.
- **Browser mutation checks** (one rebuild, four independent mutations, then restored byte for byte and rebuilt): delete without `can` + `deleteEvent` scoped with `hostedBy` → delete test fails (event gone after co-host replay); `eventHosts` limited to owner → first and remove tests fail; `signIn` ignoring `next` → sign-in test lands on `/dashboard`; proxy pattern without `/hosts` → mistyped test gets the empty `__next_error__` shell.
- Strings rendered with next-intl `createTranslator`/`createFormatter` in en, zh-Hans, zh-Hant; screens checked by eye at 390px and desktop.

## Files changed

New: `drizzle/0018_co_hosts.sql`, `drizzle/meta/0018_snapshot.json`, `e2e/co-hosts.spec.ts`, `src/hosts/{role,role.test,co-host-link,co-host-link.test,repository,actions}.ts`, `src/auth/next-path{,.test}.ts`, `src/app/(host)/events/[id]/hosts/{page,co-host-link-form}.tsx`, `src/app/co-host/[token]/{page,accept-form}.tsx`.

Modified: `drizzle/meta/_journal.json`, `docs/operator/configuration.md`, `e2e/{events.spec,events,notifications.spec}.ts`, `messages/{en,zh-Hans,zh-Hant}.json`, `src/db/schema.ts`, `src/events/{repository,actions,hosts}.ts`, `src/uploads/{repository,actions}.ts`, `src/themes/{actions,poster-layout}.ts(x)`, `src/rsvps/actions.ts`, `src/announcements/actions.ts`, `src/app/api/events/[id]/upload/route.ts`, `src/proxy.ts`, `src/auth/actions.ts`, `src/app/(auth)/{sign-in/page,sign-in/sign-in-form,social-sign-in}.tsx`, `src/app/(host)/{dashboard/page,events/[id]/page,events/danger-zone}.tsx`, `src/app/e/[slug]/page.tsx`.

Not staged (as instructed): the ticket file (ticked, status done, dated comment), `CONTEXT.md`, `.scratch/openinvites/decisions.md`.

## Self-review findings (fixed before commit)

- `next-intl` does not type ICU arguments here, so the `full` message's `{max}` was missing in two `t()` calls; both now pass `MAX_CO_HOSTS`.
- An unknown token posted to the accept action returned the "expired" message; it now answers `notFound()`, like its page.
- A trailing unused parameter on `createCoHostLinkAction` (lint warning) was removed.
- `revokeCoHostLink` first had a malformed null check; it uses `isNull` on `used_at` and `revoked_at`.
- The browser replay helper now drops headers that are absent instead of sending `undefined`.
- The operator guide's sign-in limit row now names the co-host link, as the sign-up row names host invitation links.

## Concerns

1. **The ticket's "the sign-in page notes…"** is met on the co-host link page (shown to the signed-out visitor beside the sign-in button), per the controller's decision; the sign-in page itself only gained `next`.
2. **Reaching "Leave"**: the ticket hides the Hosts button from co-hosts and puts Leave on the hosts page, so co-hosts get a "Leave this event" link in the manage page's danger zone (where the owner has Delete). The hosts page's co-host view also has a one-sentence intro above the button.
3. **Copy co-hosts make inaccurate, not in this ticket**: `EventPage.draftBanner` ("Only you can see this page…") and `Events.manage.draftHint` ("Only you can open the link…") are now seen by co-hosts. Noted for ticket 15.
4. **Sign-up does not carry `next`**: someone who creates an account from a co-host link reopens the link by hand (the page says so).
5. **No verification gate on accepting** a co-host link (verification gates creating events only).
6. `src/app/e/[slug]/page.tsx` remains a busy file; this change adds `hostsOf`, `isHostOf` and one prop.

Workspace: nothing listens on :3000/:3001, the Compose dev containers are stopped, the build symlinks are removed.

---

# Fix report, round 1

**Status:** DONE. **Commit:** `8dfc880` Co-hosts: a host verifies their email before accepting a co-host link (new commit; `e060ae0` not amended).

## What changed

1. **Controller ruling: verification before accepting.** On an instance with mail, a signed-in host whose email is not verified (`hostNeedsVerification`, the create-event gate's rule) sees on `/co-host/<token>`, instead of Accept: "Before you accept, open the link we sent to {email}. Then open this co-host link again." and the existing `ResendVerificationForm` ("Resend email"). `acceptCoHostLinkAction` refuses such a host with the same sentence before it touches the link. Without mail, nothing changes. New keys `CoHostLink.verify` and `CoHostLink.resend` in en, zh-Hans and zh-Hant.
2. **Reviewer finding: lock order.** `acceptCoHostLink` (`src/hosts/repository.ts`) now reads the link's `event_id` unlocked, locks the event row (`FOR NO KEY UPDATE`), then the link row (`FOR UPDATE`): the order `removeEvents` takes them. An event deleted meanwhile (or its link gone with it) answers undefined, which the action answers with not-found. All other checks are unchanged.
3. **Spec** (`e2e/co-hosts.spec.ts`): hosts who accept now sign up verified; the signed-out test verifies its host before signing out; new test "a host who has not verified their email is asked to before accepting" (unverified `signUp`, sentence + Resend, no Accept, verify through Mailpit, reopen, accept).

## Covering tests

Command (production-build loop: `pnpm build`, `node --env-file=.env.development .next/standalone/server.js` on :3000, Compose dev profile):

```
pnpm exec playwright test e2e/co-hosts.spec.ts e2e/host-accounts.spec.ts --workers=2 --grep-invert "command inside the container"
```

Output (co-hosts lines and the total; host-accounts' 20 tests all passed too):

```
✓   3 [mobile] › e2e/co-hosts.spec.ts:92:5 › a co-host has no Delete, and a direct post of the delete action is refused (8.1s)
✓   2 [mobile] › e2e/co-hosts.spec.ts:38:5 › a host accepts a co-host link, sees the event on their dashboard, edits it, and the page names both hosts (10.9s)
✓   4 [mobile] › e2e/co-hosts.spec.ts:138:5 › a co-host leaves the event, and it is gone from their dashboard (5.9s)
✓   5 [mobile] › e2e/co-hosts.spec.ts:160:5 › the owner removes a co-host (5.2s)
✓   6 [mobile] › e2e/co-hosts.spec.ts:181:5 › a revoked co-host link says so, and one that was never made is not found (4.6s)
✓   7 [mobile] › e2e/co-hosts.spec.ts:198:5 › a co-host link opened signed out goes through sign-in and back (5.8s)
✓   8 [mobile] › e2e/co-hosts.spec.ts:228:5 › a host who has not verified their email is asked to before accepting (5.3s)
✓  20 [desktop] › e2e/co-hosts.spec.ts:92:5 › a co-host has no Delete, and a direct post of the delete action is refused (6.9s)
✓  19 [desktop] › e2e/co-hosts.spec.ts:38:5 › a host accepts a co-host link, sees the event on their dashboard, edits it, and the page names both hosts (9.0s)
✓  21 [desktop] › e2e/co-hosts.spec.ts:138:5 › a co-host leaves the event, and it is gone from their dashboard (6.5s)
✓  22 [desktop] › e2e/co-hosts.spec.ts:160:5 › the owner removes a co-host (6.4s)
✓  23 [desktop] › e2e/co-hosts.spec.ts:181:5 › a revoked co-host link says so, and one that was never made is not found (5.8s)
✓  24 [desktop] › e2e/co-hosts.spec.ts:198:5 › a co-host link opened signed out goes through sign-in and back (6.2s)
✓  25 [desktop] › e2e/co-hosts.spec.ts:228:5 › a host who has not verified their email is asked to before accepting (4.4s)
35 passed (1.1m)
```

Static checks on the committed source: `pnpm lint` clean; `pnpm typecheck` clean (after `rm -f tsconfig.tsbuildinfo`); `pnpm test` 57 files, 437 passed. Server log clean.

**The action's refusal, by hand** (throwaway spec, deleted): a verified host's Accept post was caught with `page.route` and aborted, then replayed from an unverified host's browser. Output: `STATUS 200 REFUSED true REDIRECT none`. The unverified host's dashboard stayed empty, and the verified host could still accept the same link afterwards.

**Mutation checks** (one rebuild, both gates made to answer "verified" with `hostNeedsVerification({ emailVerified: true })`, then restored byte for byte and rebuilt before the run above):
- new test: `✘ … a host who has not verified their email is asked to before accepting`, failing at `expect(page.getByText("Before you accept, open the link we sent to … Then open this co-host link again.")).toBeVisible()`;
- throwaway replay: `STATUS 200 REFUSED false REDIRECT /events/01a11598-…;push`, and its empty-dashboard check failed.

(My first mutation attempt used `&& false`, which broke type narrowing so the build failed; I stopped that run and used the type-safe form. A `pkill -f` while cleaning up matched its own shell, as the memory note warns. Files were restored from saved copies and checked with `cmp`.)

## Concerns

None new. The lock-order change has no test of its own, as instructed: the accept cases above pass on it.

Workspace: nothing listens on :3000 or :3001, the dev containers are stopped, the build symlinks are removed.
