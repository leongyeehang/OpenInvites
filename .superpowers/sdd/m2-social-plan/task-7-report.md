# Task 7 report: sign in with an emailed link

Commit 25736c9 "Sign in: a host with mail can sign in through a link emailed to them".

Implemented as the ticket (see its dated comment for detail): magicLink plugin only with mail (disableSignUp, expiresIn 900); limit `["signIn","mail"]` on `/sign-in/magic-link`; `sendMagicLinkEmail` (Mail.magicLink, request locale, inline) that sends nothing for an address with no account (the plugin itself would mail any address); `requestSignInLink` server action honouring `next` via callbackURL; `SignInLinkForm` shown only with mail; `linkError` notice on the sign-in page; three translation files; operator doc line; `e2e/magic-link.spec.ts` (4 tests).

Tests: lint, typecheck, vitest 453 pass. Playwright (production build on :3000, mail on): magic-link 9/9; host-accounts + rate-limits + co-hosts 49 passed with `--grep-invert operator`. `registration.spec.ts` is a fresh-instance project on :3002 (Docker test profile), not running here: not verified. No-mail test ran against a second standalone server on :3003 started with SMTP_URL and MAIL_FROM deleted by a preload script and DATABASE_URL on a fresh database `nomail_t7` (dropped after); the main server on :3000 had mail. Docker test profile untouched; both servers stopped.

Self-review: no TDD RED (no pure rule added; limitsByEndpoint untested, skipped). Input label "Send it to" avoids ambiguity with existing `getByLabel("Email")`. Unknown-address requests leave an unused verification row. Chinese strings to review listed in the ticket comment.

## Fix round 1
`sendMagicLinkEmail` returns without sending unless the host exists and `emailVerified` (comment explains why); `RATE_LIMIT_MAIL` doc row lists sign-in links. New e2e case: unverified host asks, same sentence, mail count stays 1 (verification only), password still signs in, then verifies, asks again, link arrives and works.
Run (production build on :3000, mail on): `pnpm exec playwright test e2e/magic-link.spec.ts e2e/host-accounts.spec.ts --workers=2 --grep-invert operator --grep-invert "no sign-in link form"` gave 29 passed, 2 failed: the host-accounts operator-command test (needs `docker compose exec app`, Docker test profile; my second --grep-invert replaced the first), and the :3003 test was skipped (no no-mail server this round; it passed in the first round). The new unverified-host case is among the 29 passed (both viewports); a separate `--grep unverified` run matched nothing, as the title says "not verified". lint, typecheck, vitest 453 pass. Servers stopped.
