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

### Upgrading to 0.8

0.8 gives an album's videos several sizes and a player that picks among them, keeps an Android
motion photo's few seconds as a live photo, lets a host keep when and with what each item was
taken, lets whoever adds an item caption it, lets hosts run a vote on their album, and dresses
every page in a poster, and lets hosts arrange their event pages. Eleven migrations, `0054` to
`0064`, run as the app starts. They add tables,
columns and enum values, carry each video's lighter copy and each event's choice of it over to the
new sizes, and then drop the column that held it (`photo.copy`); nothing else is back-filled, and
no existing event changes until its host chooses. A video's copies made by 0.7 stay as they were
made: an HDR video's look flat, as they did in 0.7, and a video from before 0.8 gains
standard-colour HDR copies and its frame rate only when **Make missing sizes** makes it a size.

- **Stop the worker container before updating, and start it with the app on 0.8.** A site that
  processes videos in a second container (`VIDEO_PROCESSING=worker`, see
  [configuration.md](configuration.md#storage)) must not run a 0.7 worker beside the 0.8 app: it
  would write the column 0.8 has dropped (`photo.copy`), so it fails the videos queued meanwhile,
  and it deletes the jobs 0.8 adds, a video's further sizes and a live photo's motion.
  With the stock `compose.yaml`, `docker compose up -d` replaces both within seconds of each other;
  stopping the worker first (`docker compose stop worker`) leaves no overlap at all.
- **Every feature is on.** Site settings' new **Features** card switches the album, videos and
  voting off for every event at once; an upgraded site starts with all three on.
- **Video sizes replace the lighter copy.** Each event's Album settings tick the sizes its videos
  get, 1080p and 720p, both by default. An event that chose 720p in 0.7 keeps 720p alone; every
  other event gets both. A video from before 0.8 keeps its one copy until you press **Make missing
  sizes** on the Storage card, which gives every ready video the sizes its event asks for, one at
  a time behind new uploads, while it stays in its album.
- **A 4K copy is the operator's choice.** The Storage card's **Also make a 4K copy that plays
  everywhere** is off after the upgrade; see [configuration.md](configuration.md#storage) for what
  it costs.
- **Details are off for every event.** Keeping when items were taken, and the camera with its
  settings, are two switches in each event's Album settings, both off, and every album stays
  ordered by when items were added. Nothing is read from items added before 0.8, whose files kept
  nothing to read; where a picture was taken is never read, under any setting.
- **Live photos and captions start from now.** No photo added before 0.8 kept its motion, so none
  becomes live; a motion photo added from now on does, while Videos is on and ffmpeg is usable.
  No item has a caption until someone writes one, which counts against `RATE_LIMIT_COMMENT`.
- **Voting is off for every event, and names show as before.** The voting migration (`0062`) adds
  the awards and votes tables and four columns to each event, with every existing event's vote
  off, everyone who sees its album allowed to vote, and who added each item shown once voting
  closes, which for an event that never votes is always, as in 0.7. Nothing changes on an album
  until its host starts a vote from the Voting block in its Settings. Each press of a star counts
  against `RATE_LIMIT_VOTE`, 120 in ten minutes by default, since a party often shares one
  address; set it only to change that (see [configuration.md](configuration.md#rate-limits)).
- **The home page's posters dress more pages.** The posters chosen on the Home page card now also
  dress sign-in and the other signed-out screens, the notice pages a guest meets, and Site settings
  (see [configuration.md](configuration.md#the-home-page)); a site that keeps one poster shows it
  there too. Migration `0063` adds the `host_look` table, which holds the poster a host picks in
  Account's Backdrop card; it starts empty, so every host is on Automatic, wearing their next
  event's poster.
- **Every event page keeps its order and everything on it until its host arranges it.**
  Migration `0064` adds `event.sections`, the order and settings a host gives the page's sections
  in the editor's new Arrange sheet, empty for every event, which keeps each layout's order and
  everything on it (a few headings, and the Thread's folded comments, are drawn a little
  differently; the release notes list them); and
  `event.album_enabled`, the event's own Album switch, on for every event. "Who can see the guest
  list" and the Comments checkbox have moved from the editor's Settings sheet to Arrange, as the
  switches of Who's coming and the Comments; "Only the hosts" is now Who's coming switched off.
  Each event keeps what it had.

No new environment variable is required (`RATE_LIMIT_VOTE` is optional), and `compose.yaml` gains
no service.

### Upgrading to 0.7

0.7 brings videos to the album, every upload and storage limit onto Site settings, a Storage card
that says how full the site is, and ways to clear albums: hosts empty their own and are reminded
to, and the operator can clear any. Upgrading needs nothing of you: eight migrations, `0046` to
`0053`, run as the app starts. They add columns, tables and enum values only, so nothing is
back-filled and no existing event changes until its host chooses:

- **The image is about 130 MB larger** (368 MB against 235 MB), because it carries ffmpeg, which
  processes videos ([ADR-0007](../adr/0007-ffmpeg-in-the-image.md)). Processing a clip takes
  about 300 MB of memory while it runs, one clip at a time.
- **Sizes are measured once, in the background,** after the first start: photos and pictures from
  before 0.7 have no recorded size, so the app reads each file's size while it answers requests,
  and the Storage card says how many are still to be measured until it is done. A photo from
  before counts the size of the file the site stored, since the file as sent was never kept.
- **`MAX_UPLOAD_MB` is retired.** At the first start its value is read once into **Largest
  photo** on Site settings, and the variable is ignored from then on; a site that never set it
  starts at 40 MB, where it had 10. Every other new limit starts at its default: Largest video
  750 MB, Longest video 15 minutes, Storage per event and for the site 50 GB each, and hosts
  reminded about albums after 60 days.
- **Existing events have no album reminder,** and take videos as new events do, at the site's
  caps and with the lighter copy at 1080p; every other setting stays as events behaved before.
- **Two new emails, with mail configured** ([configuration.md](configuration.md#mail)): the album
  reminder to an event's hosts on the day they chose, and the hosts' email when the operator
  clears their album. The hosts' email about items awaiting approval now names videos too.

No new environment variable is required. `VIDEO_PROCESSING` is optional, and `compose.yaml` gains
no service unless you add the worker it describes in a comment.

### Upgrading to 0.6

0.6 adds invite-only events, personal letters and invitations emailed from the invite list, a
choice of who sees an event's album with photos approved before they show, and a schedule on the
event page that follows the clock. Upgrading needs nothing of you: three migrations, `0043` to
`0045`, run as the app starts. They add tables and columns only, so nothing is back-filled and no
existing event changes until its host chooses:

- **Every new setting starts as events behaved before.** Invite-only is off and so are personal
  letters. The album is seen by every guest who replied, as before, and photos show without
  approval; every photo already in an album counts as approved. "Email the hosts when photos need
  approval" is on, but sends nothing until a host turns approval on. A schedule is refreshed on
  guests' open pages every minute while the event is on, and an event has none until its host
  lists one.
- **Three new emails, all with mail configured** ([configuration.md](configuration.md#mail)): the
  invitation a host sends from the invite list, with their letter and the guest's personal invite
  link and a stop link; the code an invited guest asks for on an invite-only event's locked page;
  and the hosts' email when a guest's photos wait for their approval. The first two count against
  `RATE_LIMIT_MAIL`, as the other emails a request sends do; the third comes from an upload, which
  `RATE_LIMIT_UPLOAD` bounds. Personal invite links, which the 0.4 note says the app never emails,
  can now be emailed by the host.
- **Photos per event counts the photos awaiting approval** too, so a host approving photos cannot
  take an album past your limit.
- **Without mail, an invite-only event opens only to its hosts and to the guests invited without
  an email**, by their personal invite links: nobody else can be sent the code. The Invites page
  tells hosts so.

There are no new environment variables and `compose.yaml` gains no service.

### Upgrading to 0.5

0.5 redesigns how events are made and shown, and adds reactions, date polls, a photo album and
passkeys. Upgrading needs nothing of you: the migrations run as the app starts, as before.

- **New event opens the invitation itself.** The 0.4 form and manage page are gone: a host types
  the title on the poster, fills in When, Where and About from small sheets, and designs it from
  the toolbar under it (Poster, Title, Theme, Effect, Settings). Every change saves as it is made.
  The manage page's links (guests, share, hosts, invites, announcements, duplicate, cancel,
  delete) are under **More** in the editor's top bar.
- **Templates became gallery posters.** Every event's theme is read into a poster when it is
  shown; nothing is rewritten in the database. An event on a 0.4 template wears that template's
  poster (Birthday becomes Candles, Vows Rose garden, Supper club Candlelight, Kids' party
  Balloons, Festival Aurora, Quiet Bokeh), with its look; an event on a background colour keeps
  it, now as a colour poster; a host's picture is the poster as before.
- **The guest page puts the poster first.** Going, Maybe and Can't go sit in a bar at the foot of
  the screen. Broadsheet and Thread are still there.
- **The dashboard and the header are new.** A host's events show as their posters, the next one
  first. The header's account menu, under the host's initials, holds Account, Sign out and, for
  you, **Site settings**: the page that was Instance settings, still at `/instance`. The interface
  says "site" where these docs say "instance".
- **Drafts may have no date.** A new event is a blank draft until its host dates it, and a date
  poll's event is published without one until the host picks the date. Reminders and retention
  pass over an event without a date.
- **Passkeys** need the instance on HTTPS and a stable `BASE_URL`
  ([configuration.md](configuration.md#passkeys)); on plain HTTP the account page says so and the
  sign-in page offers none.
- **The photo album** keeps its photos through the storage you configured, beside the posters, so
  a backup of the uploads covers them ([Backups](#backups)). The Limits card gains **Photos per
  event** (300).
- **The home page is an invitation to your instance.** It says "OpenInvites" with a default welcome
  line until you name it on the new **Home page** card of Site settings
  ([configuration.md](configuration.md#the-home-page)), and offers **Create an account** only
  while registration is Open. The welcome new operators see on their dashboard is not shown to
  the operator an upgraded instance already has.

There are no new environment variables and `compose.yaml` gains no service.

### Upgrading to 0.4

0.4 adds the operator's limits and reports, custom links, guests' phone numbers and emails proven
by a code, capacity and the waitlist, approval, personal invite links, an optional bot check, and
retention. Read the first point before you upgrade: it is the one change that deletes anything.

- **Events are now deleted a year after they end, and the first deletions come 30 days after the
  upgrade** ([configuration.md](configuration.md#retention)). A minute after the upgraded app
  starts, its first check marks every event that ended more than 335 days ago. With mail, each
  marked event's hosts, co-hosts included, are emailed once, with the day it will be deleted;
  with mail or without, the day shows on its manage page and on their dashboard. Nothing is
  deleted for 30 days after that. Then each event older than the period goes, with its guest list
  and everything else about it, at the first hourly check after its day, so up to an hour late,
  never early. Its links stay retired.
  - **To keep every event**, sign in as the operator as soon as the upgraded app answers, and in
    Site settings, under **Limits**, tick **Keep forever** and save. The first check runs a
    minute after the start, so the hosts of old events may already have been emailed by then;
    once Keep forever is saved their events' marks are cleared, their pages say nothing more, and
    nothing is deleted.
  - **To keep events longer, or less long**, set **Keep events for** in the same place, from 30 to
    3,650 days, then save. A mark already made is taken off an event the new period no longer
    brings within 30 days of deletion.
  - On an instance with mail and many old events, the first check queues all its warnings at once,
    and mail goes out in the order it was queued, so the emails queued after them (hosts' reply
    emails, announcements, reminders) wait until they have gone.
- **The email field's new shape.** The event form's "Ask guests for an email address" is now
  **Email**, under **Contact details**: **Don't ask**, **Optional** or **Required**, beside a new
  **Phone number** with the same choices, and **Check the email with a code**. An event that asked
  for an email asks for it as Optional; one that did not, Don't ask. Nothing a guest gave changes.
- **Custom links.** A host can give an event a custom link, such as `/e/adas-50th`, on its share
  screen, beside its random link, which keeps working. Existing events have none until their host
  adds one.
- **The guest list's new sections**: Waiting for approval and Declined appear once the event asks
  for approval or has a reply in them, Waitlist once it has a capacity or a guest waiting, and
  Invited once it has a personal invite link. A personal invite link is one the host makes for a
  named guest and sends them themselves: the instance never emails it, it becomes the guest's
  edit link once they reply, and deleting it keeps their reply.
- **The limits apply at once, to what exists too.** A host who already owns 50 events or more
  cannot create or duplicate another, and an event that already has 500 replies takes no new guest
  (those who replied can still change or withdraw theirs). If a host or an event is past them, raise
  **Events per host** or **Replies per event** in Site settings first.
- **Nothing else changes on existing events.** None has a capacity or asks for approval, and every
  existing reply stays on the guest list as it was, approved.

The settings page (Site settings since 0.5) gains the **Limits** card (Events per host, 50; Replies per event, 500;
Keep events for, 365 days) and a link to the **Reports** page; with mail, each report is also
emailed to your operator account. There are three new settings, all optional:
`TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`, which put Cloudflare's bot check on the sign-up,
RSVP and report forms when both are set ([configuration.md](configuration.md#bot-protection)), and
`RATE_LIMIT_REPORT` ([configuration.md](configuration.md#rate-limits)). `compose.yaml` gains no
service. If you have published a privacy policy, it may now need to mention guests' phone numbers,
how long events are kept, that reports reach you and are kept, and the bot check if you turn it
on: the placeholder OpenInvites shows at `/privacy` while no policy is set, in the repository's
`src/legal/placeholders.ts`, covers each.

### Upgrading to 0.3

0.3 adds comments, co-hosts, announcements, reminders, and the emails that go with them
([configuration.md](configuration.md#mail)). On events that already exist, nothing on the page
changes until their host chooses:

- **Comments, reminders, and the hosts' reply and comment emails start off on events that exist
  before the upgrade**, and on for every event created after it. A host turns them on in the
  event's settings, opened from their dashboard: **Comments**, **Remind guests by email**, **Email
  the hosts when a guest replies** and **Email the hosts when a guest comments**, then **Save
  changes**. The two email switches are the event's, so they turn the emails on or off for every
  host of the event at once.
- **Guests who gave an email before the upgrade can be emailed**: the cancellation notice, the
  host's announcements, and reminders once the host turns them on. Each email ends with the link
  that stops email about the event. Until a guest next saves their RSVP their email is in English,
  since the language they replied in was not recorded before.
- **A reminder goes out only within a day of its time**, a week before the start for Maybe and a
  day before for Going, so turning reminders on, or setting up mail, more than a day after a
  reminder's time sends none: less than six days before an event, no "in a week" reminder goes,
  though the day reminder can still go during the event's last day. An existing event counts as
  published when it was last changed, which can only make a reminder less likely to go.
- **Existing events show no effect until their host picks one.** Effects are new in 0.3:
  Birthday, where every event starts, and Vows sparkle, Festival has floating shapes, and Kids'
  party's confetti falls when a guest says Going. The upgrade sets every existing event to no
  effect, and since its theme then no longer matches its template, the Design drawer reads it as
  "Custom, started from" that template (Quiet and Supper club have no effect, so their events are
  left as they were). The host picks an effect under **Effect**, in the Design drawer's
  **Details**, or chooses the template again. A guest whose device asks for reduced motion sees
  no effect at all.
- Existing events keep the Poster layout; the Design drawer now offers Broadsheet and Thread too.

With mail configured, a host can now have the instance email any addresses they type in, by
replying to their own event with them and then posting an announcement. Only `RATE_LIMIT_RSVP` and
`RATE_LIMIT_MAIL` bound it, per client address. With registration Invitation only, the default,
that is limited to hosts you admitted; if your instance's registration is Open, read
[configuration.md](configuration.md#mail) first.

The app sends event mail itself, from a queue in its own container, so `compose.yaml` gains no
service. There is one new setting, `RATE_LIMIT_COMMENT` ([configuration.md](configuration.md#rate-limits)),
with a default that suits most instances.

## Backups

An instance is four things:

| What | Where | How to keep it |
| --- | --- | --- |
| The database: hosts, events, RSVPs, answers, settings | The `db-data` volume | A dump, below. Copying the volume's files while Postgres runs is not a backup. |
| Hosts' pictures and the albums' photos | The `uploads` volume, or the bucket with `STORAGE_BACKEND=s3` | An archive of the volume, below, or the provider's own tools for the bucket (versioning, replication, `rclone sync`). |
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

Keep the dumps as private as the instance itself. Besides every host's and guest's details, a dump
holds the edit links of the replies made through personal invite links: an invite's token is
stored as it is, so whoever has a copy of the database can open those replies and change them.

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
sign-in page; setting the new password signs them out on every device. Without mail, the
operator does it from inside the container:

```sh
docker compose exec app node scripts/reset-password.mjs host@example.org
```

It prints a temporary password for you to pass on, and signs the host out everywhere, so
nobody else who was signed in to their account stays signed in:

```
Temporary password for Sam <host@example.org>: 7kqv4mxe2nhw9pta
They have been signed out everywhere. Ask them to sign in with it and change it in account settings.
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
- **Pictures nobody points to.** A host's picture is six files (`<id>-background.webp`,
  `<id>-background-portrait.webp`, `<id>-poster.webp`, `<id>-poster-720.webp`,
  `<id>-poster-copy.webp`, `<id>-card.jpg`). If the app stops in the middle of an upload, or cannot
  remove a replaced or deleted picture's files (it logs that and carries on), files can be left
  in storage that no event uses. Nothing sweeps them up. They cost only space; the `upload`
  table lists the ids still in use (`docker compose exec db psql -U openinvites -d openinvites
  -c 'select id from upload'`), and a file whose id is not there can be deleted.
- **Postgres.** It is reachable only from the app, on the Compose network. For a look inside:
  `docker compose exec db psql -U openinvites -d openinvites`.
