# OpenInvites 0.4.0

Draft of the GitHub release note for tag v0.4.0, written 2026-10-14 in the shape of the 0.3.0 note. For the maintainer to review and paste when cutting the release (docs/releasing.md). The links assume the tag exists.

---

**Take a backup before upgrading, and read the first paragraph before you do.** 0.4.0 applies twelve migrations when it starts, before it reports healthy; going back to 0.3.0 after that is not supported, restore the backup instead ([docs/operator/upgrade-backup.md](https://github.com/leongyeehang/OpenInvites/blob/v0.4.0/docs/operator/upgrade-backup.md)).

**0.4 deletes old events.** From this release an instance keeps each event for a year after it ends, then deletes it with its guest list, comments, announcements, invites and picture. One minute after the upgraded app starts, every event that ended more than 335 days ago is marked, and, if the instance has mail, each of its hosts is emailed once: the event's title, the day it will be deleted, and that Duplicate keeps the details. Nothing is deleted for 30 days after that mark, so you have a month. If you want to keep everything, open Instance settings, Limits, and tick **Keep forever** right after the first start; the marks are cleared and nothing goes. The same card sets a shorter or longer period, 30 to 3650 days. The details are under [Upgrading to 0.4](https://github.com/leongyeehang/OpenInvites/blob/v0.4.0/docs/operator/upgrade-backup.md#upgrading-to-04).

Two limits also apply at once: a host may own at most 50 events and an event may take at most 500 replies, both set on the same Limits card. A host or event already past a limit keeps what it has but cannot add; raise the limit first if that is not what you want. Nothing else changes on an existing event: none has a capacity or asks for approval, and every existing reply stays on the guest list as it was.

## What changed

0.4 is control: who gets in, how many, and what the instance does on its own.

For hosts:

- Capacity: a number of places for the event, counting guests and their plus-ones. Once it is reached, a Going reply joins the waitlist in the order received and the guest sees their place in it. When a place opens, the party at the front is moved to Going as soon as it fits and emailed; a larger party at the front is not skipped, and the host can move anyone up by hand. The waitlist is never shown to guests.
- Approval: a host can approve each reply before the guest is on the list. A waiting guest sees the invitation and their own reply but not the comments, and the guest list only as any visitor would; the hosts are emailed that someone waits, and the guest is emailed when approved. Declining keeps the reply off the list.
- Personal invite links: a host makes a link for a named guest, with their email if the host has it. Opening it fills in their details, and the email counts as checked. The reply is tied to the link, which then works as the guest's edit link, and the host's invites page shows who opened and who replied. The instance never emails these links; the host sends them.
- A custom link: a memorable address like `/e/adas-50th` beside the random one, which stays the one known only to those it was shared with. A reset or the event's deletion retires it for good.
- Contact details: the email can be Don't ask, Optional or Required, and a phone number can be asked for the same way. An email can be checked with a six-digit code the guest reads from their inbox before the reply is kept; the host's list shows a tick beside a checked email.
- Report this event: every event page carries a link for a visitor to tell the operator the page is wrong or abusive.

For guests:

- A reply through a personal invite link is one tap fewer: the name and email are filled in.
- On a full event the page says so and offers the waitlist; on an event that needs approval it says the reply is waiting. A guest who gives an email is told when a place opens or when they are approved, in the language they replied in, with the stop link as before.
- A phone number, when the host asks for one, is seen only by the hosts.

Everything new reads in Simplified and Traditional Chinese.

For operators:

- Limits and retention on the instance settings page: events per host, replies per event, and how long events are kept, with Keep forever.
- A Reports page lists what visitors reported, newest unhandled first, with the event's link and a delete; with mail, each report is also emailed to you (`RATE_LIMIT_REPORT`, default `5/1h`, bounds sending them).
- Optional Cloudflare Turnstile: set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` and a bot check guards the email sign-up form, the RSVP form and the report form; every reply is checked before anything else happens with it. Without the keys nothing changes and nothing loads from Cloudflare. The widget talks to Cloudflare from each visitor's browser; say so in your privacy policy ([Bot protection](https://github.com/leongyeehang/OpenInvites/blob/v0.4.0/docs/operator/configuration.md#bot-protection)).
- The mail worker is now the instance's clock and runs whether or not the instance has mail, so retention works on an instance without mail: the warning then shows on the event's manage page and the dashboard only.
- The placeholder privacy policy now covers phone numbers, the retention period, reports to the operator, the optional bot check, and that a retired custom link may carry a name. If you set `PRIVACY_POLICY_FILE` or `PRIVACY_POLICY_MARKDOWN`, cover the same in your own.
- A copy of the database holds the edit links of replies made through personal invite links, as it holds every other edit link's hash; the backup note says so ([Backups](https://github.com/leongyeehang/OpenInvites/blob/v0.4.0/docs/operator/upgrade-backup.md)).

## Upgrading

Of the deployment files, `.env.example` changed (the two Turnstile keys, `RATE_LIMIT_REPORT`, and the comments above `RATE_LIMIT_EVENT_PAGE`, `RATE_LIMIT_RSVP` and `RATE_LIMIT_MAIL`); `compose.yaml` and `Caddyfile` are unchanged. Your `.env` works as it is. Take a backup, decide about **Keep forever**, then upgrade as usual; the app is healthy once the migrations have run, and the first retention check runs a minute later.

The image is `ghcr.io/leongyeehang/openinvites:0.4.0`. With `OPENINVITES_IMAGE` ending in `:latest`, `docker compose pull` gets it. An instance pinned to `:0.3` or `:0.3.0` stays on 0.3.0 until you change it to `:0.4`.
