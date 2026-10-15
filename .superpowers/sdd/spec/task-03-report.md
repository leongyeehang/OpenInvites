# Task 03 report: Social login with Google and GitHub

**Status:** DONE_WITH_CONCERNS (the only gap is the manual verification against real Google/GitHub, which the ruling says to leave to the maintainer)

**Commit:** `3b572de` Social login: hosts sign in with Google or GitHub once the operator sets their keys

## What I implemented

Checkboxes 1-3 in `.scratch/openinvites/issues/03-social-login.md` are ticked; checkbox 4 is left unticked because its manual-verification half cannot be done from here (see "Concerns"). The ticket file's `## Comments` entry dated 2026-09-24 has the full hand-off, matched here.

1. **Request-time provider enablement.** `src/auth/providers.ts` is the small module the ruling asked for: `socialProvidersFromEnv(env)` reads `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` and enables a provider only when both are set and non-blank — same shape as the existing `mail/config.ts`'s `mailConfigFromEnv`, which the codebase already established as the pattern for "is X configured" pure rules. `enabledSocialProviders()` is what `src/app/(auth)/sign-in/page.tsx` and `sign-up/page.tsx` call when they render (server components, at request time); the browser never supplies this list. `src/auth/auth.ts` passes the same config into Better Auth's `socialProviders` option, spreading in only the providers that are non-null.
2. **First-time social sign-in and display name.** Better Auth's own OAuth path creates the host (`emailVerified` taken directly from the provider's claim, so a verified Google/GitHub email is never re-asked to verify). For the name: GitHub's own `getUserInfo` (read in `node_modules/.pnpm/.../@better-auth/core/dist/social-providers/github.mjs`) already falls back to `profile.login` when the profile has no `name`. `src/auth/display-name.ts` (`fallbackDisplayName`, unit tested) covers what Better Auth does not: any profile with no name at all (e.g. Google without one) falls back to the part of the email before the `@`. It runs inside a new `databaseHooks.user.create.before` hook in `auth.ts`, so it applies to every new host — email/password included, where it is a no-op since the sign-up form already requires a name. Editable afterwards: unchanged, ticket 02's account settings page already does this.
3. **Account linking.** Left at Better Auth 1.7.5's own default — no `trustedProviders`, no `allowDifferentEmails`, no `disableImplicitLinking`. Read `oauth2/link-account.mjs`'s `handleOAuthUserInfo` directly to confirm the exact rule the safe default enforces: an incoming provider account links to an existing host by matching email only when (a) the provider reports that email verified (or the provider id is in `trustedProviders`, which is never set here) **and** (b) the host's own email is already verified (`requireLocalEmailVerified`, default `true`). Both conditions must hold, so an attacker who pre-registers an unverified account at a victim's email cannot have the victim's OAuth identity linked into it.
4. **Browsers test for the buttons.** Per the ruling, `compose.yaml` gained a second `test`-profile container, `app-social`: same image as `app`, dummy Google/GitHub credentials, on port 3001. `app` (port 3000) already has neither configured, so it covers the "absent" case without a third container. `e2e/social-login.spec.ts` checks button presence/absence by role name on both `/sign-in` and `/sign-up`, at both viewports; it never calls Google or GitHub. Manual verification of real sign-in is written into README's new "Google and GitHub sign-in" subsection (exact redirect URLs built from `BASE_URL`, and the steps to check display name, no re-verification banner, and account linking against real providers).

Also: `signInSocial` (a new server action in `src/auth/actions.ts`) follows the codebase's existing convention — every other auth flow is a server action over `getAuth().api.*`, never a client-side Better Auth library — calling `auth.api.signInSocial` and redirecting the browser to the URL it returns. `src/app/(auth)/social-sign-in.tsx` renders one bound form per enabled provider (`signInSocial.bind(null, provider)`), used by both pages, translated per screen (`Auth.signIn.*` / `Auth.signUp.*`, duplicated per the codebase's translation convention rather than shared). A failed OAuth callback (declined consent, refused linking, etc.) redirects to `/sign-in?socialError=1` with a generic message, rather than Better Auth's default `{BASE_URL}/error`, which this app has no page for.

