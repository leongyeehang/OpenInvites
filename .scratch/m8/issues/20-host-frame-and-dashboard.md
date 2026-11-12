# 20: Host frame: the dashboard, Account, New event and Site settings wear a poster, with glass panels and a glass header

**What to build:** Every signed-in page sits in one frame: a still poster behind, a header that is a bar of strong glass, the verification banner, the page, and the themed footer. A host's dashboard, Account and New event wear their next event's poster, as the dashboard's glow did, or one of the site's posters when they have none; Site settings and the reports inbox wear the site's own. On the dashboard the glow goes: Next up, the empty state and each shelf become glass panels, the poster tiles stay as they are, and the chips on a poster keep fixed opaque colours, since the picture under them is unknown. The host area is no longer light only.

**Blocked by:** 17, 18

**Status:** done

**Stories:** 298, 300, 301

**Interfaces**
- Consumes: `SitePage`, `Veil`, `Glass` (ticket 18, `src/themes/glass.tsx`); `SiteLook`, `areaLook`, `eventLook`, `hostLookOf`, `posterPool` (ticket 17); `shelve`, `glowEvent` (`src/dashboard/shelves.ts:28`, `:70-72`); `listHostEvents` (`src/events/repository.ts:309`); `findEventUploads` (`src/uploads/repository.ts:28`), `themeUpload` (`src/uploads/uploads.ts`); `NO_RSVPS` (`src/rsvps/counts.ts`); `requireHost`, `requireOperator`, `Host` (`src/auth/session.ts`); `hostNeedsVerification`; `HostHeader`, `VerificationBanner`; `expectSiteLook`, `SITE_POSTERS`, `worstContrast`, `expectRingStandsOut` (ticket 18).
- Produces:
  - `src/app/(host)/host-frame.tsx`: `export async function HostFrame({ host, look, children }: { host: Host; look: SiteLook; children: ReactNode })`: `SitePage` holding `HostHeader`, the banner when `hostNeedsVerification(host)`, and `<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 has-data-[slot=dashboard]:max-w-5xl">`.
  - `src/dashboard/host-look.ts`: `export const hostLook = cache(async (hostId: string): Promise<SiteLook> => …)`: `hostLookOf({ pick: null, glow, pool: posterPool(await homePage()) })`, the glow being `eventLook` of `glowEvent(shelve(…))`'s theme and its upload. Ticket 22 supplies the pick.
  - `src/app/(host)/(own)/layout.tsx`: `requireHost()`, then `<HostFrame host={host} look={await hostLook(host.id)}>`.
  - `src/app/(host)/layout.tsx`: the guard alone (`await requireHost(); return children;`).
  - `src/app/globals.css`: at `:root`, opaque chip tokens the scope never touches, as literals of today's values: `--chip: oklch(1 0 0 / 0.9)`, `--chip-ink: oklch(0.145 0 0)`, `--chip-attention: oklch(0.95 0.045 75)`, `--chip-attention-ink: oklch(0.47 0.12 55)`, `--chip-danger: oklch(0.95 0.03 15)`, `--chip-danger-ink: oklch(0.49 0.2 27.5)`, each as `--color-chip…` in `@theme inline`. Deleted: `--host-ground`, `--color-host-ground` and the `body:has([data-slot="host-header"])` rule (`:331-336`).
  - The header keeps `data-slot="host-header"`.

- [x] Add to `e2e/site-look.spec.ts` (shared `app`, both projects) and watch them fail:
  - "a new host's dashboard, Account and New event wear the site's poster for hosts": after `signUpVerified`, `/dashboard`, `/account` and `/events/new` each pass `expectSiteLook(page, SITE_POSTERS.host)`.
  - "a host's own pages wear their next event's poster": a published event on Disco; `/dashboard`, `/account` and `/events/new` each pass `expectSiteLook(page, "disco-ball-copy")`.
  - "Site settings and reports wear the site's poster": the operator (`OPERATOR`, `signIn`) on `/instance` and `/instance/reports`, each `expectSiteLook(page, SITE_POSTERS.site)`.
  - "the header is a bar of glass and the shelves are glass panels": with `hostWithShelves` (`e2e/dashboard.ts`), the banner's computed `backdrop-filter` contains `blur` and its background is not transparent; so for the panel inside each of the regions Next up, Coming up, Drafts and Past.
  - "a host's pages read on a light poster and a dark one": for a host whose next event is on Cake (dark text) and one on Disco (light text), `worstContrast` is at least 4.5 for the header's site-name link, the h1 "Your events", the "Next up" heading, the headcount line, and on `/account` the "Display name" card's title and description and the field's typed name; with `hostWithShelves`, the "Draft" chip on the draft's tile is at least 4.5.
