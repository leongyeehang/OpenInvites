# Configuring an instance

Every setting is an environment variable, kept in `.env` next to `compose.yaml`
([install.md](install.md)). The app reads them when its container starts, so after changing
one, run:

```sh
docker compose up -d
```

`docker compose restart` is not enough: it keeps the values the container was created with.

A value the app cannot use keeps it from starting (it never reports healthy), and
`docker compose logs app` names the variable.
Empty and absent are the same: an empty optional variable takes its default.

**Quoting in `.env`:** a value that holds a `$` or quotation marks goes in single quotes, which
keep it exactly as written. A value over several lines goes in double quotes. Anything else
needs no quotes, spaces included.

The sections below follow the groups in `.env.example`.

## The Compose file

These are read by `compose.yaml` itself rather than by the app.

| Variable | Default | Meaning |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Required | Password of the database's own user. Letters and digits only, since `compose.yaml` builds the app's `DATABASE_URL` from it. Read only when the database is first created: to change it later, change it inside Postgres too (`ALTER USER openinvites PASSWORD '...'`). |
| `OPENINVITES_IMAGE` | `ghcr.io/leongyeehang/openinvites:latest` | The image to run. Pin `:1.2.3`, `:1.2` or `:1` to choose when you move to a new release ([upgrade-backup.md](upgrade-backup.md#upgrading)). The same images are on Docker Hub as `leongyeehang/openinvites`. |
| `COMPOSE_PROFILES` | `caddy` in `.env.example` | Starts the bundled Caddy. Remove the line to use a reverse proxy of your own. |
| `APP_PORT` | `3000` | The port on the machine's loopback (`127.0.0.1`) where the app listens for the reverse proxy. |

`DATABASE_URL`, the app's Postgres connection string, is set by `compose.yaml` from
`POSTGRES_PASSWORD`; a value in `.env` is ignored.

## The instance

| Variable | Default | Meaning |
| --- | --- | --- |
| `BASE_URL` | Required | The instance's public address, exactly as a browser shows it, such as `https://invites.example.org`, with no trailing slash and no path. Event links and the links in emails start with it; uploads from any other origin are refused; the bundled Caddy gets its certificate for this name. |
| `AUTH_SECRET` | Required | Signs sessions and the links in emails. At least 32 characters; `openssl rand -hex 32` makes one. Changing it signs every host out. |
| `OPERATOR_CONTACT_EMAIL` | None | Shown on the privacy policy and terms pages, and to hosts who need a password reset on an instance without mail. |
| `OPERATOR_EMAIL` | None | Your own account, to take the instance back (next section). |

### The operator, registration, and host invitations

The first account created on a fresh instance is its operator; there is only ever one. The
operator finds **Instance settings** in the header of the host area (`/instance`); for anyone
else that address is a page that does not exist.

- **Registration** is Invitation only on a fresh instance: only someone holding a host
  invitation can create an account, by email, Google, or GitHub alike. Open lets anyone sign up.
  A change takes effect at once.
- **Host invitations** are single-use links the operator makes on the same page, optionally
  addressed to an email, which then fills in the sign-up form (anyone with the link can still
  use it). The link is shown once, to copy; with mail configured, the operator can have it
  emailed instead. A link works for one account and expires after 14 days, and can be revoked
  while it is pending. The page lists every invitation as Pending, Used, Revoked, or Expired.
- Emailed host invitations count against the mail rate limit (`RATE_LIMIT_MAIL`, 10 an hour by
  default) together with every other email your own address asks for. To send more host
  invitations than that in an hour, copy the links instead, or raise the limit.

An instance upgraded from before there was an operator makes its earliest account the operator
and starts Invitation only.

#### Taking the instance back with `OPERATOR_EMAIL`

If someone else created the first account before you did, `OPERATOR_EMAIL` makes an account of
yours the operator in their place. That address may always sign up, whatever the registration
mode.

1. Set `OPERATOR_EMAIL` to an address of yours that is not public, and not the one in
   `OPERATOR_CONTACT_EMAIL`: whoever proves they hold it becomes the operator. Run
   `docker compose up -d`.
2. Sign up with that address, or sign in if the account already exists.
3. With mail, open the verification link sent to it: the account is then the operator. It never
   becomes the operator before its email is verified. Without mail, run
   `docker compose restart app`: at every start, the account with that address becomes the
   operator.
4. Remove `OPERATOR_EMAIL` from `.env` and run `docker compose up -d`, so nobody can use it later.

On an instance without mail there is no verifying an address, so promotion at a start trusts
whoever holds the account with that address, and any host can change their account's email to
it at once. Set the variable only for the start that needs it.

If someone has already created an unverified account with your `OPERATOR_EMAIL` address, you
recover it by resetting its password by email, then verifying it:

1. On the sign-in page, choose **Forgot your password?** and follow the link sent to the address.
   Setting the new password signs the account out everywhere, so whoever created it is signed
   out too.
2. Sign in with the new password and choose **Resend email** in the banner on your dashboard.
   Open the link it sends: the account is now the operator.

## Mail

| Variable | Default | Meaning |
| --- | --- | --- |
| `SMTP_URL` | None: no mail | The SMTP server for outgoing mail. |
| `MAIL_FROM` | Required with `SMTP_URL` | The sender, such as `OpenInvites <no-reply@invites.example.org>`. |

### Configuring SMTP

`SMTP_URL` is one URL holding the server, the port, and the credentials:

- `smtp://user:password@mail.example.org:587` connects on port 587 and upgrades to TLS
  (STARTTLS) when the server offers it, which every provider does.
- `smtps://user:password@mail.example.org:465` uses TLS from the start, on port 465.

A user name or password with characters that mean something in a URL must be percent-encoded:
`@` is `%40`, `:` is `%3A`, `/` is `%2F`, `#` is `%23`. Most transactional mail providers
(Postmark, Mailgun, Amazon SES, Brevo, and the like) give you exactly these values. Send from an
address on a domain your provider is set up to send for (SPF and DKIM), or mail lands in spam.

With mail configured:

- a new host verifies their email before they can create an event;
- a host who forgot their password gets a reset link by email, and setting the new password
  signs them out on every device;
- a host can sign in with a link emailed to them;
- changing an account's email is confirmed from the new address;
- the operator can have a host invitation emailed;
- the host is emailed when a guest replies, unless they turn it off for the event;
- the hosts are emailed when someone comments on the event page, unless they turn it off for the
  event;
- guests who gave an email are reminded of an event a week before if they said Maybe, and the day
  before if they said Going, unless the host turns reminders off for the event.

The app sends event mail from a queue inside the app container, so there is nothing else to run.
The container checks the queue once a minute, and that is when it queues the reminders that have
fallen due. A message that fails is retried a few times over about an hour and a half; if it still
fails, it is dropped and the log says why.

Without mail, none of those emails exist: hosts are not asked to verify, and you reset a
forgotten password with the command in [upgrade-backup.md](upgrade-backup.md#resetting-a-hosts-password).

To check mail works after setting it up, sign up a host with an address you can read, or ask for
a password reset for one. If nothing arrives, `docker compose logs app` shows the SMTP server's
answer. Every request that sends one of the account emails (verification, password reset, an email
change, a host invitation) counts against `RATE_LIMIT_MAIL`, and so does a host's announcement that
emails guests, once however many it reaches. The hosts' reply emails come from guests' RSVPs, so
`RATE_LIMIT_RSVP` bounds them, and their comment emails come from comments, which
`RATE_LIMIT_COMMENT` bounds.

## Sign in with Google and GitHub

| Variable | Default | Meaning |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | None | OAuth credentials for "Continue with Google". The button appears only when both are set. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | None | OAuth credentials for "Continue with GitHub". The button appears only when both are set. |

Set both variables for a provider to add its button to the sign-in and sign-up pages; either one
left unset keeps the button off. Sign-up with Google or GitHub respects the registration mode,
as email sign-up does. Register the redirect URL built from `BASE_URL`:

| Provider | Where to create the OAuth client | Redirect URL to register |
| --- | --- | --- |
| Google | [Google Cloud Console](https://console.cloud.google.com/apis/credentials), OAuth client ID, type Web application | `{BASE_URL}/api/auth/callback/google` |
| GitHub | [GitHub Developer settings](https://github.com/settings/developers), New OAuth App | `{BASE_URL}/api/auth/callback/github` |

Put each client ID and secret in the matching variable, then run `docker compose up -d`.

No automated test can sign in against the real providers, so verify by hand after configuring
them:

1. Confirm both buttons appear on `/sign-in` and `/sign-up`.
2. Sign in with Google using an address that has not signed up before: a host is created and
   signed in, with no "verify your email" banner, and the display name matches the Google
   profile's name.
3. Sign in with GitHub the same way: the display name matches the GitHub profile's name, or the
   GitHub username when the profile has none.
4. Sign up with email and password using an address you also control on Google or GitHub with a
   verified email there, then sign in with that provider using the same address: it signs in to
   the same account rather than creating a second one. A provider address that does not match,
   or is not verified there, does not link.

## Uploaded pictures

| Variable | Default | Meaning |
| --- | --- | --- |
| `MAX_UPLOAD_MB` | `10` | The largest picture a host may upload, in megabytes. Decimals are allowed. |
| `STORAGE_BACKEND` | `local` | `local` keeps pictures in the `uploads` volume; `s3` in an S3-compatible bucket. |
| `UPLOADS_DIR` | `uploads` | Local storage's directory, relative to `/app` in the container. `compose.yaml` mounts the `uploads` volume at `/app/uploads`: leave it. |
| `S3_ENDPOINT` | Required for `s3` | The provider's S3 endpoint, such as `https://s3.eu-central-1.amazonaws.com`. |
| `S3_REGION` | `us-east-1` | The bucket's region. |
| `S3_BUCKET` | Required for `s3` | The bucket's name. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Required for `s3` | The access key the app signs its requests with. |

A host's picture is never kept as sent. The app re-encodes it without its metadata (a photo's
location never reaches a guest) and stores six files named after the upload's id, in the sizes
the page needs: `<id>-background.webp` (the page's background) and `<id>-background-portrait.webp`
(its middle, for a phone held upright), `<id>-poster.webp` and `<id>-poster-720.webp` (the
picture as the invitation, at two widths) and `<id>-poster-copy.webp` (the small copy blurred
behind it), and `<id>-card.jpg` (the link's preview card). They are removed when the host
replaces the picture or deletes the event or their account.

### Configuring S3

S3-compatible services such as AWS S3, Cloudflare R2, Backblaze B2, Wasabi, Garage, and MinIO
work. The app sends path-style requests (`endpoint/bucket/key`), which they all accept; a service
that takes only virtual-hosted requests (`bucket.endpoint/key`) does not work.

1. Create a bucket. It can stay private, with no public access and no CORS rules: guests never
   fetch from the bucket, the app serves the pictures itself.
2. Create an access key allowed to list the bucket and to read, write, and delete its objects.
   On AWS, attach this policy to the key's user, with your bucket's name:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::your-bucket" },
       {
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::your-bucket/*"
       }
     ]
   }
   ```
   `s3:ListBucket` is needed even though the app never lists anything: without it, S3 answers a
   request for a file that is not there with 403 instead of 404, and every request for a
   replaced or deleted picture becomes an error instead of "not found".
3. Set `STORAGE_BACKEND=s3` and the five `S3_` variables, then `docker compose up -d`.

Endpoints and regions on some providers:

| Provider | `S3_ENDPOINT` | `S3_REGION` |
| --- | --- | --- |
| AWS S3 | `https://s3.<region>.amazonaws.com` | The bucket's region, such as `eu-central-1`. |
| Cloudflare R2 | `https://<account id>.r2.cloudflarestorage.com` | Leave the default; R2 takes it as `auto`. |
| Backblaze B2 | `https://s3.<region>.backblazeb2.com` | The region in the endpoint, such as `us-west-004`. |

Switching an instance that already has pictures from `local` to `s3` does not move them: copy
every file from the `uploads` volume to the root of the bucket, under the same names, before
switching ([upgrade-backup.md](upgrade-backup.md#backups) shows how to get them out of the
volume). With S3, the `uploads` volume stays empty.

## Rate limits

Always on, whatever the settings. Each limit counts the requests from one client within a
window, where a client is an IPv4 address or an IPv6 `/64`, and a client past the limit is told
"You're going too fast. Try again shortly." until the window ends. The counts are kept in the
app's memory, so a restart forgets them; they assume a single app container, as `compose.yaml`
runs.

| Variable | Default | What it counts |
| --- | --- | --- |
| `TRUSTED_PROXY_HOPS` | `1` | Not a limit: how many reverse proxies stand in front of the app (below). |
| `RATE_LIMIT_EVENT_PAGE` | `120/1m` | Every request under an event link: the page, its preview card, its calendar file, whether the link exists or not, so links cannot be found by trying them. The host's own changes in the Design drawer on their event page do not count; their visits to the page do, and so does the refresh that shows a picture they have just uploaded. |
| `RATE_LIMIT_RSVP` | `60/10m` | Sending an RSVP, and removing one. This also bounds the emails that tell hosts about replies. |
| `RATE_LIMIT_UPLOAD` | `20/10m` | Uploading a picture. |
| `RATE_LIMIT_SIGN_UP` | `10/1h` | Signing up, and opening a host invitation link. |
| `RATE_LIMIT_SIGN_IN` | `10/15m` | Signing in, and everything else that checks a password (changing it, deleting an account), starting a Google or GitHub sign-in, and opening a co-host link. |
| `RATE_LIMIT_PASSWORD_RESET` | `10/1h` | Asking for a password reset link, and setting the new password. |
| `RATE_LIMIT_MAIL` | `10/1h` | Every request that sends an account email: signing up with mail on, asking for the verification email again, changing an email, asking for a password reset, and the operator's emailed host invitations. Also each announcement a host emails to guests, counted once however many guests it reaches. |
| `RATE_LIMIT_COMMENT` | `30/10m` | Posting a comment on an event page, by a guest or a host. This also bounds the emails that tell hosts about comments. |

Each limit is written `count/window`, the window in seconds, minutes or hours: `120/1m`,
`60/10m`, `10/1h`. The defaults are for people, some of whom share an address (an office, a
phone network): a team answering one invitation together is never turned away; a script
flooding a guest list, an inbox, or a password is.

### Who the client is: `TRUSTED_PROXY_HOPS`

The app never sees a visitor's connection, only what the reverse proxy tells it. Each proxy adds
the address it saw the request come from to the end of `X-Forwarded-For`, and the app believes
the entry `TRUSTED_PROXY_HOPS` places from the end: the one the outermost proxy added. Entries
further left were written by the visitor, and are never believed.

- `1` (the default): one proxy, such as the bundled Caddy. Caddy replaces whatever
  `X-Forwarded-For` the visitor sent with the address it saw.
- `2`: a CDN, such as Cloudflare, in front of Caddy. Caddy then has to be told to trust the CDN,
  so that it adds its own entry after the CDN's instead of replacing it: uncomment the
  `trusted_proxies` block at the top of the `Caddyfile` and list the CDN's published ranges.
- `0`: no proxy believed. Every visitor shares one allowance of each limit, and the log says so
  at start. Only for trying the instance out alone.

If the log says a request came with no client address in `X-Forwarded-For`, the proxy in front
is not adding one.

The app's port must be reachable only through the proxy. A visitor who could talk to the app
directly could write `X-Forwarded-For` themselves and pass for anyone, a new client with each
request. `compose.yaml` publishes it on `127.0.0.1` only; keep it that way.

## Privacy policy and terms of use

| Variable | Default | Meaning |
| --- | --- | --- |
| `PRIVACY_POLICY_FILE` | None | The path, inside the container, of a Markdown file for `/privacy`. |
| `PRIVACY_POLICY_MARKDOWN` | None | The Markdown itself, in double quotes. |
| `TERMS_FILE` | None | The same for `/terms`. |
| `TERMS_MARKDOWN` | None | The same for `/terms`. |

Both pages are linked from the foot of every page. Until you give one its text, it shows a
placeholder saying the operator has not published it yet, which variables replace it, and what
such a page usually covers on an instance. Setting both the file and the Markdown for one page
keeps the app from starting, as does a file it cannot read. Raw HTML in the Markdown is shown as
the text it is. `OPERATOR_CONTACT_EMAIL` is shown under both.

A file is the easier way to keep a long text. Put the files in a `legal` directory next to
`compose.yaml` and mount it with a `compose.override.yaml` beside it, which Compose reads
together with `compose.yaml`, so that file stays as shipped:

```yaml
services:
  app:
    volumes:
      - ./legal:/legal:ro
```

Then set `PRIVACY_POLICY_FILE=/legal/privacy.md` and `TERMS_FILE=/legal/terms.md` in `.env` and
run `docker compose up -d`. The app reads the file on every request, so later edits show at
once, without a restart.

## Analytics

| Variable | Default | Meaning |
| --- | --- | --- |
| `ANALYTICS_SNIPPET` | None | HTML put into the head of every page exactly as written. |

For your own analytics tool, such as a self-hosted [Umami](https://umami.is/), paste the script
tag it gives you, in single quotes:

```sh
ANALYTICS_SNIPPET='<script defer src="https://analytics.example.org/script.js" data-website-id="..."></script>'
```

When it is empty, nothing at all is added to any page. OpenInvites itself never sends anything
to the project or anyone else (ADR-0005): no usage counts, no version checks, no crash reports.

## Set by the image

The image sets `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, and
`NEXT_TELEMETRY_DISABLED=1` itself. Leave them alone.
