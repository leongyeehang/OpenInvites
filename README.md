# OpenInvites

Invitations you host yourself. A host makes an event page that looks like an invitation and shares its link. Guests open it on their phone and reply, with no account and no app. The host watches the guest list fill up.

OpenInvites is open source and made to be self-hosted: one Compose file runs it on a small server or a Raspberry Pi. It sends nothing to the project or to anyone else.

<p>
  <img src="docs/screenshots/home.webp" width="200" alt="An instance’s home page on a phone: “Orchard Lane Supper Club” in a serif title on the Candlelight poster, its welcome line, a card on how the site works for guests and hosts, and Create an account and Sign in at the foot of the screen.">
  <img src="docs/screenshots/event-birthday.webp" width="200" alt="An invitation to Mei’s 30th on a phone: a large serif title over a golden-hour gradient with sparkles, three buttons for Going, Maybe and Can’t go, and the date and place on frosted glass.">
  <img src="docs/screenshots/rsvp-sheet.webp" width="200" alt="A guest replying in a sheet that has risen over the invitation, bringing one guest, named Leo.">
  <img src="docs/screenshots/album.webp" width="200" alt="The photo album of a picnic that has happened: a grid of six pictures, with Add photos under it.">
</p>
<p>
  <img src="docs/screenshots/dashboard.webp" width="200" alt="A host’s dashboard on a phone: Mei’s 30th as Next up, its poster with the title on it, its date, how many are going, maybe and can’t go, and Guests, Edit and Share.">
  <img src="docs/screenshots/editor.webp" width="200" alt="A host editing a night-market invitation on their phone: the invitation itself, with its title on an aurora poster, the When row, and a toolbar of Poster, Title, Theme, Effect and Settings.">
  <img src="docs/screenshots/poster-sheet.webp" width="200" alt="The Poster sheet risen over a live, half-size copy of the invitation: tabs for Gallery, Emoji, Colour and Upload, occasions, and the gallery’s posters.">
  <img src="docs/screenshots/event-festival.webp" width="200" alt="The night-market invitation as a guest sees it: a heavy grotesque title over the Aurora poster, with floating shapes, and the reply buttons at the foot of the screen.">
</p>
<p>
  <img src="docs/screenshots/editor-desktop.webp" width="760" alt="The editor on a desktop: the invitation in the middle, its toolbar under it, and the Poster sheet as a panel down the right.">
</p>
<p>
  <img src="docs/screenshots/guest-list.webp" width="760" alt="The host’s guest list: seven people expected, grouped under Going, Maybe and Can’t go, with plus-ones and reply times.">
</p>

## What it does