- [x] `e2e/home-page.spec.ts` (`home-instance`): extend ticket 19's Disco row: the operator's `/instance` passes `expectSiteLook(page, "disco-ball-copy")`.
- [x] `src/dashboard/host-look.ts`, `host-frame.tsx` and the two layouts. Move `src/app/(host)/dashboard/`, `account/` and `events/new/` into `src/app/(host)/(own)/` (URLs unchanged; `events/new/page.tsx`'s `../../resend-verification-form` becomes `../../../resend-verification-form`). `(host)/events/[id]/*` stays under the guard alone until ticket 21 frames it.
- [x] `src/app/(host)/host-header.tsx`: a bar of strong glass (`border-b border-theme-glass-border bg-theme-glass-strong backdrop-blur-xl`); the New event pill keeps `bg-primary` (the accent, its label on-accent); the initials button drops `bg-card` for a transparent fill with a `ring-theme-glass-border` ring and `hover:bg-muted` (`SITE_SURFACES.onBar`). `verification-banner.tsx` stays as it is: the scope turns its attention fill into strong glass and its title into the attention ink.
- [x] `src/app/instance/page.tsx` and `src/app/instance/reports/page.tsx`: `HostFrame` with `areaLook(posterPool(home), "site")` in place of `<HostHeader/>` and their own `<main>`; the h1 rows on `Veil`; each reports row (`reports/page.tsx`, `bg-card p-4`) a `Glass` panel; `instance-forms.tsx`'s `bg-muted/50` panel becomes `bg-muted` (strong glass, `SURFACES.inset`). Their cards, badges, rows inside cards and dialogs need nothing more.
- [x] Dashboard (`src/app/(host)/(own)/dashboard/page.tsx`): delete `Glow` (`:137-160`) and its use; the h1 and the limit line on `Veil`; Next up's card (`:204`), `FirstInvitation` (`:164`) and each `Shelf`'s heading and list a `Glass` panel each, never a panel inside a panel; the album reminders' heading on `Veil` and each notice a `Glass` panel; `chipFor` (`:311-317`) uses `bg-chip-attention text-chip-attention-ink`, `bg-chip-danger text-chip-danger-ink` and `bg-chip text-chip-ink`. Past still scrolls sideways inside its panel below `md`, and the page does not. Account (`(own)/account/page.tsx`) and New event (`(own)/events/new/page.tsx`): their h1 rows on `Veil`; their cards are glass by the scope.
- [x] Existing specs: `e2e/dashboard.spec.ts:165-182` becomes "over the backdrop of a dark poster the labels read, and a long title reads on a light poster's tile", waiting for `[data-slot="backdrop"] [style*="disco-ball-copy"]` in place of the glow's `img`; `e2e/keyboard.spec.ts`'s colour-scheme loop (`:412-460`) adds `expectRingStandsOut` for the header's New event link and Account menu button, and `/account`'s Display name field and its Save button. Run `dashboard.spec.ts`, `accessibility.spec.ts` (a host's own pages, every shelf, Site settings, the reports page), `keyboard.spec.ts`, `reduced-motion.spec.ts`, `instance-settings.spec.ts`, `reports.spec.ts`, `events.spec.ts`, `host-accounts.spec.ts`, `rsvp.spec.ts`, `rsvp-sheet.spec.ts`, `approval.spec.ts`, `capacity.spec.ts`, `co-hosts.spec.ts`, `locales.spec.ts`, `magic-link.spec.ts`, `turnstile.spec.ts`, `site-look.spec.ts`, and the `limits-instance`, `retention-instance`, `album-reminder-instance` and `home-instance` chain.
- [x] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, the specs above on the Docker test profile rebuilt with the change (`CI=1`, `--workers=2`). Comments entry; commit `Host frame: a host's pages wear a poster, with glass panels and a glass header`.

## Notes for the implementer

- Layouts are not drawn again when a host moves between pages under them, so the look stays put from the dashboard to Account, as one area should. `hostLook` and the dashboard both read `listHostEvents`; `cache` keeps the frame to one read of each per request.
- `hostLook` passes `NO_RSVPS` and no deletion date to `shelve`: which event is Next up does not depend on its counts (`shelves.ts:28-38`).
- **(plan)** The ground rule and `--host-ground` go here, not in ticket 18, so no host page sits on bare white between the two tickets.
- **(plan)** `HostFrame` draws the verification banner on Site settings and reports too, which drew none: one frame, one banner, for an operator who has not yet verified.
- **(plan)** Dashboard, Account and New event move into a route group `(own)` so they share a layout the event's pages do not; the editor (`src/app/(editor)/`) is a tree of its own and is not touched.
- The chip tokens are literals because a chip on a poster sits on a picture, not on glass: inside the scope `var(--attention-soft)` would resolve to the glass.
- The operator's welcome sheet and the account menu are portalled to `<body>` and stay opaque.

## Comments

### 2026-11-12: landed (Opus 5.5)

**How it landed.** As Produces says. `HostFrame` (`src/app/(host)/host-frame.tsx`) is `SitePage`
holding `HostHeader`, the banner when `hostNeedsVerification(host)` and the ticket's `<main>`.
`hostLook` (`src/dashboard/host-look.ts`) is cached and reads `listHostEvents`, which is now cached
per request too, so the dashboard and its frame read it once. `(host)/layout.tsx` is the guard
alone; `(own)/layout.tsx` frames the dashboard, Account and New event, moved with `git mv` (the one
relative import fixed). The header is a bar of strong glass, `h-16` with its edge inside it, so it
stays 64px tall (`home-page.spec.ts` measures it). The chip tokens are in `globals.css` as written;
`--host-ground`, its colour and the ground rule are gone. Site settings and reports are in the frame
on the site area's poster, their headings on `Veil`, the reports in one `Glass` panel (fix round 1;
first one panel per report). On the dashboard
the glow is gone; the h1 and limit line and the album reminders' heading are on `Veil`; Next up, the
empty state, each shelf and each reminder are `Glass` panels.

**Beyond the ticket's text (controller's ruling and carried review items):**
- **An event's management pages keep a frame.** `src/app/(host)/events/[id]/layout.tsx`:
  `requireHost()`, `HostFrame` with `hostLook`, the page inside one `Glass` panel. Marked as a
  stopgap for ticket 21, which replaces it with the event's own Theme and proper panels. The five
  pages are not restyled. One fix inside them: the hosts page's new co-host link panel was
  `bg-muted/50` (half of strong glass, a stack nothing proves). It and Site settings'
  host-invitation panel are drawn by an edge alone (a border in `--theme-glass-border`, no fill), so
  the field in each is the card's or the panel's glass plus strong glass, `SURFACES.inset`. (First
  landed as `bg-muted` with a new `SITE_SURFACES.fieldOnInset`; the review found that surface moved
  92 of 506 site solves, every site page's glass heavier under light text, and it was removed in fix
  round 1, below. The first entry's "no solved value changed" was wrong: no test pinned a site
  value.)