No database migration was needed: ticket 02's `account` table already carries every column Better Auth's OAuth flow writes (`providerId`, `accountId`, `accessToken`, `refreshToken`, `idToken`, both token-expiry columns, `scope`), and `user.image` already exists for the provider's avatar.

## TDD evidence (pure rules)

Both new pure rules were test-first. Commands run from `/home/leong/rsvp`.

**`pnpm test -- src/auth/providers.test.ts src/auth/display-name.test.ts`**

RED (files did not exist yet):
```
 RUN  v5.0.1 /home/leong/rsvp

 ❯ src/auth/providers.test.ts (0 test)
 ❯ src/auth/display-name.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/auth/display-name.test.ts [ src/auth/display-name.test.ts ]
Error: Cannot find module './display-name' imported from /home/leong/rsvp/src/auth/display-name.test.ts

 FAIL  src/auth/providers.test.ts [ src/auth/providers.test.ts ]
Error: Cannot find module './providers' imported from /home/leong/rsvp/src/auth/providers.test.ts

 Test Files  2 failed | 31 passed (33)
      Tests  247 passed (247)
```

GREEN (after writing `src/auth/providers.ts` and `src/auth/display-name.ts`):
```
 RUN  v5.0.1 /home/leong/rsvp

 Test Files  33 passed (33)
      Tests  257 passed (257)
```

`providers.test.ts` covers: neither provider configured, each provider gated on *both* variables (id alone, secret alone, both), blank/whitespace treated as unset, both providers independently enabled, and `enabledSocialProviders` filtering/ordering. `display-name.test.ts` covers: an existing name kept as-is, `undefined`/`null`/empty/whitespace-only name all falling back to the email's local part, and a real name with surrounding whitespace trimmed rather than falling back.

**Full unit suite:** `pnpm test` gives `Test Files 33 passed (33)`, `Tests 257 passed (257)` (247 before this ticket, +10). Only pre-existing warning (the Vite `configLoader` one from `vitest.config.ts`, noted by ticket 11).

## Definitive browser run (Compose test profile)

1. Port 3000 was already free (no dev server running).
2. `docker compose --profile test up -d --build --wait` exited 0: both `openinvites-app-1` and the new `openinvites-app-social-1` reported `Healthy` (image build included, both share cached layers of the same Dockerfile).
3. Sanity check before the suite: `curl` against both `http://localhost:3000/sign-in` and `:3001/sign-in` returned 200; the RSC flight-data payload for port 3000 resolved the `SocialSignIn` slot to `null` (component returned nothing, as expected with no providers configured) — a first grep for the button text was a false positive from next-intl serializing the whole `Auth.signIn`/`Auth.signUp` namespace into the client payload for the "use client" `SignInForm`/`SignUpForm`, not from an actually-rendered button.
4. `pnpm exec playwright test` (full suite, not just the new spec) exited 0: **`162 passed (2.3m)`**, 81 scenarios at 390px and desktop (160 before this ticket, plus the 2 new `social-login.spec.ts` scenarios). Nothing flaky, no retries.
   - `e2e/social-login.spec.ts`: 2 scenarios × 2 projects = 4 tests, all passed — buttons absent on `app` (port 3000), present on `app-social` (port 3001), for both `/sign-in` and `/sign-up`.
5. Afterwards: `docker compose --profile test down` (no `-v`, so the database volume was kept). Port 3000 confirmed free, no containers left running — the next ticket's `pnpm dev` brings `dev`/`mail`/`db` back up as needed.

Also run: `pnpm lint` clean; `pnpm typecheck` clean (after `rm -f tsconfig.tsbuildinfo`, per the known-stale-tsbuildinfo note, since `messages/en.json` changed).

## Files changed

- Added:
  - `src/auth/providers.ts`, `src/auth/providers.test.ts`
  - `src/auth/display-name.ts`, `src/auth/display-name.test.ts`
  - `src/app/(auth)/social-sign-in.tsx`
  - `e2e/social-login.spec.ts`
