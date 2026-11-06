# 03: The dashboard as a shelf of invitations

**What to build:** `/dashboard` opens on the host's next event, large, with its replies and what needs them, then Coming up, Drafts and Past as poster tiles, on a glow taken from a poster. A host with no events gets one way to start.

**Blocked by:** 01 (the rules), 02 (the frame and the New event pill)

**Status:** done

- [x] **Data.** `src/app/(host)/dashboard/page.tsx` builds `ShelfEvent`s (ticket 01) from `listHostEvents`, `countRsvpsByEvent` and `deletionDate`, and calls `shelve(events, new Date())`. A new `findEventUploads(eventIds: string[]): Promise<Map<string, Upload>>` in `src/uploads/repository.ts` reads, in one query, the upload of every event whose `theme.poster.kind` is `"upload"`; the page hands each tile `themeUpload(upload)` or null, as the event page does.
- [x] **`src/themes/poster-tile.tsx`**, `PosterTile({ theme, upload, title, sizes, chip?, faded?, priority? })`: the event's poster at 4:5 with its title on it in the event's title font (`title-fonts.ts`), from `resolveTheme(theme, upload)`. A gallery poster uses its `card` file (`findGalleryPoster(id).card`), a colour poster its background, an upload its rendition (`srcSet` + `sizes`) and its `titlePlacement`. The title sits on a scrim at the foot as on the poster card, and a long title wraps (`text-wrap: balance`, no overflow). Images are `loading="lazy"` unless `priority`. The picture is decorative here (`alt=""`): the link around it carries the title.
- [x] **Next up** (section with heading "Next up"), when `shelves.nextUp`:
  - one card: `PosterTile` at the larger size (`priority`), linking to `/events/{id}`;
  - the date with `formatWhen`, or "Date poll open" (`whenKind === "poll"`);
  - chips: "{n} going", "{n} maybe", "{n} can’t go", "{n} on the waitlist" (only when there are any; the existing `waitlisted` message), "{n} to approve" (attention colour, only when there are any);
  - the headcount line, the existing `headcount` / `headcountOf` messages ("2 people expected", "1 person expected of 2 places");
  - "Will be deleted on {date}" (existing `deletedOn`, danger colour) when marked;
  - three links styled as buttons: **Guests** (primary, `/events/{id}/guests`), **Edit** (`/events/{id}`), **Share** (`/events/{id}/share`).
  - Below `md`, poster above; from `md`, the poster on the left (300 px) and on the right the date, then four large figures (going, maybe, can’t go, and to approve when there are any), the headcount line and the buttons.
- [x] **Coming up**, **Drafts** and **Past** (sections with those headings, each drawn only when it has events): tiles in a grid, two across below `md`, four from `md`. A tile is a link to `/events/{id}` named by the title, holding `PosterTile` with `tileChip` on the poster ("{n} to approve", "Cancelled", "Draft", "Co-host"), then the date (`formatWhenBrief`, "Date poll open" or "No date yet") and `tileNumber` ("{count} of {capacity} places", "{n} going", "{n} went", or "Will be deleted on {date}" in the danger colour). Past's posters are faded. Below `md`, Past is one row that scrolls sideways inside itself with scroll snapping; the page itself never scrolls sideways.
- [x] **No events at all**: one card with a gallery poster (`pickPoster(posterPool(await homePage()))`), "Make your first invitation", "Pick a poster, add a date, and share one link. Guests reply without an account.", and a **Start an invitation** link to `/events/new`.
- [x] **At the limit**: the existing `limitReached` message under the heading (ticket 02 already hides the pill). The dashboard's own New event button goes.
- [x] **The glow**: behind the top of the page, an `aria-hidden` blurred copy of `glowEvent(shelves)`'s poster (or the empty state's), fading into the ground; no animation. Not drawn when the poster is a plain colour; the ground then takes a faint wash of that colour.
- [x] Copy, keys under `Host.dashboard.*` in three languages: `nextUp` "Next up", `comingUp` "Coming up", `drafts` "Drafts", `past` (exists), `going` "{count} going", `maybe` "{count} maybe", `cant` "{count} can’t go", `toApprove` "{count} to approve", `places` "{count} of {capacity, plural, one {# place} other {# places}}", `went` "{count} went", `datePoll` "Date poll open", `guests` "Guests", `edit` "Edit", `share` "Share", `cancelled` "Cancelled", `draft` "Draft", `firstTitle` "Make your first invitation", `firstText` (above), `firstButton` "Start an invitation". Removed: `new`, `upcoming`, `empty`, `emptyUpcoming`, `emptyPast`, `counts`, `pending`, if nothing reads them.
- [x] The welcome sheet still opens over the dashboard, and the `h1` "Your events" still takes the focus when it closes.
- [x] Specs that read the old dashboard move to the new one: `rsvp.spec.ts` and `rsvp-sheet.spec.ts` (`counts()` reads the "Next up" region: chips and headcount line), `events.spec.ts` (a draft under "Drafts", an ended event under "Past", "Untitled event" and "No date yet" on the draft's tile), `co-hosts.spec.ts` (the co-hosted event is Next up for the co-host, its tile or card says Co-host, Guests opens), `retention.spec.ts` (the "Past" region's tile says "Will be deleted on …"). Grep `e2e/` for `region", { name: "Upcoming"` and `going · `.
- [x] Browser tests, in a new `e2e/dashboard.spec.ts` on the shared `app` (each test signs up its own host):
  - a published event, a later published event, a draft and an ended event: the first is Next up, the second under Coming up, the draft under Drafts, the ended one under Past; Next up's Guests, Edit and Share reach their pages;
  - a pending reply (an event that needs approval) shows "1 to approve" on Next up;
  - a cancelled event sooner than a published one is under Coming up with "Cancelled", and the published one is Next up;
  - a new host sees "Make your first invitation" and no Next up; Start an invitation reaches `/events/new`;
  - an event with an uploaded poster shows that picture on its tile (an `/uploads/` source);
  - at 390 px with ten ended events: the page does not scroll sideways, the Past row does, and Tab reaches the last Past tile;
  - at 390 px a 60-character title wraps inside its tile.