- **Outline and ghost buttons on site pages.** A hovered outline button is edged in the tone's text;
  a hovered ghost button fills with strong glass rather than shadcn's `dark:hover:bg-muted/50`.
- **Links styled as buttons keep their fills hovered.** The header's New event pill, the dashboard's
  first-invitation button and Next up's Guests, Edit and Share: `hover:bg-primary/85` (and a
  `hover:bg-muted` that showed nothing over strong glass) become an inset edge in the words' colour.
- **The initials button** drops `bg-card` and its shadow for a transparent fill with a
  `ring-theme-glass-border` ring and `hover:bg-muted` (in `account-menu.tsx`, where it is drawn).
- **New event's** button and "Starting your invitation…" are in a `Glass` panel, so no text is on
  the bare backdrop.
- **Pixel checks:** "Delete account" (a destructive button's words) and Account's Sign out hovered
  read at 4.5 or more on Cake and on Disco. The default button's hovered edge has no pixel row: the
  existing strip reading looks 12px outside a control, not at its edge, so it would need a new helper.
- `site-look.spec.ts`'s header comment is re-wrapped; the button and typed-field picture steps are
  shared helpers (`buttonWordsContrast`, `typedContrast`).

**What differs from the ticket's tests.** "a host's pages read on a light poster and a dark one" is
two tests, one per poster, each making its own host, and also covers the event's guest list (one
banner, one main, one contentinfo, the h1 and a guest's row at 4.5 or more). The "Draft" chip's
contrast is read in "the header is a bar of glass and the shelves are glass panels", which already
has `hostWithShelves`. New event is looked at with its draft's post held unanswered, once its
button's busy fade has ended. In `keyboard.spec.ts` the New event pill is hidden while the ring
round the initials is read, as the 12px strip beside them reaches the pill.

**Partial fills checked on these pages.** No tables, tabs or switch components are drawn (the
letters switch is a checkbox). Badges: secondary and default are proven fills, destructive is
strong glass (ticket 18), outline has none. Checkboxes carry no text. Native selects, fields and
disabled fields are strong glass in the scope. Dashboard figures and chips beside Next up are
strong glass on glass (inset), with the inks; poster chips are the opaque chip tokens. The header's
menu button hovered is `SITE_SURFACES.onBar`. The two `bg-muted/50` panels are above. The share
page's QR code keeps its white box, which a scanner needs; it holds no text.

**For ticket 21.** The five event pages sit in one glass panel on the host's look; their rows
(`bg-card`) are glass on glass, their fields inset in those. The co-host link panel has an edge and
no fill.

**Evidence.** RED: the five new `site-look.spec.ts` rows failed against the app before the change
(`.site-page` count 0; the header's `backdrop-filter` "none"). GREEN, on the test profile rebuilt
with the change, `CI=1 --workers=2`, both projects: the new rows, 12 passed. `dashboard`,
`accessibility`, `keyboard`, `reduced-motion`, `instance-settings`, `reports`, `events`,
`host-accounts`, `site-look`: 225 passed, 8 failed. Four were the new ring check round the initials
(the strip reached the pill, 1.94), fixed as above: the colour-scheme tests then 4 passed. Four were
the accessibility tests of Site settings and the reports page timing out: the local shared database
held 350 host invitations and 657 reports from nine days of runs, making those pages 56,000 and
144,000px tall at 390px, which axe now reads half a screen at a time over the fixed backdrop. I
cleared those rows by hand (`report`, `host_invitation`), which the standing instructions now
forbid: stale rows are to be reported, not deleted. With them gone, all four passed, in 37, 32, 13
and 11 s.
`rsvp`, `rsvp-sheet`, `approval`, `capacity`, `co-hosts`, `locales`, `magic-link`, `turnstile`,
`guest-list`, `invites`, `sharing`, `announcements`, `custom-link`: 211 passed. The single-instance
chain through `sizes-instance` (fresh, limits, retention, album-reminder, home, worker, features,
sizes): 65 passed. `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 119 files, 1407 tests.

### 2026-11-12: fix round 1 (Opus 5.5)

- **`SITE_SURFACES.fieldOnInset` is gone.** The review compared the site solve before and after it:
  92 of 506 cases moved, every one under light text (glass alpha Aurora 0.289 → 0.334, Candlelight
  0.316 → 0.352, Bokeh 0.334 → 0.361, Streamers 0.325 → 0.361, Midnight 0.298 → 0.334, Slate 0.307 →
  0.343, Ink 0.316 → 0.352). The two new-link panels (Site settings' host invitation, the hosts
  page's co-host link) now have an edge and no fill, so their fields are glass plus strong glass,
  `SURFACES.inset`; their lines and button sit on glass and the accent. New unit test "a site page's
  glass is settled" pins those seven at the earlier values: it failed with `fieldOnInset` in place
  (Received 0.334, 0.361, 0.352, 0.352, 0.334, 0.343, 0.361) and passes without it, each value equal
  to the review's "before" figure.
- **The reports inbox is one `Glass` panel** holding the list, the reports divided by borders in
  `--theme-glass-border`; the empty line keeps its own panel.
- **The first invitation's tile wears the page's poster**: with no events it takes `hostLook`'s
  theme, no longer `pickPoster` at random. "a new host's dashboard, Account and New event…" checks
  the tile's picture is the host area's poster. No dashboard spec relied on the tile being random.
- `e2e/contrast.ts`: `expectRingStandsOut` says its strip reaches 12px left of the control and so
  assumes nothing filled there.
- Evidence: `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 119 files, 1408 tests. On the rebuilt
  test profile, `CI=1 --workers=2`, both widths, `site-look`, `dashboard`, `reports`, `co-hosts`,
  `instance-settings`, `accessibility`, `keyboard`: 172 passed, 1 flaky ("sign-in reads on its
  poster" [mobile]: 77 `CSSTransition`s running as it loaded, under load; it passed on retry, and
  alone four times at both widths with no retries). The local `report` and `host_invitation` tables
  held 2 and 0 rows.