- **The invitation is the editor.** New event opens a blank invitation: the host types the title on the poster, fills in When, Where and About from small sheets, and every change saves as it is made. A toolbar under it opens the Poster, Title, Theme, Effect and Settings sheets over a live copy of the invitation, or beside it on a desktop.
- **Event pages worth opening.** Twenty ready-made posters for the usual occasions, each bringing a look to suit it, an emoji pattern, nine colours, or the host's own photo or poster; three layouts (a poster, an editorial page, or a chat with the host), four title fonts, an accent colour, and an effect. Whatever the host picks, the text stays readable.
- **Replies without an account.** Guests answer Going, Maybe or Can't go, bring plus-ones, answer the host's questions, and change their answer later from the same phone or a private edit link. They can add the event to their calendar, open the place in their maps, and once they have replied, talk with the host and each other in the comments, react to a comment with an emoji, and from the start of the event add their photos to its album. The host chooses who sees the album (every guest who replied, only those going, or only the hosts) and can approve each photo before it shows, emailed when photos are waiting; meanwhile a guest sees their own, marked as awaiting approval. A host who has not fixed a date can let guests vote on two to six, and pick one. A host can ask for an email, checked with a code, or a phone number.
- **Photos and videos, with room kept in hand.** Guests add videos as they add photos. Each is kept at its original size, with the phone's location and device details dropped. Copies are made at the sizes the host ticks, 1080p and 720p, and 4K when the operator chooses, and the player's Auto picks the size for the screen and steps down when the connection stalls, while any size, the original included, can be picked. An Android motion photo becomes a live photo, whose few seconds play when it is pressed. Whoever adds a photo or video, and any host, can caption it. A host can put the album to a vote, in up to eight awards of their naming, by every guest who sees it, only those going, or only those invited personally, with the counts, and if the host likes who added each item, hidden until it closes; then the winners head the album and go out as an announcement, and a tie for first can go to a tie-break. A host can keep when each item was taken and with what camera, shown under it and able to order the album; where it was taken is never read. A clip over the event's caps is refused before a byte is sent, and an upload picks up where it dropped. Every limit is on Site settings and takes effect at once: the largest photo and video, the longest video, and the storage an event and the site may use, counted as uploaded. A Storage card shows how full the site is and its biggest albums. Nothing is deleted on a timer: hosts empty an album in one confirmed step and are reminded to on the day they chose, by email and on their pages; the operator can clear any album, and find and remove stray files.
- **Invitations for the people you name.** The host keeps an invite list, typed in or pasted one person per line as name, email and phone, and each person gets a personal invite link that fills in their name, email and phone and ties their reply to it. With personal letters on, the host writes a few lines to each, shown on their invitation above the details and in their invitation email. Where the site can send email, it emails the invitation, with the letter and the link, to anyone on the list with an email, one at a time or everyone not yet sent; or the host shares the link from their phone. An event can be **invite-only**: it then opens only to the people on its invite list, and anyone else with the link sees a page with nothing on it but the host's name. A guest invited with an email proves it with a six-digit code sent to it, once on each new device; a guest invited with only a phone number or a name gets in by their personal link alone, and the Invites page marks those rows. On a site that cannot send email, only those can get in. Turning invite-only on adds everyone who has already replied to the list, so nobody is locked out.
- **The day, as it happens.** The host lists the schedule: each item a time and a title, and if they like an end, a place and a note, changed at any time, even during the event. The event page follows the clock, greying what has ended and marking what is on now. Guests' open pages pick up a change within a minute; "Only when the page is opened" makes no background requests at all, which saves guests' data and battery and keeps the site quiet, and suits a schedule that won't change on the day or a large crowd.
- **A guest list that keeps itself.** The host sees who is coming and the headcount as replies arrive, is emailed as they do, and chooses whether guests see the list. Announcements go on the page and to guests' inboxes, guests who gave an email are reminded before the event, and co-hosts can share the work. A capacity puts later guests on a waitlist that moves up by itself, and the host can approve each guest before they are on the list. The link, or a custom one such as `/e/adas-50th`, can be shared, shown as a QR code, and unfurls into a preview card.
- **An instance you run.** Its address opens on an invitation to it: a gallery poster, the name and welcome line the operator gives it, and the way in, with Create an account only when anyone may sign up. The first account becomes the operator, who is shown once where to start and decides whether anyone may sign up or only the hosts they invite. Email and password sign-in, a passkey, or a link by email, with Google and GitHub when configured. The operator sets how many events a host may have, how many replies an event may take, how many photos and videos its album may hold and how large they may be, how much storage an event and the site may use, and when hosts are reminded about their albums; reads visitors' reports about event pages; and decides how long events are kept once they end, a year unless changed. Cloudflare Turnstile can guard sign-up, replies and reports when its keys are set. Pages in English, Simplified Chinese and Traditional Chinese, following each visitor's browser.

## Run it locally

You need [Git](https://git-scm.com/), [Node.js](https://nodejs.org/) 22, [pnpm](https://pnpm.io/) 10, and [Docker](https://docs.docker.com/get-docker/) with Compose. `corepack enable` gives you the pnpm version the repository names (you may need `sudo`); `npm install --global pnpm@10` works too.

```sh
git clone https://github.com/leongyeehang/OpenInvites.git
cd OpenInvites
pnpm install
pnpm dev
```

`pnpm install` may end by saying it ignored the build scripts of a few packages: nothing here needs them. `pnpm dev` starts Postgres 18 and [Mailpit](https://mailpit.axllent.org/), a fake mail server that catches every email the app sends (their images are downloaded the first time), then starts the app, which brings its database up to date before it answers the first request. It needs ports 3000, 5432, 1025 and 8025 free.

1. Open <http://localhost:3000> and choose **Create the operator account**. The first account on a new instance becomes its operator, and its dashboard opens on a welcome that points to Site settings, in the menu under your initials.
2. Open Mailpit at <http://localhost:8025> and follow the link in **Verify your email for OpenInvites**.
3. On your dashboard, choose **New event**: the invitation opens as its own editor. Type a title on the poster, tap **When** to give it a date, and **Publish** it. The toolbar under it opens the Poster sheet in the screenshot above.

Stop it with Ctrl-C, then `docker compose --profile dev down` to stop the containers (add `-v` to delete the database).

## Run an instance

The deployment package in [`deploy/`](deploy/) runs the published image with Postgres and [Caddy](https://caddyserver.com/) for automatic HTTPS, on amd64 or arm64:

- [Installing an instance](docs/operator/install.md): from a fresh machine to a running instance with HTTPS.
- [Configuring an instance](docs/operator/configuration.md): every setting, including mail, Google and GitHub sign-in, S3 storage, rate limits, and the privacy and terms pages.
- [Upgrading, backups, and operations](docs/operator/upgrade-backup.md): upgrades, backup and restore, and resetting a host's password.

## Contribute

Bug reports, ideas, translations, posters, and code are all welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the development setup, the tests, how issues and pull requests work, and the sign-off every commit carries. New posters, colours and languages are data, with a guide each in [`docs/contributing/`](docs/contributing/). Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

## Licence

OpenInvites is free software under the [GNU Affero General Public License](LICENSE), version 3 or (at your option) any later version (`AGPL-3.0-or-later`). If you run a modified version for others, the licence asks you to offer them its source.
