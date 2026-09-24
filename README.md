# OpenInvites

An open source, self-hostable service where a host creates an event page and shares its link, and guests respond without needing an account. OpenInvites is the working name until the first public release.

The application runs, migrates its own database, reports health, speaks English, Simplified Chinese, and Traditional Chinese, and lets a person become a host: sign up with email and password, verify their email, sign in on several devices, manage their account, and delete it. A host creates an event, saves it as a draft, publishes it, and shares a link to a bare event page; the themed look arrives next. The host screens are English only until the translation pass. Features arrive ticket by ticket under `.scratch/openinvites/issues/`.

## Run it locally

You need Node.js 22, pnpm (`corepack enable` gives you the pinned version), and Docker with Compose.

```sh
git clone git@github.com:leongyeehang/OpenInvites.git && cd OpenInvites
pnpm install
pnpm dev
```

`pnpm dev` starts Postgres 18 and [Mailpit](https://mailpit.axllent.org/) (a fake mail server that catches every email the app sends) through the Compose `dev` profile, waits for them to be healthy, then starts Next.js. Migrations run before the server takes its first request. Open <http://localhost:3000>.

- Home page: <http://localhost:3000>
- Mail the app sent, such as verification links: <http://localhost:8025>
- Health, ready only when the database answers: <http://localhost:3000/api/health>

Stop the containers with `docker compose --profile dev down` (add `-v` to drop the database).

## Tests

Two seams, and nothing in between:

| Command | What it runs |
| --- | --- |
| `pnpm test` | Vitest unit tests for pure rules, such as locale resolution, the event link slug, and time zones. |
| `pnpm test:e2e` | Builds the production image, starts the `test` profile (app, Postgres 18, [Mailpit](https://mailpit.axllent.org/) as a fake mail server), then runs Playwright at a 390px phone width and at desktop width against it. |

After browser tests, `docker compose --profile test down -v` stops the stack.

Also useful: `pnpm lint`, `pnpm typecheck`, and `pnpm db:generate` after changing `src/db/schema.ts` (migrations live in `drizzle/` and are applied automatically at start).

## Configuration

Every setting is an environment variable. Running an instance is covered by the operator documentation in `docs/operator/`, and the deployment package it describes (a production Compose file with a pinned Postgres 18 and Caddy for automatic HTTPS, an `.env.example` listing every variable, and a `Caddyfile`) is in `deploy/`:

- [Installing an instance](docs/operator/install.md): from a fresh machine to a running instance, and the first account, which becomes the operator.
- [Configuring an instance](docs/operator/configuration.md): every variable, including mail, Google and GitHub sign-in, S3 storage, rate limits, the legal pages, and the operator's `OPERATOR_EMAIL`.
- [Upgrading, backups, and operations](docs/operator/upgrade-backup.md): upgrades, backup and restore, and the password reset command.

Images are published by CI on each release tag ([docs/releasing.md](docs/releasing.md)).

In development, the defaults live in the committed `.env.development`; put personal overrides in `.env.development.local`, which git ignores. The password reset command runs against the development database with `node --env-file=.env.development scripts/reset-password.mjs host@example.org`.

## Compose profiles

The `compose.yaml` at the root is for development and tests; an instance runs `deploy/compose.yaml`.

| Profile | Services | Use |
| --- | --- | --- |
| `dev` | `db`, `mail` | `pnpm dev` runs Next.js on your machine against them. |
| `test` | `app`, `app-social`, `app-fresh`, `app-no-mail`, `db`, `db-fresh`, `db-no-mail`, `mail` | The image an operator will run, exercised by the browser tests and CI. `app` runs with registration open, which the browser tests' operator (`OPERATOR_EMAIL`) sets on the instance settings page before the other specs run, and with rate limits low enough for a test to reach (`.env.development` sets the same); each test sends an `X-Forwarded-For` address of its own (`e2e/test.ts`), as a reverse proxy would, so none uses up another's allowance. `app-social` is the same image with dummy Google and GitHub credentials, for the one spec that checks the social sign-in buttons, and with an analytics snippet and legal pages of the operator's own (one from the environment, one from `e2e/legal/terms.md` mounted as a file). `app-fresh` (port 3002) is the same image on its own database, held in memory by `db-fresh`; `e2e/registration.spec.ts` recreates both before it runs, so the first account and the registration modes are tested on an instance nobody has used. `app-no-mail` (port 3003, on `db-no-mail`) is the same again without mail, for `e2e/registration-without-mail.spec.ts`. |

## Layout

```
src/app/            Next.js App Router pages and route handlers; (auth) is everything before
                    sign-in, (host) is the signed-in host area, e/[slug] is the public event page,
                    instance is the operator's settings page
src/auth/           Auth module: Better Auth instance, session helpers, server actions, emails
src/components/ui/  shadcn/ui primitives, themed from the tokens in src/app/globals.css
src/db/             Drizzle client, schema, and the migrator run at start
src/events/         Events module: slug, time rules, form rules, repository, server actions
src/instance/       The instance: settings from the environment and the database, the operator,
                    the registration mode, and host invitations
src/legal/          The privacy policy and terms of use: the operator's Markdown or the placeholders
src/lib/            Small shared types and helpers
src/locale/         Locale resolution, translation loading, language switcher
src/mail/           Mail module: SMTP configuration and sending
src/rate-limit/     RateLimit module: the client address, the limits, and their in-memory counts
messages/           Translation files, one per locale
drizzle/            SQL migrations
scripts/            Commands an operator runs inside the container
e2e/                Playwright browser tests
deploy/             The deployment package: production Compose file, .env.example, Caddyfile,
                    and the smoke test the release workflow runs against a published image
docs/operator/      Operator documentation: installing, configuring, upgrading, backups
```

Vocabulary is in `CONTEXT.md`; hard-to-reverse choices are in `docs/adr/`. The software sends nothing to the project or to any third party (ADR-0005).

## Licence

AGPL-3.0. The licence text lands before the repository goes public.
