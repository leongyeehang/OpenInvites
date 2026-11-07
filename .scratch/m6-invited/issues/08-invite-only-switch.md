# 08: Invites: invite-only invites everyone who replied, and says who the link lets in

**What to build:** The Invite-only switch in the Settings sheet; turning it on makes an invite for every reply that has none, so nobody who replied is locked out; the Invites page says that invite-only is on and which rows get in by link alone.

**Blocked by:** 07 An invite-only event opens only to a device with a pass

**Status:** ready-for-agent

- [ ] `inviteOnly` joins `EventInput`, `EventFormFields` and `parseEventSettings` (`src/events/form.ts:20, 43, 159`), default false (`src/events/editor-actions.ts:62`), read at `:200`; in the Settings sheet (`src/editor/settings-sheet.tsx:177`) a Checkbox under Guests: "Invite-only: only people on the invite list can open the invitation", with the hint "They prove their email on each device they use; someone with only a phone number gets in by their link. Guests who already replied are added to the list; those with an email prove it once." and a "Manage the invite list" link to `/events/[id]/invites`. `src/events/duplicate.ts` already copies it (ticket 05).
- [ ] `updateEvent` (`src/events/repository.ts:89`): select `inviteOnly` in `before`; when it turns on, under the same lock, `inviteRepliedGuests(updated.id, tx)` in `src/invites/repository.ts`: for each reply of the event with `invite_id IS NULL`, insert an invite (name, email, phone, a fresh `generateInviteToken()`, `rsvp_id`, `opened_at = now`) and set `rsvp.invite_id`, through a pure mapper `inviteFromRsvp(rsvp)`. Not capped by `MAX_INVITES` (host-made invites still are). Turning off deletes nothing. The `save` helper in `editor-actions.ts` also revalidates `/events/[id]/invites` and `/events/[id]/guests` when `inviteOnly` changed.
- [ ] Invites page: when invite-only is on, a banner "Invite-only is on: only these people can open the invitation." with a link to the editor's settings, and on each row without an email the line "Anyone with this link can open the invitation".
- [ ] Unit tests: `src/events/form.test.ts` reads `inviteOnly`; `src/invites/invite.test.ts`: `inviteFromRsvp` keeps the name, email and phone and marks it replied and opened.
- [ ] Browser (`e2e/invite-only.spec.ts`): after two replies (one with an email, one without) the host turns the switch on (`editSettings`, `e2e/events.ts:104`): the invites page lists both as Replied; the guest without an email still opens the page from their cookie and from their `/r/` link on a new device; the guest with an email is asked for a code once, then is in with their reply shown as theirs and their edit link working; the warning shows on the phone-only row and not on the email row; turning the switch off locks nobody and deletes nothing; at the 500-invite cap the replied guests still get invites.
- [ ] Messages `Events.form.guests.{inviteOnly,inviteOnlyHint,manageInvites}`, `Invites.{inviteOnlyBanner,inviteOnlySettings,linkLetsIn}` in all three files.

## Notes for the implementer

- Commit subject, e.g. `Invites: invite-only invites everyone who replied, and says who the link lets in`.

## Comments
