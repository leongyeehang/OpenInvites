# 09: Invites: a personal letter on the guest's invitation

**What to build:** When letters are on and the viewer's invite has one, the event page shows it above the details, "For {name}", in every layout.

**Blocked by:** 05 A phone, a letter and a pasted list for each guest; 07 An invite-only event opens only to a device with a pass (the gate's identity invite)

**Status:** ready-for-agent

- [ ] `src/app/e/[slug]/page.tsx`: `letter = event.lettersEnabled && invite?.letter ? { name, body } : undefined`, where the invite is the gate's identity invite (the pass or the cookie) or, for `mine`, the one at `mine.rsvp.inviteId` (`findInviteById`); a pure `letterFor(event, invite)` decides. Passed to all three layouts.
- [ ] Poster (`src/themes/poster-layout.tsx:94`): before the details Glass, a `Glass data-slot="letter"` with `SectionLabel` "For {name}" and a `whitespace-pre-line` paragraph; Broadsheet (`src/themes/broadsheet-layout.tsx:105`): a `Section slot="letter"` first in the paper; Thread (`src/themes/thread-layout.tsx:78`): a `HostBubble data-slot="letter"` right after the card. The invitation email already carries the letter (ticket 06).
- [ ] Unit test: `letterFor` shows only when letters are on and the letter is not empty.
- [ ] Browser (`e2e/invites.spec.ts` or `invite-only.spec.ts`): "For Mei" with line breaks in Poster, Broadsheet and Thread (`chooseLayout`, `e2e/events.ts:230`), including Chinese text; another guest sees none; letters off hides it; axe on each layout.
- [ ] Messages `EventPage.letter.for` in all three files.

## Notes for the implementer

- The letter is the host's words to one person: plain text, no markdown, line breaks kept.
- Commit subject, e.g. `Invites: a personal letter on the guest's invitation`.

## Comments
