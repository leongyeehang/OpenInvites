# 16: Cancel and delete

**What to build:** A host cancels an event so the page stays up with a cancellation notice and takes no more RSVPs, or deletes it entirely after a warning. Deleting an account removes every event and every guest's data with it.

**Blocked by:** 07 Guest RSVP flow

**Status:** done

- [x] Cancel asks for confirmation, sets the Cancelled state, shows a clear notice on the event page, and disables all RSVP controls; the guest list stays visible per the visibility setting and the host still sees everything.
- [x] Delete asks for confirmation that states how many RSVPs will be lost, then removes the event, its RSVPs, answers, uploads and their stored files, and its retired slugs; the link then shows not-found.
- [x] Delete account removes the account and cascades through every event as above; verified end to end.
- [x] Browser tests: cancel then open as a guest; delete then confirm the link is gone; delete an account with events and confirm nothing remains reachable.

## Comments

**2026-09-22, implementing agent.** Done, alongside ticket 09 and committed with it. Lint, type check, 103 unit tests, and 96 browser tests pass against the production image.

How it landed:

- `cancelled` joins the event state (migration `0007_cancelled_events`, an `ALTER TYPE ... ADD VALUE`, which Postgres 18 applies inside the migrator's transaction because the value is not used in the same one).
- `src/events/access.ts` holds the two rules as pure functions: `eventPageFor` (a draft is its host's alone; a published or cancelled event shows its page to anyone with the link) and `acceptsRsvps` (only while published). The event page and the RSVP action both read the same rule, so the gate cannot drift between them.
- The host's manage page grew a pair of confirmations: cancelling says the page stays up and takes no more replies; deleting says how many RSVPs and answers go with it, counted before the dialog opens.
- A cancelled event's page keeps the invitation and adds a notice above it. The RSVP buttons are disabled with the same line a draft shows; a guest who had already replied still sees their confirmation and can still withdraw.

Decisions and things to know:

- There is no un-cancel. Nothing asks for one, and "Draft → Published → Cancelled" reads as one-way in the spec. If a host wants it back, that is a new ticket.
- A guest may still remove their RSVP from a cancelled event. Withdrawing is about their own data, not about the event taking replies.
- The delete bullet mentions uploads and retired slugs; neither exists yet (tickets 12 and 14). What exists today — the event, its RSVPs, their answers and its questions — all cascade, and a browser test confirms the link 404s afterwards. Whoever builds 12 and 14 should check the cascade again.
- Deleting an account was already built in ticket 02; this ticket verified it end to end with an event and a guest attached, which is what the third checkbox asked for.
