# 08: Passkeys

**What to build:** A host can add passkeys to their account, sign in with one, and remove them.

**Blocked by:** nothing (independent of the redesign)

**Status:** ready-for-agent

- [ ] Better Auth's passkey plugin, its table by migration; relying party id the host of `BASE_URL`, name the instance name.
- [ ] Account settings: a Passkeys card listing each (name, created, last used) with Rename and Remove, and "Add a passkey". Not shown, with one explaining line, when the instance is on plain HTTP other than `localhost`.
- [ ] Sign-in page: "Sign in with a passkey", and `autocomplete="username webauthn"` on the email field for conditional UI.
- [ ] Email and password stay; removing the last passkey is allowed.
- [ ] `docs/operator/configuration.md`: passkeys need HTTPS and a stable `BASE_URL`; changing the domain strands them.
- [ ] Browser (Playwright's CDP virtual authenticator): add a passkey, sign out, sign in with it; remove it and sign-in with it fails; keyboard and accessibility rows for the card and the button.

## Notes for the implementer

- Check Better Auth's version in `package.json` against its passkey docs before wiring.
- Commit subject, e.g. `Accounts: hosts can sign in with a passkey`.
