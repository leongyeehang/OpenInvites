# Task 19 report: Deployment package

**Status:** DONE_WITH_CONCERNS. Five of the six checkboxes are ticked. The last one ("published image on a clean machine; verified once on arm64 hardware") stays unticked, as ruled: nothing is published yet, and there is no arm64 hardware or QEMU here.

**Commit:** `d63b44c` Deployment package: an operator goes from a fresh machine to a running instance with the documentation alone

## What I implemented

### `deploy/`, the production package

- **`compose.yaml`**, project name `openinvites-instance`. It must not share the root file's `openinvites` project: `down -v` there would delete the dev/test volumes.
  - `app`: image from `OPENINVITES_IMAGE` (default `ghcr.io/leongyeehang/openinvites:latest`), `env_file: .env`, `restart: unless-stopped`.
  - The app is published on `127.0.0.1:${APP_PORT:-3000}` only, with a comment saying why.
  - The `uploads` volume is mounted at `/app/uploads`.
  - A health check on `/api/health` is declared explicitly, the same as the image's.
  - `BASE_URL`, `AUTH_SECRET` and `POSTGRES_PASSWORD` are required with `${VAR:?Set VAR in .env}`. `DATABASE_URL` is built from `POSTGRES_PASSWORD`.
  - `db`: `postgres:18.6-alpine`, the newest 18 minor (checked on Docker Hub: 18.5 was never tagged, 18.7 does not exist). It has the `db-data` volume at `/var/lib/postgresql`, a `pg_isready` health check, and no published port.
  - `caddy`: `caddy:2.11-alpine`, behind the `caddy` profile. `.env.example` turns it on with `COMPOSE_PROFILES=caddy`; Compose reads that from `.env`, which I checked. It has the `caddy-data` and `caddy-config` volumes and mounts the `Caddyfile`.
  - **Caddy uses `network_mode: host`.** Through Docker's port forwarding, an IPv6 visitor reaches a container on an IPv4-only Compose network as the gateway address, so all IPv6 visitors would share one rate-limit allowance. On the host network Caddy sees real addresses and reaches the app on the loopback. The same Caddyfile also works for a Caddy installed on the machine.
- **`.env.example`**: every variable the app reads, plus the four Compose-level ones, in groups:
  - Compose
  - the instance
  - mail
  - Google and GitHub
  - uploaded pictures
  - rate limits
  - legal pages
  - analytics

  Each variable has a comment, its default and, where useful, an example. A commented-out line holds only the default, or nothing when there is none. The required values are left empty, so Compose refuses to start until they are filled in.
- **`Caddyfile`**:
  - The site address is `{$BASE_URL}`, so the app and the certificate share one source.
  - It proxies to `127.0.0.1:{$APP_PORT:3000}`.
  - A commented `trusted_proxies` block is there for a CDN. Its placeholder makes Caddy refuse to start until real ranges replace it; I checked both cases with `caddy validate`.
- **`smoke-test.sh`**:
  - Takes an image, copies `compose.yaml` into a `mktemp` directory with a `.env` holding only the required values (no Caddy, `APP_PORT=0` for a random loopback port), and starts it in its own Compose project with `up --wait --wait-timeout 180`.
  - On failure it prints `ps` and the logs.
  - Checks: `/api/health` through the published port, uid ≠ 0, `require("sharp")` loading inside the container (this catches a missing arm64 binary), and the reset command answering "No host has the email ...".
  - A trap runs `down --volumes` whether it passes or fails.

### Operator documentation, `docs/operator/`

- **`install.md`**:
  - What you need.
  - Getting the three files with `curl`.
  - The four values to fill in.
  - `docker compose up -d --wait`.
  - Checking `/api/health`.
  - The first account becomes the operator, so sign up before telling anyone the address.
  - What runs where, and why the app's port stays on the loopback.
  - Using your own reverse proxy, including `X-Forwarded-For` for nginx.
  - Trying it locally with `TRUSTED_PROXY_HOPS=0`.
