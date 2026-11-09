# 09: Invites: a personal letter on the guest's invitation

**What to build:** When letters are on and the viewer's invite has one, the event page shows it above the details, "For {name}", in every layout.

**Blocked by:** 05 A phone, a letter and a pasted list for each guest; 07 An invite-only event opens only to a device with a pass (the gate's identity invite)

**Status:** done

- [x] `src/app/e/[slug]/page.tsx`: `letter = event.lettersEnabled && invite?.letter ? { name, body } : undefined`, where the invite is the gate's identity invite (the pass or the cookie) or, for `mine`, the one at `mine.rsvp.inviteId` (`findInviteById`); a pure `letterFor(event, invite)` decides. Passed to all three layouts.
- [x] Poster (`src/themes/poster-layout.tsx:94`): before the details Glass, a `Glass data-slot="letter"` with `SectionLabel` "For {name}" and a `whitespace-pre-line` paragraph; Broadsheet (`src/themes/broadsheet-layout.tsx:105`): a `Section slot="letter"` first in the paper; Thread (`src/themes/thread-layout.tsx:78`): a `HostBubble data-slot="letter"` right after the card. The invitation email already carries the letter (ticket 06).
- [x] Unit test: `letterFor` shows only when letters are on and the letter is not empty.
- [x] Browser (`e2e/invites.spec.ts` or `invite-only.spec.ts`): "For Mei" with line breaks in Poster, Broadsheet and Thread (`chooseLayout`, `e2e/events.ts:230`), including Chinese text; another guest sees none; letters off hides it; axe on each layout.
- [x] Messages `EventPage.letter.for` in all three files.

## Notes for the implementer

- The letter is the host's words to one person: plain text, no markdown, line breaks kept.
- Commit subject, e.g. `Invites: a personal letter on the guest's invitation`.

## Comments

**2026-11-07, implementing agent.** Done. `letterFor` and the `Letter` type in `src/invites/invite.ts`; `deviceInvite` in `src/invites/device.ts`, used by the gate and the event page; `LetterSection` in `src/themes/sections/letter-section.tsx`, framed by the three layouts; `EventPage.letter.for` in the three locales ("For {name}", "致 {name}", "致 {name}").

How it landed:
- **Whose letter** (controller's ruling 1): the lookup at the heart of the gate, "the pass's invite, else the invite cookie's, else the one the device's reply is tied to (`mine.rsvp.inviteId`)", is now one function, `deviceInvite(eventId, mine)` → `{ invite, pass }`. The gate calls it exactly where it did (invite-only, not a host), with the same cache key and the same result. The event page calls it only when `event.lettersEnabled`, on any event, invite-only or not, with the page's own `mine`, so an event without letters pays nothing.
- **The rule**: `letterFor(event, invite)` is `{ name, body }` while letters are on and the invite's letter is not blank after trimming, the body as stored (the Invites page trims it on save and keeps its line breaks); otherwise nothing. The invitation email (06) now uses the same rule for its letter, so the page and the mail cannot disagree.
- **The panel**: `LetterSection` is a server component, one `<p>` with `whitespace-pre-line` and `break-words`, the letter set as text (React escapes it; no markdown, no HTML). Each layout heads it with its own primitive: the Poster a `Glass data-slot="letter"` with `SectionLabel` (an open-envelope icon) before the details Glass; the Broadsheet a `Section slot="letter"` first in the paper; the Thread a `HostBubble data-slot="letter"` with `BubbleLabel` right after the card. Each uses that layout's existing entrance (motion-safe only); no new animation, no colour literal.
- **The layouts take the letter as data** (`letter?: Letter`), as they take `comments`, rather than as a node like `schedule` and `album`: the heading needs the name, and it is drawn with each layout's own primitive.

Decisions and things to know:
- The letter is shown to whoever's device stands for an invite with a letter, a host too: a host who opens a guest's personal link sees what that guest sees (a comment on the page says so).
- Where it never appears (controller's ruling 4), confirmed by reading: `generateMetadata` in `src/app/e/[slug]/page.tsx` reads only the event's title, description and preview; `preview.png`, `calendar.ics` and `report` under `src/app/e/[slug]/` never read an invite; the only readers of `invite.letter` are the Invites page, its actions, the invitation email and this panel. The objects handed to client components (`flow.invite`, `LockedPage`) carry the invite's name, email and phone, never its letter.
- A letter kept while letters are off stays with the host; turning letters on again shows it again.

Left for later: nothing of this ticket. 10 may want the panel in its keyboard and locale passes.

Evidence:
- RED: `pnpm exec vitest run src/invites/invite.test.ts`: 4 failed (`letterFor is not a function`), 33 passed. GREEN: 37 passed.
- Unit mutations, each restored and hash-checked: the `lettersEnabled` check dropped, the blank check dropped, the blank check without trimming: 3 caught. Trimming the body survives, as stored letters are already trimmed (an equivalent mutant).
- `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 92 files, 969 passed.
- Browser, Docker test profile rebuilt from the tree, `CI=1`, 2 workers, both widths: `invites` + `invite-only` + `rsvp` + `accessibility`: 113 passed (20.4 min), none flaky or retried. New rows: in `e2e/invites.spec.ts`, "with letters on, the guest whose invite has a letter sees it …" (an event not invite-only; the host turns letters on and gives Mei the letter "親愛的 Mei，\n\n期待與你相見。\nWith love", Dev none; Mei's `/i/` link shows "For Mei" with the letter's `innerText` exactly as written in the Poster (panel just before the details), the Broadsheet (first in the paper, before the description) and the Thread (right after the card), axe on each; Dev and a stranger on the event link see no panel; letters off, Mei's page shows none); in `e2e/invite-only.spec.ts`, "an invitee let in by her pass sees the host's letter to her" (Mei opens the event link, not her own, so only the pass from her code identifies her, and she sees "For Mei" with the letter).
