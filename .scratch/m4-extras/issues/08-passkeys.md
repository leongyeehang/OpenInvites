# 08: Passkeys

**What to build:** A host can add passkeys to their account, sign in with one, and remove them.

**Blocked by:** nothing (independent of the redesign)

**Status:** done

- [x] Better Auth's passkey plugin, its table by migration; relying party id the host of `BASE_URL`, name the instance name.
- [x] Account settings: a Passkeys card listing each (name, created, last used) with Rename and Remove, and "Add a passkey". Not shown, with one explaining line, when the instance is on plain HTTP other than `localhost`.
- [x] Sign-in page: "Sign in with a passkey", and `autocomplete="username webauthn"` on the email field for conditional UI.
- [x] Email and password stay; removing the last passkey is allowed.
- [x] `docs/operator/configuration.md`: passkeys need HTTPS and a stable `BASE_URL`; changing the domain strands them.
- [x] Browser (Playwright's CDP virtual authenticator): add a passkey, sign out, sign in with it; remove it and sign-in with it fails; keyboard and accessibility rows for the card and the button.

## Notes for the implementer

- Check Better Auth's version in `package.json` against its passkey docs before wiring.
- Commit subject, e.g. `Accounts: hosts can sign in with a passkey`.

## Comments

**2026-11-03, implementing agent (Opus, in the maintainer's session).** Done.

- `@better-auth/passkey@1.7.5`, pinned to the installed `better-auth` (1.7.5), whose passkey docs it matches. `drizzle/0038_passkeys.sql`: the plugin's `passkey` table with uuid ids, cascading from the user, plus our `last_used_at`, set by the plugin's `authentication.afterVerification` hook.
- `auth/auth.ts`: the plugin only where a browser offers passkeys (`auth/passkeys.ts`, `passkeysAvailable`: HTTPS, or HTTP on localhost, 127.0.0.1, ::1 or `*.localhost`); relying party id the host name of `BASE_URL`, origin its origin, name "OpenInvites" (the instance has no name setting; the product name is what every page and email already uses). `/passkey/verify-authentication` counts against the sign-in limit; asking for a challenge does not, since the sign-in page asks for one as it opens.
- Browser half: `auth/passkey-client.ts`, Better Auth's plain client with the plugin's `passkeyClient()`, used for adding a passkey and signing in. Renaming and removing are server actions (`renamePasskeyAction`, `removePasskeyAction`, scoped to the host, `auth/passkey-store.ts`).
- Account page: a Passkeys card listing each (name, added, last used or "Not used to sign in yet") with Rename (inline form) and Remove (confirmed), and "Add a passkey" (named "Passkey {n}" until renamed). On plain HTTP elsewhere, the card is one line saying passkeys need HTTPS. Removing the last is allowed.
- Sign-in page: "Sign in with a passkey", and `autocomplete="username webauthn"` on the email field with a conditional request started as the page opens, so the browser offers passkeys in the field.
- Messages `Auth.signIn.passkey*` and `Account.passkeys.*` in all three languages; `docs/operator/configuration.md` has a Passkeys section (HTTPS, a stable `BASE_URL`, a new domain strands them) and the sign-in limit's row names passkeys.
- Tests that clicked `name: "Sign in"` now say `exact: true`, since the passkey button also starts with "Sign in".

Browser: `e2e/passkeys.spec.ts` with Chromium's virtual authenticator: add, rename (kept across a reload), sign in through the email field's offer, sign in by keyboard with the button (the offer switched off for that part), "Last used", remove after a confirmation, and the removed passkey refused; axe on the account page and the sign-in page. Against the test profile: passkeys 3 passed; the specs that sign in or touch the account (`accessibility`, `co-hosts`, `host-accounts`, `instance-settings`, `magic-link`, `rate-limits`, `registration`, `registration-without-mail`, `social-login`, `turnstile`, `keyboard`, `legal-and-analytics`) 187 passed, 1 flaky (`turnstile.spec.ts:174` on desktop, waiting for the email code's line on the Broadsheet, which this change does not touch; passed on retry). `pnpm test` 808 passed (77 files).

