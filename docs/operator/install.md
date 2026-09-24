# Installing an instance

This takes an empty machine to a running OpenInvites instance with HTTPS. Once it runs, see
[configuration.md](configuration.md) for every setting and [upgrade-backup.md](upgrade-backup.md)
for upgrades, backups, and the password reset command.

## What you need

- A Linux machine, amd64 or arm64: a cloud VM, a home server, or a Raspberry Pi 4 or 5 on a
  64-bit system. 1 GB of memory is enough; processing a large photo briefly takes up to about
  200 MB more.
- [Docker Engine](https://docs.docker.com/engine/install/) with the Compose plugin
  (`docker compose version` should answer).
- A domain name, such as `invites.example.org`, with a DNS `A` record (and `AAAA`, if the
  machine has IPv6) pointing at the machine.
- Ports 80 and 443 over TCP, and 443 over UDP, open to the internet. Caddy uses port 80 to prove
  to Let's Encrypt that the name is yours, then serves everything over HTTPS.
- Optional, and recommended: an SMTP account to send mail from. Without mail, hosts are not
  asked to verify their email, and you reset forgotten passwords yourself.

## 1. Get the deployment files

Three files make an instance: `compose.yaml` (the app, Postgres, and Caddy), `Caddyfile`, and
`.env`, which holds every setting. Put them in a directory of their own:

```sh
mkdir openinvites && cd openinvites
release=main   # or the release you are installing, such as v1.2.3
base=https://raw.githubusercontent.com/leongyeehang/OpenInvites/$release/deploy
curl -fsSL -o compose.yaml "$base/compose.yaml"
curl -fsSL -o Caddyfile "$base/Caddyfile"
curl -fsSL -o .env "$base/.env.example"
```

## 2. Fill in `.env`

Open `.env` in an editor. Every variable is described there; four need a value now:

| Variable | Value |
| --- | --- |
| `POSTGRES_PASSWORD` | The output of `openssl rand -hex 24`. |
| `AUTH_SECRET` | The output of `openssl rand -hex 32`. Keep it secret; changing it later signs every host out. |
| `BASE_URL` | `https://` and your domain name, such as `https://invites.example.org`, with no trailing slash. |
| `OPERATOR_CONTACT_EMAIL` | An address where hosts can reach you. It is shown on the privacy policy and terms pages, and to hosts who need a password reset. |

To send mail, also set `SMTP_URL` and `MAIL_FROM` ([configuration.md, "Mail"](configuration.md#mail)).
Everything else can wait.

`.env` holds secrets: `chmod 600 .env` keeps it to you.

## 3. Start it

```sh
docker compose up -d --wait
```

The first start downloads the images, creates the database, and runs its migrations. The
command returns once Postgres and the app both report healthy. Meanwhile Caddy asks Let's
Encrypt for a certificate, which usually takes under a minute; `docker compose logs -f caddy`
shows how it is going.

Check it from anywhere:

```sh
curl https://invites.example.org/api/health
```

`{"status":"ok"}` means the app is up and its database answers. That address is also the one to
give an uptime monitor.

If `docker compose up` stops with "Set ... in .env", a required value is empty. If it says the
app is unhealthy, `docker compose logs app` says why: a setting the app cannot use keeps it from
starting, with a message naming the variable.

## 4. Create your account

Open your address and choose **Create an account**. **The first account created on a fresh
instance becomes its operator**, so do this before you tell anyone the address. With mail
configured, open the verification link you are sent.

As the operator you find **Instance settings** in the header. A new instance is **Invitation
only**: nobody else can create an account until you make them a host invitation there, or switch
registration to **Open**. [configuration.md, "The operator"](configuration.md#the-operator-registration-and-host-invitations)
has the details, including how to take the instance back if someone else signed up first.

That is a running instance. From here:

- Put your privacy policy and terms of use in place of the placeholders
  ([configuration.md, "Privacy policy and terms of use"](configuration.md#privacy-policy-and-terms-of-use)).
- Set up backups ([upgrade-backup.md](upgrade-backup.md#backups)).

## What runs where

| Service | What it is | Kept in |
| --- | --- | --- |
| `app` | OpenInvites, listening only on this machine's loopback, port 3000 (`APP_PORT`). | The `uploads` volume, for hosts' pictures, unless you use S3. |
| `db` | Postgres 18. Not reachable from outside the machine's Docker network. | The `db-data` volume. |
| `caddy` | Caddy 2, terminating HTTPS on ports 80 and 443 and passing requests to the app. | The `caddy-data` volume (certificates) and `caddy-config`. |

The app never speaks TLS itself. Every visitor has to come through the reverse proxy: the rate
limits count visitors by the address the proxy adds to `X-Forwarded-For`, and a visitor who
could reach the app directly could write that header and pass for anyone. That is why the app's
port is published on `127.0.0.1` only. Never publish it more widely.

Caddy uses the machine's network directly (`network_mode: host`) rather than Docker's port
forwarding, so it sees each visitor's real address, over IPv6 too. That needs Docker Engine on
Linux; on Docker Desktop, run your own proxy or try it locally (below).

## Using a reverse proxy of your own

If the machine already runs nginx, Traefik, a Caddy of its own, or similar:

1. Remove the `COMPOSE_PROFILES=caddy` line from `.env`, so the bundled Caddy does not start.
2. Point your proxy at `http://127.0.0.1:3000` (or the `APP_PORT` you chose), passing the `Host`
   header through.
3. Make sure it adds the address it saw the visitor come from to `X-Forwarded-For`. nginx does
   with `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`; Caddy and Traefik do by
   default.
4. `TRUSTED_PROXY_HOPS` is the number of proxies in front of the app: 1, the default, for one
   proxy; 2 for a CDN in front of your proxy ([configuration.md, "Rate limits"](configuration.md#rate-limits)).

The shipped `Caddyfile` also works for a Caddy installed on the machine, with `BASE_URL` in its
environment.

## Trying it on your own computer

Without a domain, for a look around:

1. In `.env`, set `BASE_URL=http://localhost:3000`, remove the `COMPOSE_PROFILES=caddy` line,
   and set `TRUSTED_PROXY_HOPS=0`: with no proxy in front, no visitor address can be believed,
   so everyone shares one allowance of each rate limit, which is fine for one person.
2. `docker compose up -d --wait`, then open <http://localhost:3000>.

This works on Docker Desktop for Mac and Windows too. Do not open an instance set up this way
to other people.
