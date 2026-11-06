# 02: The frame of every signed-in page

**What to build:** Every signed-in page sits on a soft tinted ground, under a header with the site's name, a New event pill and the host's initials opening an account menu. The other host pages keep their own content.

**Blocked by:** nothing

**Status:** open

- [ ] **The ground.** Tokens in `src/app/globals.css` for the host area's ground (a soft, slightly cool tinted neutral, as in the mockup; not white, not cream), its header and its chips' attention (amber) and danger (rose) colours, with text on each at 4.5:1 or more. `src/app/(host)/layout.tsx` paints the ground behind the header and `main`. The white cards of the other host pages are unchanged and sit on it.
- [ ] **The header** (`src/app/(host)/host-header.tsx`), in the mockup's shape:
  - left: the site's name (`instanceDisplayName(await homePage())`, as now), linking to `/dashboard`, ellipsised on one line when long;
  - right: a dark **New event** pill linking to `/events/new` (below 360 px wide, only a "+" icon, the link still named "New event"), not drawn when `eventsOwnedAtLimit(host.id)` is not `undefined`;
  - then a round button with `initialsOf(host.name)` (from `src/themes/poster-parts.tsx`), named "Account menu".
- [ ] **The account menu**, a client component `src/app/(host)/account-menu.tsx` on `DropdownMenu` from `radix-ui` (no new package): first the host's display name and email (not items), then **Account** (`/account`), **Site settings** (`/instance`, only for the operator), a separator, **Sign out** (a form posting the existing `signOut` server action; a menu item that submits it). Keys under `Host.header.*`: `accountMenu` "Account menu", `newEvent` "New event", `account` (exists, now "Account"), `instanceSettings` (exists, now "Site settings"), `signOut` (exists). Keyboard and focus as Radix gives them; the focus ring is visible on the trigger and every item.
- [ ] **The verification notice** (`verification-banner.tsx`) becomes a soft banner under the header on the ground (the attention tokens or a white card, the mockup's radius), with the same text and Resend form.
- [ ] **The settings page's own name** says "Site settings": `Instance.title` and `Instance.reports.back` in English; the Chinese for these three keys is ticket 04's.
- [ ] **Browser test helpers** (`e2e/hosts.ts`): `openAccountMenu(page)` (clicks "Account menu", waits for the menu); `signOut(page)` goes through it; `toSiteSettings(page)` opens the menu and chooses Site settings; `signUp` waits for the "Account menu" button in the banner, or the welcome sheet, in place of the host's name. Every spec that clicks or counts the link "Instance settings", the banner's "Sign out" button or the header's host-name link uses them: `operator.setup.ts`, `instance-settings.spec.ts`, `limits.spec.ts`, `registration.spec.ts`, `registration-without-mail.spec.ts`, `reports.spec.ts`, `turnstile.spec.ts`, `accessibility.spec.ts` (grep `e2e/` for `Instance settings`, `Sign out` and `title: t("account")`'s old link). "Not the operator" checks become: the open menu has no "Site settings" item.
- [ ] Browser tests:
  - `instance-settings.spec.ts`: the operator opens the menu by keyboard (focus the trigger, Enter), sees their name and email, Account, Site settings and Sign out; arrow keys move between items; Escape closes it and the focus is back on the trigger; Site settings lands on the page headed "Site settings". A host who is not the operator sees no Site settings item.
  - Sign out from the menu lands signed out (through `signOut` in an existing spec, e.g. `host-accounts.spec.ts`).
  - `limits.spec.ts`: at the limit, `/dashboard` and `/account` have no "New event" link; below it, both do.
  - At 390 px the header fits on one line with a 40-character site name (on `app-fresh` in `home-page.spec.ts`, where the name may be set), and the page does not scroll sideways.
- [ ] `accessibility.spec.ts`: axe on `/account` (new ground and header) and with the account menu open, at 390 px and desktop.

## Notes for the implementer

- The dashboard's own "New event" button stays until ticket 03 replaces the page; until then a dashboard has two links named "New event", so `events.spec.ts` line 27 scopes its click to the banner in this ticket.
- `eventsOwnedAtLimit` is in `src/events/limit.ts`; the layout already has `host` from `requireHost()`.
- The editor (`src/app/(editor)/`) has its own frame and is not touched.
- Commit subject, e.g. `Host area: every signed-in page has the new header, account menu and ground`.

## Comments
