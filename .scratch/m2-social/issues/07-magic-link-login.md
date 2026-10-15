# 07: Sign in with an emailed link

**What to build:** When the instance has mail, the sign-in page offers "Email me a sign-in link". The link signs an existing host in. It never creates an account.

**Blocked by:** none

**Status:** done

- [x] Better Auth's `magicLink` plugin (`better-auth/plugins`) is added to `createAuth()` only when mail is configured, with `disableSignUp: true`, `expiresIn: 900`, and `sendMagicLink` sending `Mail.magicLink` (subject "Your sign-in link for OpenInvites", body with the link and "valid for 15 minutes", in the request's locale, like the other auth emails in `src/auth/emails.ts`).
- [x] `limitsByEndpoint` counts `/sign-in/magic-link` as `["signIn", "mail"]`. The verify endpoint needs no limit (a token nobody can guess).
- [x] The sign-in page gains a second form under the password form, "Email me a sign-in link", with the email field and a button, shown only with mail. Submitting shows the same sentence whether or not the address has an account: "If an account exists here, we sent a sign-in link to {email}." The link lands on the dashboard; an expired or used link lands on the sign-in page with "That sign-in link has expired or was already used."
- [x] Browser tests (`e2e/magic-link.spec.ts`): a verified host asks for a link, Mailpit has it, opening it lands on the dashboard signed in; an unknown address shows the same sentence and Mailpit gets nothing; a link opened twice fails the second time with the message; the form is absent in the `registration-without-mail` setting (extend that spec or its fixture).
- [x] `docs/operator/configuration.md`, Mail: the list gains "a host can sign in with a link emailed to them".

## Notes for the implementer

- Read `node_modules/better-auth/dist/plugins/magic-link/` for the exact options of this version (1.7.x); the names above are its documented ones.
- The client side: `magicLinkClient()` on the auth client if one exists, else call the endpoint from a server action as the other forms do (`src/auth/actions.ts`).
- Commit subject, e.g. `Sign in: a host with mail can sign in through a link emailed to them`.

## Comments

**2026-10-08, implementing agent.** Done. `pnpm lint`, `pnpm typecheck`, `pnpm test` (453) pass; `e2e/magic-link.spec.ts` 9/9 (both viewports, plus the operator setup).

How it landed:
- `auth.ts`: `magicLink({ disableSignUp: true, expiresIn: 900, sendMagicLink: sendMagicLinkEmail })` only when mail is configured; `/sign-in/magic-link` counts `["signIn", "mail"]`. No migration (existing `verification` table).
- `emails.ts` `sendMagicLinkEmail`: the plugin sends to any address, so this looks the host up and sends nothing for an address with no account. `Mail.magicLink` in the request's locale, inline.
- `actions.ts` `requestSignInLink` (callbackURL = `nextPath(next)`, errorCallbackURL = `/sign-in?linkError=1&next=...`); `sign-in-link-form.tsx` under the social buttons, only with mail; the page shows "That sign-in link has expired or was already used." for `linkError`.
- Operator doc line added.

Decisions and things to know:
- The input label is "Send it to" and the button "Send me the link": a second field labelled "Email" would make every existing `getByLabel("Email")` on the sign-in page ambiguous.
- A rate-limit refusal shows the forms' usual sentence (errors.ts).
- The absent-without-mail test targets port 3003 by absolute URL, so it needs the Docker test profile's `app-no-mail` (or a stand-in on 3003).
- Unknown-address requests still create a (never-used) verification row; harmless.

Left for later tickets or noted:
- Ticket 15, strings least sure of: zh-Hans/zh-Hant "linkEmail" (发送到 / 寄送到), "linkSubmit" (给我发链接 / 寄連結給我), and the mail body's last sentence ("不会有人因此登录" / "不會有人因此登入").
- `e2e/registration.spec.ts` could not run here (needs :3002, Docker test profile): 1 failure from connection to nothing, 5 did not run; unrelated to this change.

Evidence:
- Browser, production build on :3000 (Compose dev profile, mail on). No-mail instance: a second standalone server on :3003 started with a preload script that deletes `SMTP_URL` and `MAIL_FROM` and sets `DATABASE_URL` to a fresh database `nomail_t7` (created and dropped through `docker compose exec db psql`). Docker test profile untouched. Both servers stopped afterwards.
- `host-accounts`, `rate-limits`, `co-hosts` (with `--grep-invert operator`): 49 passed.

**2026-10-08, implementing agent (fix round 1).** Review fix: sign-in links go only to verified hosts (the plugin would revoke an unverified host's password and logins and skip the operator seat); browser case added; `RATE_LIMIT_MAIL` doc row lists sign-in links. See `task-7-report.md`.
