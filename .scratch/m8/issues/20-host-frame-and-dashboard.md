# 20: Host frame: the dashboard, Account, New event and Site settings wear a poster, with glass panels and a glass header

**What to build:** Every signed-in page sits in one frame: a still poster behind, a header that is a bar of strong glass, the verification banner, the page, and the themed footer. A host's dashboard, Account and New event wear their next event's poster, as the dashboard's glow did, or one of the site's posters when they have none; Site settings and the reports inbox wear the site's own. On the dashboard the glow goes: Next up, the empty state and each shelf become glass panels, the poster tiles stay as they are, and the chips on a poster keep fixed opaque colours, since the picture under them is unknown. The host area is no longer light only.

**Blocked by:** 17, 18

**Status:** ready-for-agent

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

- [ ] Add to `e2e/site-look.spec.ts` (shared `app`, both projects) and watch them fail:
  - "a new host's dashboard, Account and New event wear the site's poster for hosts": after `signUpVerified`, `/dashboard`, `/account` and `/events/new` each pass `expectSiteLook(page, SITE_POSTERS.host)`.
  - "a host's own pages wear their next event's poster": a published event on Disco; `/dashboard`, `/account` and `/events/new` each pass `expectSiteLook(page, "disco-ball-copy")`.
  - "Site settings and reports wear the site's poster": the operator (`OPERATOR`, `signIn`) on `/instance` and `/instance/reports`, each `expectSiteLook(page, SITE_POSTERS.site)`.
  - "the header is a bar of glass and the shelves are glass panels": with `hostWithShelves` (`e2e/dashboard.ts`), the banner's computed `backdrop-filter` contains `blur` and its background is not transparent; so for the panel inside each of the regions Next up, Coming up, Drafts and Past.
  - "a host's pages read on a light poster and a dark one": for a host whose next event is on Cake (dark text) and one on Disco (light text), `worstContrast` is at least 4.5 for the header's site-name link, the h1 "Your events", the "Next up" heading, the headcount line, and on `/account` the "Display name" card's title and description and the field's typed name; with `hostWithShelves`, the "Draft" chip on the draft's tile is at least 4.5.
- [ ] `e2e/home-page.spec.ts` (`home-instance`): extend ticket 19's Disco row: the operator's `/instance` passes `expectSiteLook(page, "disco-ball-copy")`.
- [ ] `src/dashboard/host-look.ts`, `host-frame.tsx` and the two layouts. Move `src/app/(host)/dashboard/`, `account/` and `events/new/` into `src/app/(host)/(own)/` (URLs unchanged; `events/new/page.tsx`'s `../../resend-verification-form` becomes `../../../resend-verification-form`). `(host)/events/[id]/*` stays under the guard alone until ticket 21 frames it.
- [ ] `src/app/(host)/host-header.tsx`: a bar of strong glass (`border-b border-theme-glass-border bg-theme-glass-strong backdrop-blur-xl`); the New event pill keeps `bg-primary` (the accent, its label on-accent); the initials button drops `bg-card` for a transparent fill with a `ring-theme-glass-border` ring and `hover:bg-muted` (`SITE_SURFACES.onBar`). `verification-banner.tsx` stays as it is: the scope turns its attention fill into strong glass and its title into the attention ink.
- [ ] `src/app/instance/page.tsx` and `src/app/instance/reports/page.tsx`: `HostFrame` with `areaLook(posterPool(home), "site")` in place of `<HostHeader/>` and their own `<main>`; the h1 rows on `Veil`; each reports row (`reports/page.tsx`, `bg-card p-4`) a `Glass` panel; `instance-forms.tsx`'s `bg-muted/50` panel becomes `bg-muted` (strong glass, `SURFACES.inset`). Their cards, badges, rows inside cards and dialogs need nothing more.
- [ ] Dashboard (`src/app/(host)/(own)/dashboard/page.tsx`): delete `Glow` (`:137-160`) and its use; the h1 and the limit line on `Veil`; Next up's card (`:204`), `FirstInvitation` (`:164`) and each `Shelf`'s heading and list a `Glass` panel each, never a panel inside a panel; the album reminders' heading on `Veil` and each notice a `Glass` panel; `chipFor` (`:311-317`) uses `bg-chip-attention text-chip-attention-ink`, `bg-chip-danger text-chip-danger-ink` and `bg-chip text-chip-ink`. Past still scrolls sideways inside its panel below `md`, and the page does not. Account (`(own)/account/page.tsx`) and New event (`(own)/events/new/page.tsx`): their h1 rows on `Veil`; their cards are glass by the scope.
- [ ] Existing specs: `e2e/dashboard.spec.ts:165-182` becomes "over the backdrop of a dark poster the labels read, and a long title reads on a light poster's tile", waiting for `[data-slot="backdrop"] [style*="disco-ball-copy"]` in place of the glow's `img`; `e2e/keyboard.spec.ts`'s colour-scheme loop (`:412-460`) adds `expectRingStandsOut` for the header's New event link and Account menu button, and `/account`'s Display name field and its Save button. Run `dashboard.spec.ts`, `accessibility.spec.ts` (a host's own pages, every shelf, Site settings, the reports page), `keyboard.spec.ts`, `reduced-motion.spec.ts`, `instance-settings.spec.ts`, `reports.spec.ts`, `events.spec.ts`, `host-accounts.spec.ts`, `rsvp.spec.ts`, `rsvp-sheet.spec.ts`, `approval.spec.ts`, `capacity.spec.ts`, `co-hosts.spec.ts`, `locales.spec.ts`, `magic-link.spec.ts`, `turnstile.spec.ts`, `site-look.spec.ts`, and the `limits-instance`, `retention-instance`, `album-reminder-instance` and `home-instance` chain.
- [ ] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, the specs above on the Docker test profile rebuilt with the change (`CI=1`, `--workers=2`). Comments entry; commit `Host frame: a host's pages wear a poster, with glass panels and a glass header`.

## Notes for the implementer

- Layouts are not drawn again when a host moves between pages under them, so the look stays put from the dashboard to Account, as one area should. `hostLook` and the dashboard both read `listHostEvents`; `cache` keeps the frame to one read of each per request.
- `hostLook` passes `NO_RSVPS` and no deletion date to `shelve`: which event is Next up does not depend on its counts (`shelves.ts:28-38`).
- **(plan)** The ground rule and `--host-ground` go here, not in ticket 18, so no host page sits on bare white between the two tickets.
- **(plan)** `HostFrame` draws the verification banner on Site settings and reports too, which drew none: one frame, one banner, for an operator who has not yet verified.
- **(plan)** Dashboard, Account and New event move into a route group `(own)` so they share a layout the event's pages do not; the editor (`src/app/(editor)/`) is a tree of its own and is not touched.
- The chip tokens are literals because a chip on a poster sits on a picture, not on glass: inside the scope `var(--attention-soft)` would resolve to the glass.
- The operator's welcome sheet and the account menu are portalled to `<body>` and stay opaque.

## Comments
