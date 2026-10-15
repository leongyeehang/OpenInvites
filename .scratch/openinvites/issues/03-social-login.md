# 03: Social login with Google and GitHub

**What to build:** Hosts can sign in with Google or GitHub, and the buttons for those providers exist only when the operator has configured them.

**Blocked by:** 02 Host accounts

**Status:** done

- [x] Google and GitHub are Better Auth providers enabled only when their client ID and secret are present in the environment; the sign-in and sign-up pages read the enabled set at request time.
- [x] A first-time social sign-in creates a host with the display name taken from the provider profile, editable afterwards.
- [x] Linking a social login to an existing email account follows Better Auth's safe default: only when the provider reports a verified email matching the account.
- [ ] A browser test asserts that the buttons are absent with no configuration and present with dummy configuration; sign-in against real Google and GitHub is verified manually and the steps are written into the operator documentation, including which environment variables to set and which redirect URLs to register.

  The browser-test half is done (`e2e/social-login.spec.ts`). The manual-verification half is not: I cannot sign in against real Google or GitHub from here, so this box stays unticked. The steps are written into README's "Google and GitHub sign-in" section for the maintainer to run.

## Comments

**2026-09-24, implementing agent.** Done except the manual-verification half of the fourth checkbox (see above). Lint, type check, 257 unit tests (10 new, covering the two pure rules this ticket added), and the full browser suite (162 tests: 81 scenarios at 390px and desktop, including the 2 new social-login ones) pass locally against the production image on the Compose `test` profile.

How it landed:

- `src/auth/providers.ts`: `socialProvidersFromEnv(env)` reads `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, enabling a provider only when both are set and non-blank (same shape as `mail/config.ts`'s `mailConfigFromEnv`). `enabledSocialProviders()` is what the sign-in and sign-up pages call at render time to decide which buttons to show; the browser never tells them.
- `src/auth/auth.ts` passes whichever providers are enabled into Better Auth's `socialProviders` option. Account linking is left at Better Auth 1.7.5's default (no `trustedProviders`, no `allowDifferentEmails`): reading `node_modules/.pnpm/@better-auth+core@.../oauth2/link-account.mjs`, an incoming provider account links to an existing host by matching email only when the provider reports that email verified (or the provider is in `trustedProviders`, which we never set) *and* the host's own email is already verified (`requireLocalEmailVerified`, default `true`). Nothing widens that.
- Display name: GitHub's own `getUserInfo` already falls back to the profile's `login` when it has no `name` (verified in `github.mjs`). `src/auth/display-name.ts` (`fallbackDisplayName`, unit tested) covers what's left — a provider with neither, such as Google without a profile name — by taking the part of the email before the `@`. It runs inside `databaseHooks.user.create.before` in `auth.ts`, so every new host gets it, not only social ones (a no-op for email/password sign-up, which already requires a name).
- Social sign-in itself is a server action (`signInSocial` in `src/auth/actions.ts`), matching how every other auth flow in this codebase works: no client-side Better Auth library. It calls `auth.api.signInSocial` and redirects the browser to the URL it returns. `src/app/(auth)/social-sign-in.tsx` renders one bound form per enabled provider on both `/sign-in` and `/sign-up`; it renders nothing when no provider is configured.
- Failed callbacks (declined consent, refused linking, etc.) come back to `/sign-in?socialError=1` with a generic message, rather than Better Auth's default `{BASE_URL}/error`, which this app does not have a page for.
- Browser test: `compose.yaml` gained a second `test`-profile container, `app-social`, same image as `app` on port 3001 with dummy Google and GitHub credentials. `app` (port 3000) already has neither configured, so it covers the buttons-absent case; `app-social` covers buttons-present. `e2e/social-login.spec.ts` only checks button presence/absence — it never calls Google or GitHub.
- Operator docs: README's Configuration table gained the four environment variables, and a new "Google and GitHub sign-in" subsection gives the exact redirect URLs (`{BASE_URL}/api/auth/callback/google` and `.../github`) and the manual-verification steps referenced above.
- No database migration: ticket 02's `account` table already carries every column Better Auth's OAuth flow needs (`providerId`, `accountId`, `accessToken`, `refreshToken`, `idToken`, token expiries, `scope`), and `user.image` already exists for the provider's avatar.

For ticket 04: `databaseHooks.user.create.before` in `src/auth/auth.ts` is the one place every new host is created, whichever method they used. Returning `false` from that `before` hook refuses the sign-up (Better Auth's contract: `before` may return `boolean | void | { data: ... }`); this ticket adds no such gating itself, so the hook currently only fixes up the display name.

Left for later tickets or noted:

- Manual verification against real Google and GitHub, and the account-linking scenario, are unverified here (see the fourth checkbox above and README's steps).
- Chinese strings for the new buttons are ticket 20, same as the rest of the auth screens.
