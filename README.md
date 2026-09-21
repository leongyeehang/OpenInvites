# OpenInvites

An open source, self-hostable service where a host creates an event page and shares its link, and guests respond without needing an account. OpenInvites is the working name until the first public release.

This repository is at the walking-skeleton stage: the application runs, migrates its own database, reports health, and speaks English, Simplified Chinese, and Traditional Chinese. Features arrive ticket by ticket under `.scratch/openinvites/issues/`.

## Run it locally

You need Node.js 22, pnpm (`corepack enable` gives you the pinned version), and Docker with Compose.

```sh
git clone git@github.com:leongyeehang/OpenInvites.git && cd OpenInvites
pnpm install
pnpm dev
```

`pnpm dev` starts Postgres 18 through the Compose `dev` profile, waits for it to be healthy, then starts Next.js. Migrations run before the server takes its first request. Open <http://localhost:3000>.

- Home page: <http://localhost:3000>
- Health, ready only when the database answers: <http://localhost:3000/api/health>

Stop the database with `docker compose --profile dev down` (add `-v` to drop its data).

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

## Compose profiles

| Profile | Services | Use |
| --- | --- | --- |
| `dev` | `db` | `pnpm dev` runs Next.js on your machine against it. |
| `test` | `app`, `db`, `mail` | The image an operator will run, exercised by the browser tests and CI. |

## Layout

```
src/app/            Next.js App Router pages and route handlers
src/components/ui/  shadcn/ui primitives, themed from the tokens in src/app/globals.css
src/db/             Drizzle client, schema, and the migrator run at start
src/locale/         Locale resolution, translation loading, language switcher
messages/           Translation files, one per locale
drizzle/            SQL migrations
e2e/                Playwright browser tests
```

Vocabulary is in `CONTEXT.md`; hard-to-reverse choices are in `docs/adr/`. The software sends nothing to the project or to any third party (ADR-0005).

## Licence

AGPL-3.0. The licence text lands before the repository goes public.
