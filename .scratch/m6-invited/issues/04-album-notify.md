# 04: Album: the hosts are emailed when photos wait for their approval

**What to build:** When a guest's upload leaves photos pending, the hosts get one email per upload, under the "Email the hosts when photos need approval" setting ticket 03 added.

**Blocked by:** 03 The host chooses who sees the album, and may approve photos before they show

**Status:** ready-for-agent

- [ ] `src/album/notify-hosts.ts`: `notifyHostsOfPhotos(event: Pick<Event, "id" | "slug" | "customSlug" | "title" | "notifyOnPhoto" | "locale">, posted: { name: string; count: number })`, a copy of `src/comments/notify-hosts.ts:15–33`: guards the flag and `isMailConfigured()`, writes `Mail.photos` in `event.locale`, lists `eventHosts`, `queueMail`, `after(kickMailWorker)` (allowed in Route Handlers: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`), never throws. No actor filter: a host's uploads are never pending.
- [ ] `src/app/api/albums/[slug]/route.ts`: after `addPhotos` succeeds with `status === "pending"` and at least one photo stored, call it once per post with the guest's name (extend the guest viewer with `name`, or look it up).
- [ ] Messages `Mail.photos.{subject,body}` in all three files: "{name} added {count, plural, one {a photo} other {# photos}} to {title} for your approval", the event link, a footer naming the setting. `docs/operator/configuration.md`: the email among what mail sends.
- [ ] Browser (`e2e/album-settings.spec.ts`): approval and notify on, a guest adds two photos → one email in Mailpit (`latestMailTo` / `mailCountTo`, `e2e/hosts.ts:91–98`) with the subject, the link and the footer; with notify off, none.

## Notes for the implementer

- Commit subject, e.g. `Album: the hosts are emailed when photos wait for their approval`.

## Comments
