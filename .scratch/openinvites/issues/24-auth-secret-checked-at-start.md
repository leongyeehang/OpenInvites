# 24: AUTH_SECRET checked at start

**What to build:** The app refuses to start when `AUTH_SECRET` is unset, blank, or shorter than 32 characters, as it already does for a missing `BASE_URL`. Today Better Auth falls back to its built-in default secret: in production it throws only on first use, and in development it signs sessions with that default without a word.

**Blocked by:** none (noted in ticket 19, listed in ticket 21's step 10)

**Status:** done

- [x] `src/instance/env.ts` gains `authSecret()`. It throws `AUTH_SECRET is not set` when the variable is unset or blank, and `AUTH_SECRET must be at least 32 characters` when it is shorter than 32 characters. Otherwise it returns the value exactly as given, untrimmed, so existing sessions stay valid. Neither message includes any part of the value.
- [x] `src/instrumentation.ts` calls `authSecret()` with the other start checks (`baseUrl()`, `mailConfig()`, …).
- [x] `src/auth/auth.ts` passes `secret: authSecret()` instead of reading `process.env.AUTH_SECRET` itself.
- [x] Unit tests cover unset, blank, 31 characters (refused), 32 characters (accepted, returned unchanged), and a refused value never appearing in the error message. Follow the pattern of `src/mail/config.test.ts`: a pure function over an env object, with the exported function reading `process.env`, or `vi.stubEnv`, whichever fits `env.ts` better.
- [x] Every secret the repository itself sets is still accepted: `.env.development`, every `AUTH_SECRET` in `compose.yaml`, `deploy/smoke-test.sh`'s `secret()`, and anything under `.github/`. Check each length; none should need changing.
- [x] `docs/operator/configuration.md` already calls `AUTH_SECRET` required and at least 32 characters. Add only that the instance refuses to start without it, if the guide says that for other settings. Do not rewrite the row otherwise.
- [x] Checked by hand once against `next dev`: with `AUTH_SECRET` unset, and with a 10-character value, the log shows the matching message and `/api/health` does not answer 200. Put what you saw in the report.

## Notes for the implementer

- `register()` in `instrumentation.ts` runs before any request is answered. A throw there is rethrown on every request, which is how `BASE_URL` already behaves.
- Commit subject in the repository's style, e.g. `Start: the instance refuses to start without an AUTH_SECRET of at least 32 characters`.

## Comments

**2026-10-02, implementing agent (M1 leftovers, task 3).** Done, every box ticked. Commit `bdcee82`. Lint, type check, 380 unit tests, and `e2e/host-accounts.spec.ts` pass.

- **`src/instance/env.ts`**: `authSecret()` throws `AUTH_SECRET is not set` when `process.env.AUTH_SECRET` is unset or blank (`!secret?.trim()`), `AUTH_SECRET must be at least 32 characters` when the value as given is shorter than 32 characters, and otherwise returns it untrimmed. Both messages are fixed strings, so none of the value is in them. A value of 31 characters plus a trailing space counts as 32, because the length is of what Better Auth would sign with.
- **`src/instrumentation.ts`**: `authSecret()` is called beside `baseUrl()` in the start checks.
- **`src/auth/auth.ts`**: `secret: authSecret()` replaces `process.env.AUTH_SECRET`. `createAuth()` still runs on first use, not at import, so `next build` is unaffected.
- **`src/instance/env.test.ts`**: new, with `vi.stubEnv` (`env.ts` reads `process.env` directly and has no env-object variant, unlike `mail/config.ts`). It covers unset, empty and blank, 31 characters refused, 32 accepted and returned unchanged, spaces around a 32-character secret kept, and the refusal message equal to the fixed string for a value that could have leaked into it.
- **Box 5, lengths** (counted in the shell): `.env.development` 50; `compose.yaml` 51 at each of its four `AUTH_SECRET` lines (27, 68, 121, 157); `deploy/smoke-test.sh` `secret()` is 32 random bytes as hex, 64; `deploy/compose.yaml` takes it from `.env` with `${AUTH_SECRET:?...}` and `deploy/.env.example` leaves it empty for the operator; nothing under `.github/` sets one. None needed changing.
- **Box 6, `docs/operator/configuration.md`**: no change. The guide says once, above the tables, that "a value the app cannot use keeps it from starting (it never reports healthy), and `docker compose logs app` names the variable", which a short or missing secret now meets. No row of the instance table repeats it, `BASE_URL`'s included, and the `AUTH_SECRET` row already says required and at least 32 characters.

Evidence:
- **RED**: `pnpm exec vitest run src/instance/env.test.ts` before `authSecret()` existed: 5 failed, `authSecret is not a function`.
- **GREEN**: the same command, 5 passed. Mutation checks, each failing exactly the test named for it: `.trim()` on the return (the spaces test), `< 31` (the 31-character test), `< 33` (the 32-character test), the value in the message (the message test), and no blank check (the unset or blank test). `pnpm lint`, `pnpm typecheck` (after deleting `tsconfig.tsbuildinfo`), and `pnpm test` (48 files, 380 tests) pass.
- **Hand check under `next dev`**: Next.js 16.3 reads `process.env` before `.env.development` (`environment-variables.md`, load order), so `.env.development` is not edited and the variable is overridden in the shell. `env AUTH_SECRET= pnpm exec next dev` logs `Error: An error occurred while loading instrumentation hook: AUTH_SECRET is not set` with the trace at `authSecret (src/instance/env.ts:16:30)` and `Module.register (src/instrumentation.ts:16:3)`. `env AUTH_SECRET=0123456789 pnpm exec next dev` logs the same with `AUTH_SECRET must be at least 32 characters`, and the 10 characters do not appear in the log. In both, `next dev` exits after the error, so `curl /api/health` got no answer (status 000, connection refused) rather than a 200. `env BASE_URL= pnpm exec next dev` does the same with `BASE_URL is not set`, so the behaviour matches. A truly unset variable cannot be shown under `next dev`, since `.env.development` would fill it in; unset and blank take the same line, and the unit tests cover both. With the normal dev profile, `/api/health` answered 200.
- **Browser**: `e2e/host-accounts.spec.ts` with `--workers=2 --grep-invert operator` on a fresh `next dev`: 21 passed (the operator setup included), so sign-in works with the secret passed through `authSecret()`. No failures, so no `--workers=1` rerun was needed.

**2026-10-02, controller.** The task review and the branch's final review (both Opus) approved `bdcee82`. **For the release that carries it:**
- Make it 0.2.0, not 0.1.1. A patch release moves `:0.1` and `:latest`, and the upgrade guide asks operators to read release notes only for a major or minor release.
- The release notes must say:
  - An `AUTH_SECRET` shorter than 32 characters now stops the app at start, and `docker compose logs app` shows `AUTH_SECRET must be at least 32 characters`.
  - Check the length before upgrading.
  - A new secret signs every host out and voids verification and reset links already sent.
- If that release also carries a migration, the notes must also say this: the start checks run after `runMigrations` (`src/instrumentation.ts`), so an upgrade refused for a short secret has already migrated the database.

**2026-10-07, implementing agent.** Released in 0.2.0, as the controller asked. `51453b1` sets `package.json` to `0.2.0`. The maintainer pushed tag `v0.2.0`, and its release run 37562606153 passed every stage: checks, the build, the smoke tests on amd64 and arm64, and the tag moves. On ghcr.io, `0.2.0`, `0.2` and `latest` point at the same image, `0.1` still at 0.1.0, and anonymous pulls work. The maintainer published the release notes (https://github.com/leongyeehang/OpenInvites/releases/tag/v0.2.0). They open with the `AUTH_SECRET` check: a shorter secret stops the app at start, with the message `docker compose logs app` shows; a command that prints the secret's length, to run before upgrading; and that a new secret signs every host out and voids links already sent. The release has no migration, so the note about migrations running before the start checks did not apply.
