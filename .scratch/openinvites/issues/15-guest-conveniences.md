# 15: Guest conveniences: calendar, map, countdown, time zones

**What to build:** A guest adds the event to their calendar in one tap, opens the venue in their maps app, sees a countdown, and sees the time in their own zone when it differs from the event's.

**Blocked by:** 07 Guest RSVP flow

**Status:** done

- [x] Add to calendar on the confirmation screen and on the event page: a downloadable calendar file plus prefilled Google Calendar and Outlook web links. The file carries a stable unique identifier per event, start and end with the event's time zone, the title, the location, a plain-text description, and the event link; all-day events produce all-day entries.
- [x] The map link opens Apple Maps on Apple platforms and a Google Maps search elsewhere, both built from the location text on the client.
- [x] A countdown reads "starts in", "happening now", or "ended", computed on the client from the start instant and refreshing without reload.
- [x] When the viewer's zone differs from the event's, the page shows the viewer's local time beneath the event time.
- [x] Browser tests: the calendar file downloads and the links open with the right parameters; the viewer-zone line appears under an emulated zone. Unit tests: calendar file contents for timed and all-day events across zones.

## Comments

**2026-09-22, implementing agent.** Done. Lint, type check, 117 unit tests, and 108 browser tests pass against the production image on the Compose `test` profile.

How it landed:

- `src/calendar/`: `calendar.ts` (the `CalendarEvent` shape and the date formats every calendar surface shares), `ics.ts` (`buildIcs`, with RFC 5545 escaping and 75-octet folding that never splits a character), `links.ts` (prefilled Google Calendar and Outlook entries).
- The file is served from the event link itself, at `/e/<slug>/calendar.ics`, so whatever can open the invitation can download it.
- `src/events/countdown.ts` and `src/events/map.ts` hold the two other rules as pure functions; `src/app/e/[slug]/viewer.tsx` renders them from what only the guest's device knows — their clock, their zone, their maps app — through `useSyncExternalStore`, so the server and the first paint agree and nothing flickers.
- The Poster layout gained three places for this: under When, under Where, and a calendar card of its own. The RSVP confirmation offers the calendar too, the moment a guest says they are coming.

Decisions and things to know:

- Calendar files carry UTC instants rather than the event's named zone. Recorded as **ADR-0006**, because it is baked into files guests import: carrying a named zone means generating a `VTIMEZONE` component with daylight-saving rules, and a wrong rule moves a guest's entry by an hour, which is the exact failure the field exists to prevent.
- A calendar entry is offered only while an event is published. Review caught that a cancelled event still offered one, which reads badly next to a notice saying it is called off, and that a host previewing a draft was offered a file that then refused to download.
- An event with no end time produces no `DTEND`. Inventing a duration the host did not give would be a fabrication.
- The event's identifier in the file is `<event id>@openinvites`, not the instance's host name, so moving an instance to a new address does not turn every entry into a new event in guests' calendars.
- A Going guest is offered the calendar twice, on the confirmation and in the page's own card. Both are in the ticket, and they sit in different parts of the page.

Left for later tickets or noted:

- A bug worth remembering: the semicolon escape in the calendar file was written as `"\;"`, which in JavaScript is just `";"`, so a location like "Level 3; rear entrance" would have corrupted the file. The test that should have caught it had lost the same backslash and passed vacuously. Both are fixed, and the test was mutation-checked to prove it now fails without the escape.
- **For ticket 14 (sharing):** the preview card will want a plain-text rendering of the description, which ticket 17 introduces properly.
- **For ticket 20 (accessibility):** the countdown updates every thirty seconds without announcing itself; a live region may be wanted.