## Notes for the implementer

- Reuse, don't copy: `resolveTheme` and `ResolvedPoster` (`src/themes/resolve.ts`), the scrim and title classes of `PosterHero` / `PosterTitle` (`poster-card.tsx`, `poster-title.tsx`), `findGalleryPoster` (`posters.ts`). If a piece is private to the event page, export or move it without changing what the event page draws.
- `Picture` in `poster-card.tsx` fetches at high priority and is sized for the event page; the tile needs its own `<img>` or a `Picture` that takes `loading` and `fetchPriority`.
- Ticket 05 adds the accessibility, keyboard, locale and reduced-motion rows and the screenshot.
- Commit subject, e.g. `Dashboard: your events open as their posters, the next one first`.

## Comments

**2026-11-06, implementing agent (inline).** Done. `pnpm lint`, `pnpm typecheck` and `pnpm test` (83 files, 868 tests) pass. `e2e/dashboard.spec.ts` failed first on the image without this change ("Make your first invitation" not found), then its seven scenarios pass on both projects, with `rsvp`, `rsvp-sheet`, `events`, `co-hosts`, `approval`, `capacity` and `accessibility`, and `retention` in the `home-instance` chain (43 passed), on the Docker test profile (`CI=1`, two workers).

How it landed:
- `src/app/(host)/dashboard/page.tsx` builds `ShelfEvent`s and calls `shelve`; `findEventUploads` (`src/uploads/repository.ts`) reads the pictures of the events whose poster is an upload in one query.
- `src/themes/poster-tile.tsx`: the poster from `resolveTheme` (a gallery poster's SVG, the host's renditions with `srcSet` and `sizes`, or a colour's gradient) at 4:5, lazy unless `priority`, with the title on it in the event's face (`TITLE_FONT_CLASSES` and the font's weight and tracking). Without a title it is the poster alone (the first-invitation card).
- **Next up**: one card, poster above on a phone and beside from `md`; the replies are one list whose items read "18 going" (`t.rich` with an `<n>` tag), chips on a phone and large figures from `md`. A "Co-host" pill follows the date when the host co-hosts it. Guests, Edit, Share.
- **Shelves**: Coming up, Drafts, Past, each drawn only with events; Past scrolls sideways inside itself below `md`, with snapping. The tile's chip and number come from `tileChip` and `tileNumber`.
- **Glow**: an absolutely placed, `aria-hidden` blurred copy of `glowEvent`'s poster (its `copy` file, as the event page uses), masked into the ground; a colour poster lends a faint wash.
- **Width**: the host layout's `main` is `max-w-5xl` when it holds the dashboard (`has-data-[slot=dashboard]`), so four tiles fit; the other host pages keep `max-w-3xl`.
- **Specs moved**: `nextUp(page)` and `expectReplies(card, going, maybe, cant)` in `e2e/events.ts`; `rsvp` and `rsvp-sheet` read the Next up card, `events` reads Drafts and Past, `co-hosts` the co-host's Next up (Co-host, and Guests opens the guest list), `approval` "1 to approve", `capacity` the headcount line, `retention` the empty state's heading.

Decisions (ledgered): the title always sits on the poster on a tile; a gallery tile uses its SVG; the Co-host pill on Next up; the wider dashboard.

Chinese least sure of: `nextUp` 下一场 / 下一場, `toApprove` 人待批准 / 人待核准, `places` "{count} / # 个名额", `went` 人参加了, `firstTitle` 做你的第一张邀请函, `datePoll` 日期投票进行中.

Left for later tickets or noted: ticket 05 adds the accessibility, keyboard, locale and reduced-motion rows and the screenshot. A draft's tile says "0 going", as the ticket's number rule has it.
