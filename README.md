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

Every setting is an environment variable. Development defaults live in the committed `.env.development`; put personal overrides in `.env.development.local`, which git ignores.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres 18 connection string. |
| `BASE_URL` | Public origin of the instance, such as `https://invites.example.org`. Links in emails start with it. |
| `AUTH_SECRET` | Long random string that signs sessions and email links. Changing it signs every host out. |
| `SMTP_URL` | SMTP server for outgoing mail, such as `smtp://user:pass@mail.example.org:587`. Unset means the instance has no mail: hosts are not asked to verify their email and password reset goes through the operator command below. |
| `MAIL_FROM` | Sender of outgoing mail, such as `OpenInvites <no-reply@example.org>`. Required when `SMTP_URL` is set. |
| `OPERATOR_CONTACT_EMAIL` | Shown to hosts when they need the operator, such as to reset a password on an instance without mail. |
| `OPERATOR_EMAIL` | The operator's own account. At every start, the account with this email, if it exists, becomes the operator in place of whoever was. This email may always sign up, whatever the registration mode, and its account is the operator the moment it is created. Optional: without it, the first account created on the instance is the operator. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth credentials for "Continue with Google". The button appears only when both are set. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | OAuth credentials for "Continue with GitHub". The button appears only when both are set. |

### The operator, registration, and host invitations

The first account created on a fresh instance is its operator; there is only ever one. The operator finds **Instance settings** in the header of the host area (`/instance`); for anyone else that address is a page that does not exist.

- **Registration** is Invitation only on a fresh instance: only someone holding a host invitation can create an account, by email, Google, or GitHub alike. Open lets anyone sign up. A change takes effect at once.
- **Host invitations** are single-use links the operator makes on the same page, optionally addressed to an email, which then fills in the sign-up form (anyone with the link can still use it). The link is shown once, to copy; with mail configured, the operator can have it emailed instead. A link works for one account and expires after 14 days, and can be revoked while it is pending. The page lists every invitation as Pending, Used, Revoked, or Expired.

If someone else created the first account before you did, set `OPERATOR_EMAIL` to your own address and restart: sign up with it (or, if the account exists, just sign in) and it is the operator. An instance upgraded from before there was an operator makes its earliest account the operator and starts Invitation only.

### Resetting a host's password

On an instance without mail, the operator resets a host's password from inside the container. It prints a temporary password to pass on; the host signs in with it and changes it in account settings.

```sh
docker compose exec app node scripts/reset-password.mjs host@example.org
```

In development: `node --env-file=.env.development scripts/reset-password.mjs host@example.org`.

### Google and GitHub sign-in

Set both variables for a provider to add its button to the sign-in and sign-up pages; either one left unset keeps the button off. Register the redirect URL built from `BASE_URL`:

| Provider | Where to create the OAuth client | Redirect URL to register |
| --- | --- | --- |
| Google | [Google Cloud Console](https://console.cloud.google.com/apis/credentials), OAuth client ID, type Web application | `{BASE_URL}/api/auth/callback/google` |
| GitHub | [GitHub Developer settings](https://github.com/settings/developers), New OAuth App | `{BASE_URL}/api/auth/callback/github` |

Put each client ID and secret in the matching environment variable above.

No automated test can sign in against the real providers, so verify by hand after configuring them:

1. Restart the instance and confirm both buttons appear on `/sign-in` and `/sign-up`.
2. Sign in with Google using an address that has not signed up before: a host is created and signed in, with no "verify your email" banner, and the display name matches the Google profile's name.
3. Sign in with GitHub the same way: the display name matches the GitHub profile's name, or the GitHub username when the profile has none.
4. Sign up with email and password using an address you also control on Google or GitHub with a verified email there, then sign in with that provider using the same address: it signs in to the same account rather than creating a second one. A provider address that does not match, or is not verified there, does not link.

## Compose profiles

| Profile | Services | Use |
| --- | --- | --- |
| `dev` | `db`, `mail` | `pnpm dev` runs Next.js on your machine against them. |
| `test` | `app`, `app-social`, `app-fresh`, `db`, `db-fresh`, `mail` | The image an operator will run, exercised by the browser tests and CI. `app` runs with registration open, which the browser tests' operator (`OPERATOR_EMAIL`) sets on the instance settings page before the other specs run. `app-social` is the same image with dummy Google and GitHub credentials, for the one spec that checks the social sign-in buttons. `app-fresh` (port 3002) is the same image on its own database, held in memory by `db-fresh`; `e2e/registration.spec.ts` recreates both before it runs, so the first account and the registration modes are tested on an instance nobody has used. |

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
src/lib/            Small shared types and helpers
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
