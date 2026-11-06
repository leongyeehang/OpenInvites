# 02: The frame of every signed-in page

**What to build:** Every signed-in page sits on a soft tinted ground, under a header with the site's name, a New event pill and the host's initials opening an account menu. The other host pages keep their own content.

**Blocked by:** nothing

**Status:** done

- [x] **The ground.** Tokens in `src/app/globals.css` for the host area's ground (a soft, slightly cool tinted neutral, as in the mockup; not white, not cream), its header and its chips' attention (amber) and danger (rose) colours, with text on each at 4.5:1 or more. `src/app/(host)/layout.tsx` paints the ground behind the header and `main`. The white cards of the other host pages are unchanged and sit on it.
- [x] **The header** (`src/app/(host)/host-header.tsx`), in the mockup's shape:
  - left: the site's name (`instanceDisplayName(await homePage())`, as now), linking to `/dashboard`, ellipsised on one line when long;
  - right: a dark **New event** pill linking to `/events/new` (below 360 px wide, only a "+" icon, the link still named "New event"), not drawn when `eventsOwnedAtLimit(host.id)` is not `undefined`;
  - then a round button with `initialsOf(host.name)` (from `src/themes/poster-parts.tsx`), named "Account menu".
- [x] **The account menu**, a client component `src/app/(host)/account-menu.tsx` on `DropdownMenu` from `radix-ui` (no new package): first the host's display name and email (not items), then **Account** (`/account`), **Site settings** (`/instance`, only for the operator), a separator, **Sign out** (a form posting the existing `signOut` server action; a menu item that submits it). Keys under `Host.header.*`: `accountMenu` "Account menu", `newEvent` "New event", `account` (exists, now "Account"), `instanceSettings` (exists, now "Site settings"), `signOut` (exists). Keyboard and focus as Radix gives them; the focus ring is visible on the trigger and every item.
- [x] **The verification notice** (`verification-banner.tsx`) becomes a soft banner under the header on the ground (the attention tokens or a white card, the mockup's radius), with the same text and Resend form.
- [x] **The settings page's own name** says "Site settings": `Instance.title` and `Instance.reports.back` in English; the Chinese for these three keys is ticket 04's.
- [x] **Browser test helpers** (`e2e/hosts.ts`): `openAccountMenu(page)` (clicks "Account menu", waits for the menu); `signOut(page)` goes through it; `toSiteSettings(page)` opens the menu and chooses Site settings; `signUp` waits for the "Account menu" button in the banner, or the welcome sheet, in place of the host's name. Every spec that clicks or counts the link "Instance settings", the banner's "Sign out" button or the header's host-name link uses them: `operator.setup.ts`, `instance-settings.spec.ts`, `limits.spec.ts`, `registration.spec.ts`, `registration-without-mail.spec.ts`, `reports.spec.ts`, `turnstile.spec.ts`, `accessibility.spec.ts` (grep `e2e/` for `Instance settings`, `Sign out` and `title: t("account")`'s old link). "Not the operator" checks become: the open menu has no "Site settings" item.
- [x] Browser tests:
  - `instance-settings.spec.ts`: the operator opens the menu by keyboard (focus the trigger, Enter), sees their name and email, Account, Site settings and Sign out; arrow keys move between items; Escape closes it and the focus is back on the trigger; Site settings lands on the page headed "Site settings". A host who is not the operator sees no Site settings item.
  - Sign out from the menu lands signed out (through `signOut` in an existing spec, e.g. `host-accounts.spec.ts`).
  - `limits.spec.ts`: at the limit, `/dashboard` and `/account` have no "New event" link; below it, both do.
  - At 390 px the header fits on one line with a 40-character site name (on `app-fresh` in `home-page.spec.ts`, where the name may be set), and the page does not scroll sideways.
- [x] `accessibility.spec.ts`: axe on `/account` (new ground and header) and with the account menu open, at 390 px and desktop.

