# 01: Walking skeleton

**What to build:** A running OpenInvites application with nothing in it but the foundations every later ticket lands on: a home page saying the instance is up, shown in the viewer's language, backed by a Postgres 18 database that migrates itself at start, with both test suites running in CI against the same containers an operator will run. No AI or external model API is integrated, now or later in M1.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `pnpm dev` runs the app against Postgres 18 started by a Compose development profile, with the stack from ADR-0002: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Drizzle, Better Auth installed but unused.
- [x] Migrations run automatically at container start before the server accepts requests; a health endpoint reports ready only when the database is reachable.
- [x] Design tokens (colour, spacing, type scale, radius) are defined once as CSS variables using the design-system skill; shadcn/ui primitives are installed and themed from them.
- [x] Three locales (English, Simplified Chinese, Traditional Chinese) are wired: locale from a cookie, else the browser's language header, else English; a switcher sets the cookie and the choice survives reload; every visible string on the home page comes from translation files. Locale is never part of the URL.
- [x] Vitest runs one unit test; Playwright runs one browser test at 390px and desktop widths against the app on a Compose test profile with the app, Postgres, and a fake mail server.
- [x] A GitHub organisation `openinvites` and a private repository `openinvites/openinvites` exist (human step, use the wizard skill), the code is pushed, and GitHub Actions runs lint, type check, and both suites green on every push and pull request.
- [x] README explains how to run locally in three commands.
- [x] Nothing is sent to any third party (ADR-0005); the dependency list contains no AI or model client.

## Comments

**2026-09-21, implementing agent.** Done. Lint, type check, 9 unit tests, and 6 browser tests (3 scenarios at 390px and desktop) pass locally against the production image on the Compose `test` profile, and in GitHub Actions: run 35564367758 on the first push was green in 2m36s.

The GitHub step landed differently from the ticket text: the maintainer created `leongyeehang/OpenInvites` under their personal account rather than `openinvites/openinvites`, and chose to make it public from the first push to hold the name (recorded in `decisions.md`). The `openinvites` organisation was still free; the repo can be transferred into it later. Commits: 19f7778 (skeleton), f77e504 (review follow-up), plus the README clone URL.
