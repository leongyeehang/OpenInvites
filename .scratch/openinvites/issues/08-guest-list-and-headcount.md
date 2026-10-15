# 08: Guest list and headcount

**What to build:** The host sees the guest list grouped by status with the headcount and every guest's details, edits or removes guests, and watches the list update live. Guests see the list according to the host's visibility setting, blurred until they reply when the setting is "after you reply".

**Blocked by:** 07 Guest RSVP flow

**Status:** done

- [x] Host guest list: groups Going, Maybe, Can't go; headcount; per guest the name, plus-one count and names, email if given, and when they replied; a column for answers that fills in with ticket 09.
- [x] The host can change a guest's status, plus-ones, and names, and remove a guest; a guest's edit link still works after a host edit.
- [x] The host's list refreshes live while open, by polling or a server-sent stream, whichever is simpler.
- [x] Guest list visibility is a per-event setting: always, after you reply (default), or hidden. Guests see names, statuses, plus-one counts, and the headcount; in "after you reply" the list is blurred with a hint until the guest has an RSVP; hidden shows nothing.
- [x] Browser tests with two contexts, host and guest: a new RSVP appears live; each visibility setting behaves; host edit and remove are reflected for the guest.

## Comments

**2026-09-22, implementing agent.** Done. Lint, type check, 84 unit tests, and 76 browser tests (38 scenarios at 390px and desktop) pass against the production image on the Compose `test` profile. Visual check at 390px: the host's list reads as three groups of cards with the headcount above them; the guest's list is the prototype's avatar pile, headcount line, and chips, blurred behind a lock until they answer.

How it landed:

- Visibility is a fourth per-event setting: `guest_list_visibility` (`always`, `afterReply`, `hidden`, default `afterReply`; migration `0005_guest_list_visibility`), with a select on the event form. `src/rsvps/visibility.ts` holds the rule: `guestListView` turns the setting plus "has this guest replied" into `open`, `locked`, or `hidden`, and counts follow it, so a locked list gives away no numbers either.
- `src/rsvps/counts.ts` gained `groupByStatus` (all three groups, in the order the RSVP buttons show them, guests in arrival order inside each) and `asTally`, so a loaded list counts by the same rule the dashboard's grouped query uses.
- `parseHostEdit` (`src/rsvps/form.ts`) is what a host may change on someone else's RSVP: status, name, plus-one count and names. It shares its core with `parseRsvpForm` but carries no email, so a host's edit cannot wipe the address a guest gave, and `editRsvpAsHost` writes only those columns, so the edit token survives and the guest's link keeps working.
- The host's page is `/events/[id]/guests`, linked from the event's manage page. It polls itself every five seconds (`RefreshWhileWatching`), which is the simpler of the two options the spec allows.
- The guest-facing list renders into the Poster layout's `guestList` slot. When locked, the names are never loaded at all, so nothing is recoverable from the page source; four blurred discs and the lock hint stand in.

Decisions and things to know:

- **A host's open edit form is rebuilt whenever the stored answer changes** (`key={savedAt}`). React empties a form once its action has run, so a form that outlived a save kept a reset plus-ones select and posted zero on the next save, quietly dropping the guest's plus-one. Two browser assertions pin the form's values between saves.
- Review caught that the host's page loaded whole RSVP rows and passed them to a client component, which serialises every column into the page — including the guest's hashed edit token. The queries now select their columns explicitly, and a browser test checks the token is absent while a column that *is* passed is present, so the check cannot pass vacuously.
- Removing a guest asks for confirmation. The ticket only says "remove a guest", so this is a deliberate addition: it cannot be undone, it takes the guest's edit link with it, and it is one tap away on a phone. Every other destructive action in the repo confirms. Easy to drop if you disagree.
- A guest's status is carried by a coloured dot; the word now rides along, visible for Maybe and Can't go and read out for Going, because a colour alone is not a status anyone can read.
- Not done, deliberately: no empty "answers" column for ticket 09. The host's row is a card, not a table, so 09 adds a block to it rather than reworking a layout; an empty column now would be scaffolding for nobody.
- Message strings are duplicated across namespaces on purpose (`Guests.counts` matches `Host.dashboard.counts`, the three status words appear in three namespaces). Translation files are organised per screen so a translator has the context, and sharing keys would couple screens whose wording will drift.

Left for later tickets or noted:

- `tsconfig.tsbuildinfo` does not invalidate when `messages/en.json` changes, so `pnpm typecheck` reports missing message keys that are plainly there. Delete the file and re-run. It cost time twice in this ticket.
- **For ticket 09:** the host's guest list is the place answers appear, and `parseHostEdit` is where a host's edits to them would be parsed.
- **For ticket 16:** deleting an event must state how many RSVPs go with it; `countRsvpsByEvent` already returns that.
- **For ticket 20 (accessibility):** the guest chips' status dots are decorative and the word beside them is faint; the blurred locked discs have no accessible equivalent beyond the lock line.
