# Calendar files carry UTC instants, not the event's named time zone

A timed event's calendar entry is written as a UTC instant (`DTSTART:20270306T110000Z`). An
all-day event is written as dates with no zone at all (`DTSTART;VALUE=DATE:20270410`), which is
what all-day means.

Carrying the event's own zone would mean `DTSTART;TZID=Asia/Singapore:20270306T190000` plus a
`VTIMEZONE` component describing that zone's daylight-saving rules for the period in question.
Hand-rolling `VTIMEZONE` from what `Intl` exposes is guesswork at the edges, and a wrong rule
moves a guest's entry by an hour, which is precisely the failure the field exists to prevent.
A UTC instant is exact, needs no rules, and every calendar renders it in the reader's own zone.

## Consequences

- A guest's calendar shows the event at the right moment, but in their own zone rather than the
  event's. The event page is where the event's own clock is shown, alongside the guest's.
- An importing calendar cannot tell which zone the host was thinking in. Nothing in M1 needs it.
- If a host ever asks for the named zone to survive an export, that means generating `VTIMEZONE`
  properly, probably from a library, and supersedes this ADR.
