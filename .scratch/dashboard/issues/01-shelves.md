# 01: The shelves, as pure rules

**What to build:** The rules that decide what the dashboard shows: which event is Next up, which shelf every other event goes on and in what order, the one chip a tile shows and the one number under it. Pure and unit tested; ticket 03 draws them.

**Blocked by:** nothing

**Status:** done

- [x] `src/dashboard/shelves.ts` (pure, no imports from the database or React):
  - `type ShelfEvent = HostEvent & { counts: RsvpCounts; deletion: Date | null }` (`HostEvent` from `src/events/repository.ts`, `RsvpCounts` from `src/rsvps/counts.ts`). The page builds it from what it reads today: `countRsvpsByEvent` (or `NO_RSVPS`) and `deletionDate(event, retentionDays, retentionFloorDays()) ?? null`.
  - `type Shelves = { nextUp: ShelfEvent | null; comingUp: ShelfEvent[]; drafts: ShelfEvent[]; past: ShelfEvent[] }`.
  - `shelve(events: ShelfEvent[], now: Date): Shelves`. Built on `partitionByEnd` (`src/events/time.ts`), not a copy of it:
    - `nextUp`: the first event in the upcoming order whose `state` is `"published"`; a voting event (no `startsAt`) sorts after every dated one, as `partitionByEnd` already does. Null when there is none.
    - `comingUp`: every other upcoming event that is not a draft (published and cancelled), in the upcoming order.
    - `drafts`: every upcoming draft, in the upcoming order. A draft that has ended stays in `past`, as it does today.
    - `past`: the ended events, newest first.
  - `type WhenKind = "dated" | "poll" | "none"` and `whenKind(event: ShelfEvent): WhenKind`: `dated` when `startsAt` is set, `poll` when the date poll is open (`pollOpenedAt` set and `pollClosedAt` null), otherwise `none`.
  - `type TileChip = { kind: "toApprove"; count: number } | { kind: "cancelled" } | { kind: "draft" } | { kind: "coHost" }` and `tileChip(event: ShelfEvent): TileChip | null`, in that priority: pending replies (`counts.pending > 0`), else `state === "cancelled"`, else `state === "draft"`, else `role === "coHost"`, else null.
  - `type TileNumber = { kind: "places"; headcount: number; capacity: number } | { kind: "going"; count: number } | { kind: "went"; count: number } | { kind: "deletion"; date: Date }` and `tileNumber(event: ShelfEvent, shelf: "comingUp" | "drafts" | "past"): TileNumber`. On `past`: `deletion` when `event.deletion` is set, else `went` with `counts.going`. Elsewhere: `places` when `capacity !== null`, else `going` with `counts.going`.
  - `glowEvent(shelves: Shelves): ShelfEvent | null`: `nextUp`, else the first of `comingUp`, `drafts`, `past`, else null.
- [x] Unit tests (`src/dashboard/shelves.test.ts`), with a small `event({...})` builder:
  - `shelve`: a draft dated sooner than a published event does not become Next up; a cancelled event sooner than a published one does not either, and is in `comingUp`; a voting published event is Next up only when no dated published event is upcoming; nothing published and upcoming gives `nextUp` null; drafts with and without a date are in `drafts` in the upcoming order; an ended draft is in `past`; `past` is newest first; the Next up event is in no other shelf.
  - `whenKind` for each case, including a closed poll with no date (`none`).
  - `tileChip` for each kind and its priority: a cancelled co-hosted event with two pending replies gives `toApprove` 2; a draft co-hosted event gives `draft`.
  - `tileNumber`: capacity → `places`; no capacity → `going`; past → `went`; past and marked → `deletion`.
  - `glowEvent` falling through each shelf, and null for no events.

## Notes for the implementer

- `HostEvent` is `Event & { role: Role }`; `Event` carries `state`, `startsAt`, `endsAt`, `allDay`, `timeZone`, `capacity`, `pollOpenedAt`, `pollClosedAt`, `retentionWarnedAt` and `theme`. Build test events with every field `partitionByEnd` and the rules read; cast the rest.
- Nothing else changes in this ticket: the dashboard keeps drawing as it does until ticket 03.
- Commit subject, e.g. `Dashboard: the rules for Next up and the shelves are in one place`.

## Comments

**2026-11-06, implementing agent (inline).** Done. `src/dashboard/shelves.ts` and `shelves.test.ts`: the tests failed first because the module did not exist (`no tests`, import failed), then 11 passed. `pnpm lint` and `pnpm typecheck` pass.

How it landed: `shelve` builds on `partitionByEnd`, so the upcoming order, the undated-last rule and Past's newest-first order are its own; Next up is the first published event of the upcoming list, and `comingUp` is the rest of the upcoming events that are not drafts. `whenKind`, `tileChip`, `tileNumber` and `glowEvent` as the ticket names them.

Left for later tickets or noted: nothing. The dashboard still draws the old way until ticket 03.