- **`configuration.md`**: every variable in the same groups as `.env.example`. It also covers:
  - `.env` quoting rules, which I checked empirically.
  - That `restart` does not re-read `.env`; `up -d` does.
  - The operator, registration and host invitation section and the `OPERATOR_EMAIL` procedure, both moved from README. It adds the squatter recovery with a session purge (see concerns).
  - SMTP: the URL forms and percent-encoding.
  - Google and GitHub: moved from README, with the manual verification steps.
  - S3: path-style requests, the IAM policy with `s3:ListBucket` and why it is needed, the private bucket, provider endpoints, and moving from local storage.
  - Rate limits: a table of all seven, and `TRUSTED_PROXY_HOPS` with the CDN case.
  - Legal pages through a `compose.override.yaml` mount.
  - Analytics in single quotes.
  - The variables the image sets.
  - The mail limit shared by emailed host invitations is stated in two places.
- **`upgrade-backup.md`**:
  - Upgrading: pull, then `up -d --wait`. Migrations run themselves. A table of what each tag pin gets.
  - Backups: what to keep, and the `pg_dump` plus `tar` commands.
  - Restore steps.
  - The password reset command and its output.
  - Running notes: health, logs, one app container, the orphaned picture files that nothing sweeps (with how to find them), and `psql`.
- **`docs/releasing.md`** (a maintainer note):
  - What a tag does.
  - The secrets and variables: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets; `DOCKERHUB_NAMESPACE` and `IMAGE_NAME` as optional variables.
  - Making the GHCR package public after the first push.
  - How to cut a release.
- **README**: the Configuration section is now a short paragraph with links to the three guides and the release note. The dev `.env.development` note and the dev reset command stay. The operator, reset and Google/GitHub sections moved out. There is one line saying the root `compose.yaml` is for dev and test, and the Layout block gains `deploy/` and `docs/operator/`. README keeps its one-line-paragraph style.

### CI

- **`ci.yml`**: gains `workflow_call`, and `push` is now `branches: ["**"]`, so a tag push no longer runs the suite twice.
- **`release.yml`**, on `v*.*.*`:
  1. `checks`: `uses: ./.github/workflows/ci.yml`.
  2. `publish` (`needs: checks`, `packages: write`):
     - checkout, then an "Image names" step that lowercases the names with bash `${,,}`;
     - `setup-qemu-action@v3` and `setup-buildx-action@v3`;
     - `login-action@v3` for GHCR (`GITHUB_TOKEN`) and Docker Hub (the two secrets);
     - `metadata-action@v5` with `flavor: latest=false`. Tags: `{{version}}`, `{{major}}.{{minor}}`, `{{major}}` (not for `v0.*`), and `latest` (not when the tag contains `-`). Label overrides are there because metadata-action would otherwise write empty licence and description labels while the repository has no LICENSE;
     - `build-push-action@v6` for `linux/amd64,linux/arm64`, pushing to both registries, with the GHA cache.
  3. `smoke-test`: a matrix of `ubuntu-latest` and `ubuntu-24.04-arm`. It logs in to GHCR and runs `deploy/smoke-test.sh ghcr.io/<owner>/<name>@<digest>`.
- **Only the digest crosses jobs.** GitHub drops any job output that contains a secret's value. The image name contains the owner's name, which may well equal the `DOCKERHUB_USERNAME` secret, so passing the full name could silently break the smoke job.
- Actions are pinned by major version, as `ci.yml` does.

### Dockerfile

- OCI labels are added to the runner stage: title, description, `source=https://github.com/leongyeehang/OpenInvites`, `licenses=AGPL-3.0`. Version, revision and created come from metadata-action in CI.
- Nothing else changed. It is already multi-stage, from standalone output, and runs as `node`.
- `.dockerignore` now excludes `deploy/`.

## What I validated, and how

**Image (amd64, built locally as `openinvites:local`):**
- Size: 75.6 MB compressed (`docker image inspect .Size`; the `node:22-alpine` base alone is 60.8 MB). About 222 MB unpacked, going by the layer sizes: 163 MB Node base, 52 MB standalone output, the rest small.
- Non-root: `Config.User` is `node`, and `id -u` inside the container is `1000`.

