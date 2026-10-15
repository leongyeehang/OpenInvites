# OpenInvites 0.3.0

Draft of the GitHub release note for tag v0.3.0, written 2026-10-09 in the shape of the 0.2.0 note. For the maintainer to review and paste when cutting the release (docs/releasing.md). The links assume the tag exists.

---

**Take a backup before upgrading.** 0.3.0 is the first release since 0.1.0 that changes the database: nine migrations, which the app applies when it starts, before it reports healthy. Going back to 0.2.0 after that is not supported; restore the backup instead ([docs/operator/upgrade-backup.md](https://github.com/leongyeehang/OpenInvites/blob/v0.3.0/docs/operator/upgrade-backup.md)).

Nothing on an event that already exists changes until its host chooses. The new emails, comments and reminders start off on those events, their effect is set to none, and they keep the Poster layout. The details are under [Upgrading to 0.3](https://github.com/leongyeehang/OpenInvites/blob/v0.3.0/docs/operator/upgrade-backup.md#upgrading-to-03).

## What changed

0.3 is the social layer: what happens after a guest replies.

For hosts:

- The hosts are emailed when a guest replies, changes their answer or removes their RSVP, and when someone comments on the page. Each is a switch in the event's settings, shared by every host of the event.
- Announcements: a host posts one on the event page and emails it to the guests they choose by answer. An announcements page lists them with when they went out, and deletes one. "Send a reminder now" drafts a reminder as an announcement.
- Automatic reminders: guests who gave an email are reminded a week before the event if they said Maybe and the day before if they said Going, unless the host turns reminders off for the event.
- Guests who gave an email are told when the host cancels the event.
- Co-hosts: a host makes a co-host link, and whoever accepts it while signed in manages the event with them, short of deleting it or changing the co-hosts. The page names every host.
- Comments: guests who have replied, and the hosts, comment on the event page. A guest who has not replied sees how many there are. Guests delete their own, hosts delete any, and a host can turn comments off for the event.
- Sign in with a link emailed to you, on an instance with mail.
- Multiple-choice questions, where a guest may pick several options.
- Duplicate an event into a new draft with the same details, look, questions, settings and picture.
- The host sees how often the event page was opened by people other than its hosts, link previews fetched by chat apps included.
- Effects: confetti when a guest says Going, gentle sparkles, doodles, or none. Every effect stops under reduced motion.
- The Broadsheet and Thread layouts, in the Design drawer. Supper club and Kids' party now apply with their own layouts.
- Two more backgrounds made from the host's own picture: a soft blur and a colour wash.

For guests:

- Every email about an event says why it was sent and ends with a link that stops email about that event in one tap. It is in the language the guest replied in, and a reminder carries the time in the event's zone, the location, the event link and the guest's own reply.
- A guest gives an email only when the host asks for one on the RSVP form, so only those guests get mail.

Everything new reads in Simplified and Traditional Chinese.

For operators:

- The app sends event mail from a queue in its own container, so there is nothing else to run: `compose.yaml` gains no service.
- One new setting, `RATE_LIMIT_COMMENT` (default `30/10m`), bounds posting and deleting comments. `RATE_LIMIT_MAIL` now also counts sign-in links and each announcement a host emails ([Rate limits](https://github.com/leongyeehang/OpenInvites/blob/v0.3.0/docs/operator/configuration.md#rate-limits)).
- With mail configured, a host can have the instance email any address they type into their own RSVP form and then announce to. With registration Invitation only, the default, those hosts are people you admitted; if your instance's registration is Open, read [Mail](https://github.com/leongyeehang/OpenInvites/blob/v0.3.0/docs/operator/configuration.md#mail) before upgrading.
- The page-open count is kept in your database and sent nowhere; it is the one thing the instance counts itself.
- The placeholder privacy policy now covers comments, what a guest's email is used for, co-hosts and the page-open count. If you set `PRIVACY_POLICY_FILE` or `PRIVACY_POLICY_MARKDOWN`, cover the same in your own.

## Upgrading

Of the deployment files, `.env.example` changed (the new `RATE_LIMIT_COMMENT` line and the comment above `RATE_LIMIT_MAIL`); `compose.yaml` and `Caddyfile` are unchanged. Your `.env` works as it is. Take a backup, then upgrade as usual ([docs/operator/upgrade-backup.md](https://github.com/leongyeehang/OpenInvites/blob/v0.3.0/docs/operator/upgrade-backup.md)); the app is healthy once the migrations have run.

The image is `ghcr.io/leongyeehang/openinvites:0.3.0`. With `OPENINVITES_IMAGE` ending in `:latest`, `docker compose pull` gets it. An instance pinned to `:0.2` or `:0.2.0` stays on 0.2.0 until you change it to `:0.3`.