## Notes for the implementer

- The dashboard's own "New event" button stays until ticket 03 replaces the page; until then a dashboard has two links named "New event", so `events.spec.ts` line 27 scopes its click to the banner in this ticket.
- `eventsOwnedAtLimit` is in `src/events/limit.ts`; the layout already has `host` from `requireHost()`.
- The editor (`src/app/(editor)/`) has its own frame and is not touched.
- Commit subject, e.g. `Host area: every signed-in page has the new header, account menu and ground`.

## Comments

**2026-11-06, implementing agent (inline).** Done. `pnpm lint`, `pnpm typecheck` and `pnpm test` (83 files, 868 tests) pass. The browser specs ran on one Docker test image built with tickets 02 and 03 together (`CI=1`, two workers; see the ledger's ruling): `instance-settings`, `host-accounts`, `reports`, `events`, `accessibility` (host pages, settings, reports), `magic-link` and `turnstile` on both projects, and the `home-instance` chain (`registration`, `registration-without-mail`, `limits`, `retention`, `home-page`, 43 passed).

How it landed:

- **Ground**: `--host-ground` (a slightly cool tinted neutral), `--attention` / `--attention-soft` and `--destructive-soft` in `globals.css`, as Tailwind colours. Any page whose body holds the host header (`data-slot="host-header"`) is painted on the ground, the footer too, so `/instance` and `/instance/reports`, which draw the header themselves, get it as well. On that ground `--muted-foreground` takes `--neutral-600`: the footer's grey was 4.2:1 there, and axe said so on every host page.
- **Header** (`host-header.tsx`): the site's name (ellipsised), the New event pill (a "+" alone below 360 px, still named "New event"; not drawn at the event limit, through `eventsOwnedAtLimit`), and the initials button. It is `max-w-5xl`, the width the dashboard's shelves get in ticket 03.
- **Account menu** (`account-menu.tsx`, `DropdownMenu` from `radix-ui`): name and email, Account, Site settings (operator only), Sign out. Its words come from the header as props, so no client messages are sent. It is not modal: Radix's modal menu hid header, main and footer with `aria-hidden` while the initials stayed focusable, which axe refuses (`aria-hidden-focus`). Sign out submits a hidden form outside the menu with `requestSubmit()`: a form inside the menu's content is unmounted when the item is chosen, before it is sent.
- **Verification banner**: the attention fill, rounded, the title in the attention colour; same text and Resend form.
- **Site settings**: `Host.header.instanceSettings`, `Instance.title` and `Instance.reports.back` say "Site settings" in English; the Chinese is ticket 04's.
- **Specs**: `openAccountMenu`, `signOut` (through the menu), `toSiteSettings` and `offersSiteSettings` in `e2e/hosts.ts`; `signUp` waits for the Account menu button. Every spec that clicked or counted the old link or button uses them. New: the keyboard scenario in `instance-settings.spec.ts`, the New event pill on `/account` below and at the limit in `limits.spec.ts`, the header on one line with a 40-character name at 390 px in `home-page.spec.ts`, and axe on `/account` and the open menu in `accessibility.spec.ts`.
- Also moved to the menu: `host-accounts.spec.ts` (the two-device and rename scenarios), and a new `expectSignedInAs(page, name)` in `e2e/hosts.ts` for the four specs that read the host's name in the header (`home-page`, `magic-link`, `registration`, `turnstile`). The rename scenario now checks the initials ("GH") too.
- `registration-without-mail.spec.ts`'s restart scenario waits for the network to settle after Escape before it reloads: the dismissal is a request of its own, and a reload that beat it found the sheet again (flaky once in this run).

Evidence: the first run on the 02-only image failed 14 (68 axe `color-contrast` hits on the footer, 4 `aria-hidden-focus` with the menu open, and Sign out not leaving the dashboard); after the fixes above every spec listed passes.

Left for later tickets or noted: the Chinese for Site settings is ticket 04's.