**arm64 `sharp` without QEMU:**
- The lockfile has `@img/sharp-linuxmusl-arm64@0.35.4` with `cpu: [arm64]`, `os: [linux]`, `libc: [musl]`.
- I ran `pnpm install --frozen-lockfile --ignore-scripts` in `node:22-alpine` with `supportedArchitectures: {os: [linux], cpu: [arm64], libc: [musl]}`. It installed exactly `@img/sharp-linuxmusl-arm64`, `@img/sharp-libvips-linuxmusl-arm64`, `@next/swc-linux-arm64-musl`, `@tailwindcss/oxide-linux-arm64-musl` and `lightningcss-linux-arm64-musl`, and no x64 packages.
- A native or emulated arm64 build uses pnpm's default (the running platform), so it selects the same packages.
- In the amd64 image, the standalone output carries `@img/sharp-linuxmusl-x64`, and `node_modules/sharp` resolves from `/app`. The smoke test's `require("sharp")` therefore proves the binary on whatever architecture it runs on.

**Local smoke test (`deploy/smoke-test.sh openinvites:local`, final version of the script; Compose's create/start progress lines omitted):**
```
Starting openinvites:local
 Container openinvites-smoke-751689-db-1 Healthy 
 Container openinvites-smoke-751689-db-1 Healthy 
 Container openinvites-smoke-751689-app-1 Healthy 
NAME                             IMAGE                  COMMAND                  SERVICE   CREATED          STATUS                    PORTS
openinvites-smoke-751689-app-1   openinvites:local      "docker-entrypoint.s…"   app       12 seconds ago   Up 6 seconds (healthy)    127.0.0.1:32770->3000/tcp
openinvites-smoke-751689-db-1    postgres:18.6-alpine   "docker-entrypoint.s…"   db        12 seconds ago   Up 12 seconds (healthy)   5432/tcp
GET http://127.0.0.1:32770/api/health
{"status":"ok"}
The app runs as uid 1000
The picture library on x86_64:
sharp 0.35.4, libvips 8.18.6
The password reset command:
No host has the email nobody@example.org
Smoke test passed
```
- It takes about 22 s.
- Afterwards no container, volume or network named `*smoke*` was left.
- With a nonexistent image it exits 1 and still cleans up.

**Deployment package with the Caddy profile, checked by hand** (throwaway project, `BASE_URL=https://localhost:8443`, where Caddy used its local CA):
- `/api/health` answered `{"status":"ok"}` through Caddy.
- **Forged `X-Forwarded-For`:** with `RATE_LIMIT_EVENT_PAGE=5/1m`, I sent 7 requests through Caddy to `/e/abcdefghij`, each with a different forged header. The first 5 got 404 and requests 6 and 7 got 429. The same 7 sent straight to the app's loopback port all got 404. So Caddy overwrites the header, `TRUSTED_PROXY_HOPS=1` is right, and the loopback-only rule matters.
- **The documented commands, on the same stack:**
  - signed up a host, who became the operator;
  - `docker compose exec app node scripts/reset-password.mjs host@example.org` printed a temporary password;
  - the then-documented `psql` delete of that host's sessions answered `DELETE 1` (the step was removed in fix round 1);
  - backed up with `pg_dump --format=custom` and `docker compose exec -T app tar -C /app -czf - uploads`;
  - `down -v`, which destroyed everything;
  - restored per the doc: `up -d --wait db`, then `pg_restore --clean --if-exists --no-owner`, then `docker compose run --rm --no-deps -T --entrypoint tar app -C /app -xzf -` into a fresh `uploads` volume (the files came back owned by `node`), then `up -d --wait`.

  On the restored instance the host was still the operator, the file was back, and signing in with the temporary password worked.
- **What a bad setting looks like:** with `MAX_UPLOAD_MB=lots`, `up --wait` reports the app unhealthy, and `docker compose logs app` shows `MAX_UPLOAD_MB must be a number of megabytes, not "lots"`. With an unreachable SMTP host, the log shows `ERROR [Better Auth]: Failed to run background task: Error: getaddrinfo ENOTFOUND ...`. I adjusted the docs' wording to match: the app does not exit, it never turns healthy.
- **Idle memory:** app 55 MiB, Postgres 45 MiB.

**Compose config:**
- With `.env.example` copied as is, `docker compose config` refuses, naming `AUTH_SECRET`, `BASE_URL` and `POSTGRES_PASSWORD`.
- With the required values filled in, it is valid, and the services are `caddy`, `db` and `app`.
- `.env` quoting, tested with Compose 5.5.1:
  - a single-quoted value is kept literally, including `$` and `$$`;
  - in double-quoted and bare values, `$$` becomes `$`;
  - a double-quoted value can span several lines;
  - a bare `MAIL_FROM=OpenInvites <no-reply@...>` survives intact;
  - `APP_PORT=0` gives a random loopback port.

**actionlint** (`docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest`, version 1.7.12, with shellcheck 0.11.0 and pyflakes in the image):
```
verbose: Collected 2 YAML files
verbose: Found total 0 errors in 36 ms for .github/workflows/ci.yml
verbose: Found total 0 errors in 44 ms for .github/workflows/release.yml
verbose: Found 0 errors in 2 files
```
- Mutation checks on a copy show it really checks what matters:
  - `matrix.runnr` → `property "runnr" is not defined`;
  - `needs.publish.outputs.image` → `property "image" is not defined in object type {digest: string}`;
  - `platfroms:` and `flavour:` → `input ... is not defined in action docker/build-push-action@v6` and `docker/metadata-action@v5`.

  So it validates expressions, job outputs and action inputs.
- `shellcheck deploy/smoke-test.sh` passes clean. An SC2016 info on a JS template literal was fixed.
- The image-name bash step, run locally with a mixed-case owner, gives `ghcr.io/leongyeehang/openinvites`.
- **Not validated:** metadata-action's actual tag output, the QEMU arm64 build, pushes, the reusable-workflow call in GitHub, and the arm64 runner. None of these can run without GitHub.

**Browser suite** (the Dockerfile changed): `docker compose --profile test up -d --build --wait && pnpm exec playwright test` gives **208 passed (3.3m)**, with no failures or flakes. The running `openinvites-app-1` has the new image's id and carries the `AGPL-3.0` label.

**Other checks:** `pnpm lint` passes. `pnpm typecheck` passes after `rm -f tsconfig.tsbuildinfo`. `pnpm test` passes: 40 files, 319 tests.

## Files changed

In commit `d63b44c`:
- `Dockerfile`: OCI labels.
- `.dockerignore`: excludes `deploy`.
- `.github/workflows/ci.yml`: `workflow_call`; push on branches only.
- `.github/workflows/release.yml`: new.
- `deploy/compose.yaml`, `deploy/.env.example`, `deploy/Caddyfile`, `deploy/smoke-test.sh` (mode 755): new.
- `docs/operator/install.md`, `docs/operator/configuration.md`, `docs/operator/upgrade-backup.md`, `docs/releasing.md`: new.
- `README.md`: Configuration section shortened to links; the moved sections are removed; a Compose note and Layout lines added.

Not staged, as required: `.scratch/openinvites/issues/19-deployment-package.md` (status done, five boxes ticked, a note under the last one, the dated comment).

## Environment-variable inventory

Every variable the app reads, from `grep process.env` plus the `*FromEnv(env)` readers. Each one is in `.env.example` and `configuration.md`; I checked that mechanically.

| Variable | Default | Read in |
| --- | --- | --- |
| `DATABASE_URL` | required; built by `deploy/compose.yaml` | `src/db/client.ts`, `scripts/reset-password.mjs` |
| `BASE_URL` | required | `src/instance/env.ts` |
| `AUTH_SECRET` | required (Better Auth refuses its default in production) | `src/auth/auth.ts` |
| `OPERATOR_CONTACT_EMAIL` | none | `src/instance/env.ts` |
| `OPERATOR_EMAIL` | none | `src/instance/env.ts` |
| `ANALYTICS_SNIPPET` | none | `src/instance/env.ts` |
| `MAX_UPLOAD_MB` | 10 | `src/instance/env.ts` |
| `SMTP_URL`, `MAIL_FROM` | none (`MAIL_FROM` is required with `SMTP_URL`) | `src/mail/config.ts` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | none | `src/auth/providers.ts` |
| `STORAGE_BACKEND` | local | `src/storage/config.ts` |
| `UPLOADS_DIR` | uploads (that is, `/app/uploads`) | `src/storage/config.ts` |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | required for s3 | `src/storage/config.ts` |
| `S3_REGION` | us-east-1 | `src/storage/config.ts` |
| `TRUSTED_PROXY_HOPS` | 1 | `src/rate-limit/config.ts` |
| `RATE_LIMIT_EVENT_PAGE` | 120/1m | `src/rate-limit/config.ts` |
| `RATE_LIMIT_RSVP` | 60/10m | `src/rate-limit/config.ts` |
| `RATE_LIMIT_UPLOAD` | 20/10m | `src/rate-limit/config.ts` |
| `RATE_LIMIT_SIGN_UP` | 10/1h | `src/rate-limit/config.ts` |
| `RATE_LIMIT_SIGN_IN` | 10/15m | `src/rate-limit/config.ts` |
| `RATE_LIMIT_PASSWORD_RESET` | 10/1h | `src/rate-limit/config.ts` |
| `RATE_LIMIT_MAIL` | 10/1h | `src/rate-limit/config.ts` |
| `PRIVACY_POLICY_FILE`, `PRIVACY_POLICY_MARKDOWN`, `TERMS_FILE`, `TERMS_MARKDOWN` | none (the placeholder page) | `src/legal/source.ts` (through `src/legal/documents.ts`) |
| `NEXT_RUNTIME` | set by Next.js itself; not an operator setting | `src/instrumentation.ts` |

Set by the image in the `Dockerfile` (documented as "leave alone"): `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, `HOSTNAME=0.0.0.0`, `PORT=3000`.

Read by `deploy/compose.yaml` only: `POSTGRES_PASSWORD` (required), `OPENINVITES_IMAGE`, `COMPOSE_PROFILES`, `APP_PORT` (default 3000).

Used by `release.yml`: the secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, `GITHUB_TOKEN` (automatic), and the optional variables `IMAGE_NAME` (default openinvites) and `DOCKERHUB_NAMESPACE` (default the owner).

## Self-review

**Checked against every point the brief listed:**
- The loopback-only port and the forging risk are in the compose comment, `install.md` and `configuration.md`, and were demonstrated by hand.
- All five `OPERATOR_EMAIL` points are covered, plus a sixth: the session purge.
- S3: path-style requests, `ListBucket` with the 403-for-404 explanation, and the private bucket.
- The three rendition names come from `src/uploads/renditions.ts`.
- Backups include the volume or the bucket.
- Orphaned files are in the running notes.
- The mail limit covering emailed host invitations is stated.

**Glossary:** a pass for words `CONTEXT.md` says to avoid (admin, invite, server or deployment for the instance, user for a host) found one "invite" used as a verb, now reworded. "Deployment files" and "deployment package" refer to files, not the instance.

**Every command in the docs was run as written:** the reset, the `psql` purge (since removed, fix round 1), backup, restore, `up --wait`, and `compose port`. The only exceptions are the `curl` from `raw.githubusercontent.com` (the repository is private) and the real Let's Encrypt issuance (no public domain here).

**What I deliberately did not do:**
- No log rotation settings.
- No security headers in the Caddyfile.
- No npm or yarn removal from the runner.
- No version build argument; metadata-action labels cover it.
- No external-Postgres option.
- No change to app code.

**`compose.yaml` duplicates the image's health check** on purpose, so the "health checks on both" requirement is visible in the file an operator reads. If the image's check changes, both need updating.

## Concerns

1. **The `OPERATOR_EMAIL` squatter recovery is unsafe without an extra step.** *Resolved in fix round 1 (below): a reset now signs the account out everywhere, and the `psql` step is gone from the docs.*
   - Better Auth's `emailAndPassword.revokeSessionsOnPasswordReset` is off by default. I checked `better-auth/dist/api/routes/password.mjs`.
   - So resetting the squatted account's password does not sign out whoever created it. Once the real holder verifies, the squatter's still-live session belongs to the operator.
   - I documented a `psql` session purge between the reset and the verification, and tested the command.
   - The proper fix is app code (`revokeSessionsOnPasswordReset: true`, and the same in `scripts/reset-password.mjs`), which is outside this ticket. It is the coordinator's call.
2. **The last checkbox stays open** until the first release's arm64 smoke job, or a run on the maintainer's arm64 hardware, has passed (ticket 21).
3. **QEMU arm64 `next build`** was never exercised. It will be slow (the job allows 120 minutes), and emulated native toolchains occasionally crash. The fallback is native per-platform builds on `ubuntu-24.04-arm`, merged by digest.
4. **`ubuntu-24.04-arm` is free only for public repositories.** On a private repository the arm64 smoke job would wait for a runner that never comes. Ticket 21 releases after going public, so this should not bite.
5. **Names ticket 21 must confirm:**
   - The images `ghcr.io/leongyeehang/openinvites` and `leongyeehang/openinvites`. The Docker Hub namespace is assumed to equal the GitHub owner.
   - The repository `leongyeehang/OpenInvites`, used in the Dockerfile's source label and in the `install.md` download URL on `main`.
   - The licence label `AGPL-3.0`: whether it is "-only" or "-or-later" is undecided.
6. **Bundled Caddy on host networking needs Docker Engine on Linux.** Docker Desktop users are told to try it locally or run their own proxy.
7. **A trailing slash in `BASE_URL` breaks Caddy** (it serves `/` only). The app itself tolerates it. The docs warn about it, but there is no automated check.
8. **Minor:**
   - `.env` is passed whole to the app, so the Compose-only values are in its environment. Harmless.
   - The app does not check `AUTH_SECRET` at start; Compose does here.
   - Better Auth would also honour a `BETTER_AUTH_SECRETS` variable an operator might set. It is not documented, on purpose.
9. **Left behind on this machine:**
   - the local image `openinvites:local`, handy for re-running the smoke test;
   - pulled images `postgres:18.6-alpine`, `caddy:2.11-alpine` and `rhysd/actionlint:latest`.

   The test-profile stack is still running on the rebuilt image, as I found it. I started no dev server.

---

# Fix round 1: a password reset signs the account out everywhere

**Commit:** `899ab06` Password reset: resetting a host's password signs their account out everywhere. It is a new commit; nothing was amended.

**The finding:** Better Auth keeps sessions on a password reset unless told otherwise. So for any host, someone holding a live session kept it after the owner reset the password, by email or with the operator command. My docs covered this only in the `OPERATOR_EMAIL` squatter section, with a manual `psql` purge.

## What changed

- **`src/auth/auth.ts`:** `emailAndPassword.revokeSessionsOnPasswordReset: true`, with a comment.
  - Better Auth 1.7.5 (`api/routes/password.mjs`) sets the new password, then deletes every session of the account with `deleteUserSessions`. That includes the resetting browser's own session.
  - Sessions live in the database and there is no cookie cache, since the app is stateful. So the deletion takes effect on the next request.
- **The resetting browser's own flow:** the reset action redirects to `/sign-in?passwordChanged=1`. The sign-in page sends anyone with a session on to `/dashboard`.
  - Before the fix, a browser that was signed in while resetting was bounced to the dashboard, and never saw "Your password has been changed. Sign in with the new one."
  - Now its session is gone, so it lands on sign-in with that message, then signs in with the new password.
  - A browser that was already signed out gets the same result as before.
  - No new interface strings.
- **`scripts/reset-password.mjs`:**
  - Sets the password and runs `delete from session where user_id = ...` in one `sql.begin` transaction. A host with no credential account changes nothing and gets the same "has no password to reset" failure.
  - The output is now: `Temporary password for <name> <email>: <password>`, then `They have been signed out everywhere. Ask them to sign in with it and change it in account settings.`
  - The header comment says so too.
- **Docs:**
  - `configuration.md`: the `psql` purge is removed. The squatter recovery is now two steps: reset by email ("setting the new password signs the account out everywhere, so whoever created it is signed out too"), then sign in and use **Resend email** to verify. The Mail section's list says a reset by email signs the host out on every device.
  - `upgrade-backup.md`: the reset section says both kinds of reset sign the host out everywhere, and shows the command's new output.
- **`deploy/smoke-test.sh`:** checked, and unchanged. It matches only the failure message `No host has the email nobody@example.org`, which did not change. The run below confirms it.

## Covering tests (browser, observable)

Both are in `e2e/host-accounts.spec.ts`:

1. **New:** "resetting a password by email signs the host out on every device, the one that reset it too".
   - The host signs up (device A) and signs in on a second browser context (device B).
   - On A, still signed in, they ask for the reset link, open it from Mailpit, and set a new password.
   - A lands on `/sign-in` showing "Your password has been changed. Sign in with the new one."
   - B's `/dashboard` sends it to `/sign-in`.
   - A signs in with the new password and reaches the dashboard.
2. **Extended:** "the operator resets a host's password with the command inside the container, signing them out". It runs against the `app` container.
   - The host stays signed in; the `signOut` step was removed.
   - The operator runs `docker compose --profile test exec -T app node scripts/reset-password.mjs <email>`.
   - The output contains "They have been signed out everywhere."
   - The host's `/dashboard` now sends them to `/sign-in`.
   - The temporary password signs them in.

**Red first**, against the test-profile image built from `d63b44c`, without the fix. Both tests failed:
- test 1 with `Expected pattern: /\/sign-in/, Received string: "http://localhost:3000/dashboard"`;
- test 2 at the output: the received text was the old two lines.

**Mutation check of test 2's sign-out assertion:** I copied into the running `app` container a script that prints the new line but keeps the sessions. The test failed with `Expected pattern: /\/sign-in$/, Received string: "http://localhost:3000/dashboard"`. With the real script copied back, it passed. I then recreated `app` from its image before the full run.

## Commands and their output

- `pnpm lint`: exit 0.
- `rm -f tsconfig.tsbuildinfo && pnpm typecheck`: `✓ Types generated successfully`, exit 0.
- `pnpm test`: `Test Files 40 passed (40)`, `Tests 319 passed (319)`. The only warning is Vite's native config loader notice, which ticket 04 already noted.
- `docker compose --profile test up -d --build --wait && pnpm exec playwright test e2e/host-accounts.spec.ts`: `23 passed (13.3s)`. That is 11 tests at each width plus the operator setup, the two covering tests included.
- The full browser suite, after `docker compose --profile test up -d --force-recreate --no-deps --wait app` and `docker compose --profile test up -d --build --wait`, then `pnpm exec playwright test`: `210 passed (3.2m)`. That is 208 before, plus the new scenario at 390px and at desktop. No failures, no flakes.
- `docker build -t openinvites:local .`: exit 0. The image `sha256:e8196d0f...` is 75.6 MB compressed, runs as user `node`, and its `scripts/reset-password.mjs` contains the session delete. Then `deploy/smoke-test.sh openinvites:local`, with Compose's create/start lines omitted:
```
Starting openinvites:local
 Container openinvites-smoke-764609-db-1 Healthy 
 Container openinvites-smoke-764609-db-1 Healthy 
 Container openinvites-smoke-764609-app-1 Healthy 
NAME                             IMAGE                  COMMAND                  SERVICE   CREATED          STATUS                    PORTS
openinvites-smoke-764609-app-1   openinvites:local      "docker-entrypoint.s…"   app       13 seconds ago   Up 6 seconds (healthy)    127.0.0.1:32771->3000/tcp
openinvites-smoke-764609-db-1    postgres:18.6-alpine   "docker-entrypoint.s…"   db        13 seconds ago   Up 12 seconds (healthy)   5432/tcp
GET http://127.0.0.1:32771/api/health
{"status":"ok"}
The app runs as uid 1000
The picture library on x86_64:
sharp 0.35.4, libvips 8.18.6
The password reset command:
No host has the email nobody@example.org
Smoke test passed
```

## Noted, not changed

Changing a password in account settings still keeps the host's other sessions (`revokeOtherSessions: false` in `src/auth/actions.ts`, ticket 02's choice). That is outside the ruling; I mention it only because it is the same family of behaviour.

The ticket comment is updated: the two superseded lines are annotated, and a dated fix-round entry is appended.

