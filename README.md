# OpenInvites

An open source, self-hostable service where a host creates an event page and shares its link, and guests respond without needing an account. OpenInvites is the working name until the first public release.

The application runs, migrates its own database, reports health, speaks English, Simplified Chinese, and Traditional Chinese, and lets a person become a host: sign up with email and password, verify their email, sign in on several devices, manage their account, and delete it. The host account screens are English only until the translation pass. Features arrive ticket by ticket under `.scratch/openinvites/issues/`.

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
| `pnpm test` | Vitest unit tests for pure rules, such as locale resolution. |
| `pnpm test:e2e` | Builds the production image, starts the `test` profile (app, Postgres 18, [Mailpit](https://mailpit.axllent.org/) as a fake mail server), then runs Playwright at a 390px phone width and at desktop width against it. |

After browser tests, `docker compose --profile test down -v` stops the stack.

Also useful: `pnpm lint`, `pnpm typecheck`, and `pnpm db:generate` after changing `src/db/schema.ts` (migrations live in `drizzle/` and are applied automatically at start).

## Configuration

Every setting is an environment variable. Development defaults live in the committed `.env.development`; put personal overrides in `.env.development.local`, which git ignores.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres 18 connection string. |
| `BASE_URL` | Public origin of the instance, such as `https://invites.example.org`. Links in emails start with it. |
| `AUTH_SECRET` | Long random string that signs sessions and email links. Changing it signs every host out. |
| `SMTP_URL` | SMTP server for outgoing mail, such as `smtp://user:pass@mail.example.org:587`. Unset means the instance has no mail: hosts are not asked to verify their email and password reset goes through the operator command below. |
| `MAIL_FROM` | Sender of outgoing mail, such as `OpenInvites <no-reply@example.org>`. Required when `SMTP_URL` is set. |
| `OPERATOR_CONTACT_EMAIL` | Shown to hosts when they need the operator, such as to reset a password on an instance without mail. |

### Resetting a host's password

On an instance without mail, the operator resets a host's password from inside the container. It prints a temporary password to pass on; the host signs in with it and changes it in account settings.

```sh
docker compose exec app node scripts/reset-password.mjs host@example.org
```

In development: `node --env-file=.env.development scripts/reset-password.mjs host@example.org`.

## Compose profiles

| Profile | Services | Use |
| --- | --- | --- |
| `dev` | `db`, `mail` | `pnpm dev` runs Next.js on your machine against them. |
| `test` | `app`, `db`, `mail` | The image an operator will run, exercised by the browser tests and CI. |

## Layout

```
src/app/            Next.js App Router pages and route handlers; (auth) is everything before
                    sign-in, (host) is the signed-in host area
src/auth/           Auth module: Better Auth instance, session helpers, server actions, emails
src/components/ui/  shadcn/ui primitives, themed from the tokens in src/app/globals.css
src/db/             Drizzle client, schema, and the migrator run at start
src/instance/       Instance-wide settings read from the environment
src/locale/         Locale resolution, translation loading, language switcher
src/mail/           Mail module: SMTP configuration and sending
messages/           Translation files, one per locale
drizzle/            SQL migrations
scripts/            Commands an operator runs inside the container
e2e/                Playwright browser tests
```

Vocabulary is in `CONTEXT.md`; hard-to-reverse choices are in `docs/adr/`. The software sends nothing to the project or to any third party (ADR-0005).

## Licence

AGPL-3.0. The licence text lands before the repository goes public.
