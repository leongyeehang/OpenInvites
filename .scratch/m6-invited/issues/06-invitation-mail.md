# 06: Invites: the host emails the invitation, and shares the link

**What to build:** The app emails the invitation (title, when, where, the letter, the personal link) to an invitee with an email, one at a time or everyone not yet sent, through the outbox with a stop link; a Share button offers the personal link to the device's share sheet.

**Blocked by:** 05 A phone, a letter and a pasted list for each guest

**Status:** ready-for-agent

- [ ] `src/invites/invitation-mail.ts` (copy `src/rsvps/promotion-mail.ts`): `invitationMail(event, invite: { name; letter }, hostName, t)` → the subject `Mail.invitation.subject` ("{host} invited you to {title}") and a body with when and where (`formatWhen`, `event.locale`), the letter when it is not empty, "Open your invitation: {personal link}" (`inviteUrl`), and, when `event.inviteOnly`, a line that opening it asks for a code sent to this address.
- [ ] `src/mail/guest-mail.ts:19`: `guestMail` hard-wires `Mail.guestFooter` ("your email is on your reply"); add a `footer` key parameter (`"Mail.guestFooter" | "Mail.invitationFooter"`, default the first) through `guestMails` and `src/mail/queue-guest-mail.ts`.
- [ ] `src/invites/repository.ts`: `markInvitesSent(eventId, ids, now, tx)` sets `sent_at` and `mail_token = coalesce(mail_token, <generateMailToken()>)` per row (pattern `src/rsvps/repository.ts:215`), returning id, email, mail token, name, letter and token; `listUnsentInvites(eventId)` (email set, `sent_at` null, `mail_stopped_at` null); `findInviteByMailToken(token)`; `stopInviteMail(token)` sets `mail_stopped_at` and **keeps the email** (it is the proof under invite-only). `src/rsvps/repository.ts:509–532`: `findByMailToken` and `blankEmailByMailToken` fall through rsvp → voter → invite; `src/app/m/[token]` and `src/proxy.ts:89` need no change.
- [ ] `src/invites/actions.ts`: `sendInviteAction(eventId, id)` and `sendUnsentInvitesAction(eventId)`: `isMailConfigured()`, one `consume("mail", headers)` per action (as `src/announcements/actions.ts:40`), mark sent in a transaction, then `queueGuestMail(event, guests with locale = event.locale, write, …, "Mail.invitationFooter")` and `after(kickMailWorker)`.
- [ ] Invites page: a per-row Send button (email present, not stopped), afterwards "Sent {date}" and "Send again"; "Send to everyone not yet sent" above the list with how many; a "Stopped email" badge; no Send without mail. `share-invite-link.tsx` (client): `navigator.share({ title, text, url })` when available (pattern `src/app/(host)/events/[id]/share/share-actions.tsx:15, 48`), else the existing Copy.
- [ ] Unit tests: `src/invites/invitation-mail.test.ts` (names the guest, the event, when, where and the link; the letter only when there is one; the code line only on an invite-only event); `src/mail/guest-mail.test.ts` (an invitation ends with the invitation footer and the stop link).
- [ ] Browser (`e2e/invites.spec.ts`, Mailpit via `latestMailTo`, `e2e/hosts.ts:98`): Send emails the invitee, the mail holds the letter and the `/i/` link, the row says Sent; "Send to everyone not yet sent" mails only the unsent; the stop link's page shows the email, Stop keeps the email on the invites page and hides Send; on the `app-no-mail` instance, no Send button.
- [ ] Messages `Mail.invitation.{subject,body}`, `Mail.invitationFooter`, `Invites.{send,sendLabel,sent,sentAt,sendAll,sentCount,stopped,share,shareLabel}`, `Invites.errors.{tooFast,noMail}` in all three files. `docs/operator/configuration.md`: the invitation among what mail sends, counted by `RATE_LIMIT_MAIL`.

## Notes for the implementer

- Mail is plain text with no attachments; the invitation is words and a link, never an image.
- Commit subject, e.g. `Invites: the host emails the invitation, and shares the link`.

## Comments
