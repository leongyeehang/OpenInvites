# 04: Album: the hosts are emailed when photos wait for their approval

**What to build:** When a guest's upload leaves photos pending, the hosts get one email per upload, under the "Email the hosts when photos need approval" setting ticket 03 added.

**Blocked by:** 03 The host chooses who sees the album, and may approve photos before they show

**Status:** done

- [x] `src/album/notify-hosts.ts`: `notifyHostsOfPhotos(event: Pick<Event, "id" | "slug" | "customSlug" | "title" | "notifyOnPhoto" | "locale">, posted: { name: string; count: number })`, a copy of `src/comments/notify-hosts.ts:15–33`: guards the flag and `isMailConfigured()`, writes `Mail.photos` in `event.locale`, lists `eventHosts`, `queueMail`, `after(kickMailWorker)` (allowed in Route Handlers: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`), never throws. No actor filter: a host's uploads are never pending.
- [x] `src/app/api/albums/[slug]/route.ts`: after `addPhotos` succeeds with `status === "pending"` and at least one photo stored, call it once per post with the guest's name (extend the guest viewer with `name`, or look it up).
- [x] Messages `Mail.photos.{subject,body}` in all three files: "{name} added {count, plural, one {a photo} other {# photos}} to {title} for your approval", the event link, a footer naming the setting. `docs/operator/configuration.md`: the email among what mail sends.
- [x] Browser (`e2e/album-settings.spec.ts`): approval and notify on, a guest adds two photos → one email in Mailpit (`latestMailTo` / `mailCountTo`, `e2e/hosts.ts:91–98`) with the subject, the link and the footer; with notify off, none.

## Notes for the implementer

- Commit subject, e.g. `Album: the hosts are emailed when photos wait for their approval`.

## Comments

**2026-11-07, implementing agent.** Done. `src/album/notify-hosts.ts` (`notifyHostsOfPhotos`, the comment sender's shape: the flag and `isMailConfigured()` first, `Mail.photos` in the event's language, every host from `eventHosts`, `queueMail`, `after(kickMailWorker)`, errors logged and never thrown); the upload route calls it once per post; `Mail.photos.{subject,body}` in the three locales; the operator doc's line. `pnpm lint`, `pnpm typecheck` and `pnpm test` (86 files, 916 tests) pass.

How it landed:
- The guest's name comes from the viewer: `AlbumViewer`'s guest branch gains `name` (from `mine.rsvp.name`, `album/viewer.ts`), so the route asks nothing more. The unit tests' guest viewers carry a name for the type; no rule reads it.
- The route calls the sender after `addPhotos` succeeds and the paths are revalidated, only when the status stored under the lock is `pending` (which only a guest's is) with the count of photos stored, not of files sent: a file refused by the pipeline is not counted. It is awaited, as the comment action awaits its own; it never throws, so the guest's per-file lines are unchanged whatever mail does.
- The body: "{name} added {a photo | N photos} to {title} for your approval.", then "The event page:" and the link (where the hosts approve), then the footer naming "Email the hosts when photos need approval", as the comment email's. Chinese has one plural form ("# 张照片" / "# 張照片").
- No pure rule was added, so no unit test: whether to send is the route's `pending` and the sender's two guards, as for comments; the browser test covers each case.

Things to know:
- `notifyOnPhoto`, the title and the language are read from the event as the request found it, not under the lock that decides the status. A host turning the email off during the seconds an upload is processed may still get that one email; the status race ticket 03 fixed was about who sees photos, this one only about a mail.

Left for later tickets: nothing in this ticket. The no-mail instance is not exercised for this email (the guard is the one every host mail uses).

Evidence: against the Docker test profile rebuilt with the change, `CI=1 pnpm exec playwright test e2e/album-settings.spec.ts --workers=2`: 15 passed (mobile and desktop), among them the new row: with approval on, Priya's two photos bring one email ("Priya Nair added 2 photos to Ada’s garden party for your approval", the event link, the footer; three emails in all with the verification and her reply's), the host's own photo none, and with the email turned off Priya's next photo none (the email about Mei's reply, queued after it, arrives and the count is 4). `e2e/album.spec.ts`: 7 passed.
