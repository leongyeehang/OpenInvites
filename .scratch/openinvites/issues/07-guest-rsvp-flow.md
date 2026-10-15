# 07: Guest RSVP flow

**What to build:** A guest opens the event link on a phone, taps Going, Maybe, or Can't go, enters a name, plus-ones with names when the host requires them, and an email when the host asks, and lands on a confirmation offering Change my answer, Edit details, and Remove my RSVP. Returning from the same device finds their RSVP; answering again replaces it; the edit link works from any device.

**Blocked by:** 06 Theme and the Poster layout

**Status:** done

- [x] RSVP schema: event, name, RSVP status, plus-one count, plus-one names, optional email, an edit token stored hashed, replied and updated times. One RSVP per token; two guests with the same name are two RSVPs.
- [x] Per-event settings on the event form: plus-ones allowed 0 to 10 (default 1), require plus-one names (default off), ask for email (default off).
- [x] The flow follows the prototype's steps: idle, then name, then plus-ones, then questions (an empty step until ticket 09), then done; choosing Can't go goes straight from name to done. The stepper expands inline under the three buttons in the Poster layout.
- [x] The confirmation shows what was answered and offers Change my answer (back to choosing a status, keeping the name), Edit details (back to name), and Remove my RSVP (deletes the RSVP and clears the device cookie). The edit link is shown with a copy action.
- [x] A cookie scoped to the event remembers the guest on that device; answering again from the same device replaces the RSVP. Opening the edit link in another browser loads the RSVP for editing.
- [x] Only Published events accept RSVPs; the gate also refuses Cancelled once ticket 16 adds it.
- [x] Status counts and headcount (Going guests plus their plus-ones; Maybe never counted) are computed and shown on the host's dashboard cards.
- [x] Browser tests at 390px: the full flow for each status; edit; remove; the edit link in a fresh context; same-device replacement. Unit tests: replacement and headcount.

## Comments

**2026-09-22, implementing agent.** Done. Lint, type check, 74 unit tests, and 60 browser tests (30 scenarios at 390px and desktop) pass against the production image on the Compose `test` profile. Visual check at 390px matches the prototype's inline stepper and Done state.

How it landed:

- RSVPs module in `src/rsvps/`: `form.ts` (`RSVP_STATUSES` as the one source the type and the Postgres enum both come from, and `parseRsvpForm`, which holds the rules: a name, a status, plus-ones inside the host's allowance and forced to zero for Can't go, a name per plus-one when the host asks, an email only when the host asks and only a plausible one), `counts.ts` (`countRsvps` folds Postgres's per-status tallies into the headcount: every Going guest plus their plus-ones, Maybe never), `plan.ts` (`planRsvp`: the replacement rule, deciding whether an answer changes the RSVP the edit token names or starts a new one, and leaving the token and the first-reply time alone when it replaces), `repository.ts`, `guest.ts` (what a guest receives, plus the device lookup), `actions.ts` and `token.ts`.
- Schema (migration `0004_rsvps`): an `rsvp` table with the status enum, name, plus-one count and names, optional email, the edit token stored as a SHA-256 hash with a unique index, and `replied_at` / `updated_at`; three settings columns on `event` (`plus_ones_allowed` default 1, `require_plus_one_names`, `ask_email`) with a matching group on the event form.
- The flow is one client component in the poster's `rsvp` slot, one form whose steps show and hide: the three buttons, then the name (and the email when asked), then plus-ones, then the confirmation with the edit link, a copy action, Change my answer, Edit details, and Remove my RSVP. The buttons honour the theme's `buttonStyle` knob (`src/themes/rsvp-buttons.ts`).
- Edit link: `/r/<token>` hashes the token, leaves this device's cookie behind, and redirects to the event page, so the token never sits in the address bar of the invitation. The cookie is `rsvp_<eventId>`, httpOnly, a year long, keyed by the event's id rather than its link because ticket 14 lets a host reset the link.

Decisions and things to know:

- Agreed with the maintainer before implementing: the `/r/<token>` shape above; an email stays optional for the guest even when the host asks for one (M3 is where it can be made compulsory); the questions step is skipped entirely rather than rendered empty, and ticket 09 inserts it into the step list; the tested seams are the form rules, the headcount, the replacement rule, and the browser flow at 390px.
- The Continue and Send buttons must not be the same element with a changing `type`. React flushes the step change synchronously inside the click dispatch, so the element became a submit button before the browser evaluated the click's default action and the form sent a half-filled RSVP. The button is never `type="submit"`; the last step calls `requestSubmit()`. The email field is `inputMode="email"` rather than `type="email"` for the same family of reason: a browser cannot show a validation bubble on a field hidden behind a later step, so it would block the send in silence.
- A returning guest's draft is clamped to the host's current plus-ones allowance. Without it, a host who lowers the allowance after someone has brought two people locks that guest out of their own RSVP for good, because the impossible number rides along in the hidden field with the step that would fix it unreachable.
- A refusal that is about a field sends the guest back to the step holding it; one about nothing in particular leaves them where they are with the message in front of them.

Left for later tickets or noted:

- `fields(formData)` and its `text()` reader are now duplicated between `src/events/actions.ts` and `src/rsvps/actions.ts`. Left alone rather than refactoring a neighbouring ticket's file; worth extracting when a third one appears.
- **For ticket 20 (accessibility):** "Remove my RSVP" is the accent colour on glass, and the disabled Continue button is the accent at 50%. Neither has been measured against AA.
- **For ticket 08:** `countRsvpsByEvent` already returns the per-status counts and headcount per event; the guest list, the live refresh, and the host's edits build on it.
- `repliedAt` keeps the ticket's own word ("replied and updated times"), even though `CONTEXT.md` avoids "reply" as a noun for an RSVP. The noun is not used anywhere in the code or the interface strings.
