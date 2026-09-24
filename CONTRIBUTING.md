# Contributing to OpenInvites

Thank you for helping. Bug reports, ideas, translations, templates, backgrounds, documentation and code are all welcome. Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). The project is written in English: issues, pull requests, commits and code comments.

## Setting up

Follow [Run it locally](README.md#run-it-locally) in the README: clone, `pnpm install`, `pnpm dev`. The development defaults are in the committed `.env.development`; put anything of your own in `.env.development.local`, which git ignores.

`pnpm dev` runs the Compose `dev` profile (Postgres 18 and Mailpit) and `next dev` on your machine. Every setting is an environment variable ([docs/operator/configuration.md](docs/operator/configuration.md)). To reset a host's password in development without mail:

```sh
node --env-file=.env.development scripts/reset-password.mjs host@example.org
```

## Running the checks

CI runs all of these on every push and pull request, and a release is published only when they pass.

| Command | What it checks |
| --- | --- |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | TypeScript, including that every message the code uses is in `messages/en.json`. If it names a message that is plainly there, delete `tsconfig.tsbuildinfo` and run it again. |
| `pnpm test` | The unit tests (Vitest): the pure rules, such as the event link slug, the headcount, time zones, calendar files, the theme and its legibility, and the translation files. Fast, and needs nothing running. |
| `pnpm test:s3` | The S3 storage smoke test, against a local S3-compatible server: start it first with `docker compose --profile s3 up -d --wait`. |
| `pnpm test:e2e` | The browser tests (Playwright), at a 390px phone width and at desktop width, against the production image. |

### Browser tests

Install Playwright's browser once: `pnpm exec playwright install chromium` (on Linux, `pnpm exec playwright install --with-deps chromium` also installs the libraries it needs).

- **The whole suite, as CI runs it:** `pnpm test:e2e` builds the production image, starts the Compose `test` profile (the app as an operator runs it, Postgres 18, and Mailpit), and runs every spec. The build takes a few minutes. Stop `next dev` first, since both use port 3000. Afterwards, `docker compose --profile test down -v` stops the stack and deletes its data.
- **While working on a spec:** with `pnpm dev` running, `pnpm exec playwright test e2e/rsvp.spec.ts` runs one spec against your development server. If the `test` profile's `app` is running, stop it first (`docker compose --profile test stop app`): it holds port 3000. `e2e/registration.spec.ts` and `e2e/registration-without-mail.spec.ts` run against instances of their own, the `test` profile's `app-fresh` and `app-no-mail`, so run them with the whole suite.

`pnpm perf` audits the event page's speed with Lighthouse's mobile profile against the production image and fails below 90. Scores depend on the machine, so it is not part of CI; see `perf/event-page.perf.ts`.

### How the tests are written

There are two kinds of test, and nothing in between:

- **Through the browser** (`e2e/*.spec.ts`): what a host, guest or operator can do and see, against the real app, a real Postgres and a fake mail server. Each test makes its own hosts and events through the product, as a person would (`e2e/hosts.ts`, `e2e/events.ts`).
- **Pure rules, called directly** (`src/**/*.test.ts`): functions that take values and return values, with no database or browser. Write the failing test first.

A test observes only what a person can observe. It never asserts on database rows, component internals, or the order of calls. Test output stays clean: no stray warnings.

## Contributing data: templates, backgrounds, translations

These need no application code, and each has a guide:

- [Templates](docs/contributing/templates.md): the shape of a template's data file, its name and blurb in every language, and the tests it must pass.
- [Curated backgrounds](docs/contributing/backgrounds.md): the shape, how a scene's file is named, and measuring a background with `pnpm measure:backgrounds`.
- [Translations](docs/contributing/translations.md): improving a language, and adding one.

The README's screenshots are taken with `pnpm screenshots` (`scripts/screenshots.ts`) against the Compose `test` profile, and written to `docs/screenshots/`. Take them again when the look changes.

## Issues and pull requests

- **Found a bug, or want something?** Open an issue with the bug or feature form. For a bug, say which version or image tag you run, how you deploy it, which browser, and the steps that show it. Please report security problems privately, through the repository's **Security** tab, not in a public issue.
- **Before a large change**, open an issue first to agree on the approach, so your work is not wasted. A typo, a translation fix, or a small bug fix can go straight to a pull request.
- **Pull requests** go against `main`, from a branch of your fork. Keep each to one change, include the tests that show it works, and make sure the checks above pass. Say in the description what changes for a host, guest or operator, and link the issue it closes. A maintainer reviews it, and may ask for changes before merging.
- **Words.** [`CONTEXT.md`](CONTEXT.md) is the glossary: use its words in code, interface text and tests, and not the ones it lists to avoid. Decisions that are hard to reverse are recorded in [`docs/adr/`](docs/adr/); a change that goes against one should say so and why.
- **Interface text** lives in `messages/`, never in code, in every language ([translations.md](docs/contributing/translations.md)).

## Commits

A commit's subject names the area and says, in plain prose, what a person can now do or what is now true:

```
RSVP sheet: its controls stay where the guest sees them while it grows and shrinks
Rate limits: an IPv6 client is its /64, and the counts never outgrow a fixed size
```

The body, a few sentences of prose, says what changed in behaviour and why, and anything a reviewer should know. Every commit ends with a sign-off (below).

## Sign your work: the Developer Certificate of Origin

OpenInvites uses the [Developer Certificate of Origin](https://developercertificate.org/) (DCO) instead of a contributor licence agreement. By signing off a commit you certify the DCO below for it: that you wrote it, or otherwise have the right to submit it under the project's licence. Contributions are accepted under the licence the project is under, `AGPL-3.0-or-later` ([LICENSE](LICENSE)).

Sign off each commit with `git commit -s`, which adds a line with the name and email from your git configuration:

```
Signed-off-by: Ada Lovelace <ada@example.org>
```

Use your real name, or the name you are known by, and an email address you can be reached at. A pull request is merged only when every commit in it is signed off. If you forgot one:

```sh
git commit --amend --signoff               # the last commit
git rebase --signoff main                  # every commit on your branch since main
git push --force-with-lease
```

The Developer Certificate of Origin, version 1.1:

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

## Where things are

```
src/app/            Next.js App Router pages and route handlers: (auth) is everything before
                    sign-in, (host) the signed-in host area, e/[slug] the public event page,
                    instance the operator's settings page
src/<module>/       The modules, each with its pure rules in plain .ts files beside their tests:
                    auth, calendar, events, instance, legal, locale, mail, questions, rate-limit,
                    rich-text, rsvps, sharing, storage, themes (templates in themes/templates),
                    uploads
src/components/ui/  shadcn/ui primitives, themed from the tokens in src/app/globals.css
src/lib/            Small shared types and helpers
src/db/             Drizzle client, schema, and the migrator run at start
messages/           Translation files, one per language
drizzle/            SQL migrations (pnpm db:generate after changing src/db/schema.ts)
public/             The curated scenes and the title fonts, named after their content
scripts/            Commands an operator runs inside the container, and the contributor tools
                    (measure-backgrounds.ts, screenshots.ts) that stay out of it
e2e/                Playwright browser tests
perf/               The event page's Lighthouse audit (pnpm perf)
deploy/             The deployment package: production Compose file, .env.example, Caddyfile,
                    and the smoke test the release workflow runs against a published image
docs/operator/      Operator documentation: installing, configuring, upgrading, backups
docs/contributing/  Guides to the data files: templates, backgrounds, translations
docs/releasing.md   How a release is cut and published
```

### Compose profiles

The `compose.yaml` at the root is for development and tests; an instance runs `deploy/compose.yaml`.

| Profile | Services | Use |
| --- | --- | --- |
| `dev` | `db`, `mail` | `pnpm dev` runs Next.js on your machine against them. |
| `test` | `app`, `app-social`, `app-fresh`, `app-no-mail`, `db`, `db-fresh`, `db-no-mail`, `mail` | The production image, exercised by the browser tests and CI. `app` (port 3000) has registration opened by the browser tests' operator before the other specs run, and rate limits low enough for a test to reach; each test sends an `X-Forwarded-For` address of its own (`e2e/test.ts`), as a reverse proxy would. `app-social` (3001) has dummy Google and GitHub credentials, an analytics snippet and legal pages of its own. `app-fresh` (3002) and `app-no-mail` (3003, without mail) run on databases of their own, for the registration specs. |
| `s3` | `s3` | A local S3-compatible server for `pnpm test:s3`. |

The `dev` and `test` profiles share the `db` and `mail` containers.
