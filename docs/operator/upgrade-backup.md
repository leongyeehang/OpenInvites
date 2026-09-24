# Upgrading, backups, and operations

Run every command here in the directory that holds `compose.yaml` and `.env`
([install.md](install.md)).

## Upgrading

Take a backup first (below). Then:

```sh
docker compose pull
docker compose up -d --wait
```

That is the whole upgrade. When the new app starts, it applies its database migrations before it
answers its first request, and reports healthy only once they have run. If a migration fails,
the app stays unhealthy and `docker compose logs app` says why; nothing else has to be run by
hand, ever.

Which release you get depends on `OPENINVITES_IMAGE` in `.env`:

| `OPENINVITES_IMAGE` ends in | `docker compose pull` gets |
| --- | --- |
| `:latest` (the default) | the newest release. |
| `:1` | the newest 1.x release, never 2.0. |
| `:1.2` | the newest 1.2.x release: fixes only. |
| `:1.2.3` | exactly that release, until you change it. |

Read the release notes before moving to a new major or minor version. A release that changes the
deployment files (`compose.yaml`, `Caddyfile`, `.env.example`) says so; fetch them as in
[install.md](install.md#1-get-the-deployment-files), with `release` set to the new version, and
keep your `.env` and `compose.override.yaml`. `compose.yaml` pins a Postgres 18 minor version, and
a newer copy may move it to a later one: that needs nothing more than `docker compose up -d`.

Going back to an older release after a newer one has migrated the database is not supported.
Restore the backup you took instead.

## Backups

An instance is four things:

| What | Where | How to keep it |
| --- | --- | --- |
| The database: hosts, events, RSVPs, answers, settings | The `db-data` volume | A dump, below. Copying the volume's files while Postgres runs is not a backup. |
| Hosts' pictures | The `uploads` volume, or the bucket with `STORAGE_BACKEND=s3` | An archive of the volume, below, or the provider's own tools for the bucket (versioning, replication, `rclone sync`). |
| `.env` | Next to `compose.yaml` | A copy, kept as secret as the file. Without the same `AUTH_SECRET` every host is signed out; without `POSTGRES_PASSWORD` a restored database cannot be opened. |
| Certificates | The `caddy-data` volume | Nothing: Caddy gets new ones on its own. |

To back up the database and the pictures:

```sh
mkdir -p backups
docker compose exec -T db pg_dump -U openinvites -d openinvites --format=custom > backups/openinvites-$(date +%F).dump
docker compose exec -T app tar -C /app -czf - uploads > backups/uploads-$(date +%F).tar.gz
```

Both run while the instance is up. Take the dump first: a picture uploaded between the two
commands is then only an extra file. For a pair that matches exactly, run
`docker compose stop app` before them and `docker compose start app` after.

Keep the files somewhere other than this machine. To run it every night, put those commands in a
script and call it from cron.

## Restoring

On a fresh machine, or after losing the volumes:

1. Put `compose.yaml`, `Caddyfile`, your saved `.env`, and any `compose.override.yaml` in a
   directory, with the backup files in `backups/` beside them.
2. Start only the database, and load the dump into it:
   ```sh
   docker compose up -d --wait db
   docker compose exec -T db pg_restore -U openinvites -d openinvites --clean --if-exists --no-owner < backups/openinvites-2026-09-24.dump
   ```
3. Put the pictures back into the `uploads` volume (with S3 storage, skip this: they are in the
   bucket):
   ```sh
   docker compose run --rm --no-deps -T --entrypoint tar app -C /app -xzf - < backups/uploads-2026-09-24.tar.gz
   ```
4. Start everything:
   ```sh
   docker compose up -d --wait
   ```

If the backup is from an older release than the image you now run, the app migrates the
restored database as it starts, as in an upgrade.

## Resetting a host's password

On an instance with mail, hosts reset their own password from **Forgot your password?** on the
sign-in page. Without mail, the operator does it from inside the container:

```sh
docker compose exec app node scripts/reset-password.mjs host@example.org
```

It prints a temporary password for you to pass on:

```
Temporary password for Sam <host@example.org>: 7kqv4mxe2nhw9pta
Ask them to sign in with it and change it in account settings.
```

The host signs in with it and changes it in account settings. A host who only ever signed in
with Google or GitHub has no password to reset, and the command says so.

## Running notes

- **Health.** `https://<your domain>/api/health` answers `{"status":"ok"}` while the app is up
  and its database answers, and 503 otherwise. Compose checks it every 10 seconds
  (`docker compose ps` shows the result); point an uptime monitor at it too.
- **Logs.** `docker compose logs -f app` (or `db`, `caddy`). The app logs settings it cannot
  use at start, and requests that arrive without a client address from the proxy. Caddy keeps no
  log of visitors' requests unless you add one to the `Caddyfile`.
- **One app container.** The rate limits keep their counts in the app's memory, so a restart
  forgets them, and running more than one app container would give each its own. Run one, as
  `compose.yaml` does.
- **Pictures nobody points to.** A host's picture is three files (`<id>-background.webp`,
  `<id>-poster.webp`, `<id>-card.jpg`). If the app stops in the middle of an upload, or cannot
  remove a replaced or deleted picture's files (it logs that and carries on), files can be left
  in storage that no event uses. Nothing sweeps them up. They cost only space; the `upload`
  table lists the ids still in use (`docker compose exec db psql -U openinvites -d openinvites
  -c 'select id from upload'`), and a file whose id is not there can be deleted.
- **Postgres.** It is reachable only from the app, on the Compose network. For a look inside:
  `docker compose exec db psql -U openinvites -d openinvites`.