- Modified:
  - `src/auth/auth.ts` (socialProviders wiring, databaseHooks.user.create.before)
  - `src/auth/actions.ts` (new `signInSocial` action)
  - `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx` (render `SocialSignIn`; sign-in page also handles `?socialError=1`)
  - `src/app/api/auth/[...all]/route.ts` (comment only — no longer says the callback is future work)
  - `messages/en.json` (`Auth.signIn.*` and `Auth.signUp.*`: `orContinueWith`, `continueWithGoogle`, `continueWithGithub`; `Auth.signIn.socialError`)
  - `compose.yaml` (new `app-social` service in the `test` profile)
  - `README.md` (Configuration table rows, new "Google and GitHub sign-in" subsection, Compose profiles table)
- Ticket file updated but not staged, as instructed: `.scratch/openinvites/issues/03-social-login.md`. Not touched: `CONTEXT.md`, `.scratch/openinvites/decisions.md`.

## Self-review

- **Ruling compliance:**
  - Request-time configuration: exact env var names used (`GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET`), read through a small function in the Auth module (I chose `src/auth/providers.ts` over `src/instance/env.ts`, matching the existing precedent that a module owns its own "is X configured" pure rule — see `src/mail/config.ts`). Pages ask the Auth module, never the browser.
  - Single hook for ticket 04: `databaseHooks.user.create.before` in `auth.ts`, with an explicit comment describing what ticket 04 does with it, and this ticket adds no gating.
  - Account linking: Better Auth's safe default, unmodified, verified by reading the actual linking logic rather than assuming.
  - Display name: provider profile name, GitHub-login fallback (built into Better Auth), email-local-part fallback for the rest — editable afterwards, unchanged from ticket 02.
  - Browser test: second Compose container with dummy credentials, on another port, buttons-only assertions, no real provider calls.
  - Operator documentation: README's Configuration section, exact redirect URLs built from `BASE_URL`.
  - Manual verification: said plainly in the ticket comment and here; steps listed in README for the maintainer.
- **Glossary:** "host", "sign in", "provider" (matches CONTEXT.md's existing vocabulary; no new terms introduced that needed a glossary entry).
- **Tests observe only what a person can observe:** button presence/absence by accessible role and name, at both viewports. No database assertions, no mocking of Better Auth internals.
- **Scope:** every changed line traces to this ticket. I did not touch `emailAndPassword`, mail, or the account-settings flows from ticket 02 beyond what was needed to wire in the hook.
- **What I would still question:**
  - `errorCallbackURL: "/sign-in?socialError=1"` with one generic message for every OAuth failure code is a small addition beyond the ticket's literal checkboxes, but without it a failed callback (including the "refused to link" case central to checkbox 3) would 404 on Better Auth's default `{BASE_URL}/error`. I judged a plain fallback destination in scope; a per-error-code message was not, and is left generic on purpose.
  - I did not add provider icons (no brand SVGs in the codebase yet); buttons are plain-text "Continue with Google"/"Continue with GitHub", consistent with the rest of the auth UI's minimal style.

## Concerns

1. **Manual verification against real Google and GitHub is unverified here** (checkbox 4, second half). I cannot obtain real OAuth credentials or complete a real consent screen from this environment. README's new "Google and GitHub sign-in" subsection lists the exact steps (restart with real keys, sign in as a new address on each provider, check display name and no verification banner, then check account linking against an address that exists both as email/password and on a provider). This also means checkboxes 2 and 3 are implemented and unit-tested where they are pure rules, and verified by reading Better Auth's actual source for where they are not, but have not been exercised end-to-end against a real provider.
2. **`app-social`'s dummy credentials never trigger a real OAuth handshake** in the test suite (by design — the ruling is explicit that tests never call Google or GitHub), so the new browser test only proves the buttons render/don't render, not that a real handshake succeeds. This is the same limitation as #1, restated at the test level.

No glossary or decisions-log change seems needed.
