# 02: The home page as an invitation

**What to build:** `/` becomes an invitation to the instance: a gallery poster, the instance name as its title, the welcome line, a "How this works" card and a pinned bar with the way in. A fresh instance gets its setup version; a signed-in host goes to their events.

**Blocked by:** 01 The Home page card in Instance settings

**Status:** done

- [x] `src/app/page.tsx` decides the state: a session → `redirect("/dashboard")`; `hasAccounts()` false → fresh; otherwise the invitation, with `registrationMode()` setting the bar. The page reads the session, so it is dynamic: a change to the settings or the registration mode shows on the next visit.
- [x] In `src/instance/home.ts` (pure, unit tested):
  - `pickPoster(pool: GalleryPosterId[], random: () => number = Math.random): GalleryPosterId`.
  - `homeTheme(id: GalleryPosterId): Theme`: `DEFAULT_THEME` with that gallery poster, its look applied with `applyPosterLook`, and the effect forced to `"none"`.
  - `runBy(showOperator: boolean, operatorName: string | null): string | null`: the name when the setting is on and an operator exists, otherwise null.
  - The fresh state always picks from the whole gallery.
- [x] The page draws inside `ThemedPage` with that theme, reusing the Poster layout's parts, not copies of them:
  - `PosterHero` with the instance's name (or, when fresh, "Your OpenInvites is ready") as the title and no `when`;
  - the welcome line under it (or the fresh text);
  - when `runBy` returns a name, a line in the style of the event page's host line, with `initialsOf(name)` in the accent circle: "Run by {name}";
  - one `Glass` card (below);
  - the themed `PageFooter`;
  - the bar.
  If the reply bar's frame (the fixed glass bar in `rsvp-flow.tsx`) is not a component of its own, extract it into one in `src/themes/` and use it from both places, without changing what the event page draws. Its look and its layout at 390 px and at desktop width match the event page's.
- [x] Copy, keys under `Home.*` in all three languages (`status` and `tagline` go; by the controller's ruling only `status` goes here, and ticket 03 removes `title` and `tagline` with their last readers):
  - `defaultWelcome`: "Event invitations, made here: one link that is the invite, the reply and the place guests come back to."
  - `how.title` "How this works"; `how.invitedTitle` "Invited to something?"; `how.invitedText` "Open the link you were sent. Guests never need an account."; `how.hostingTitle` "Hosting?"; `how.hostingInvitationOnly` "Sign in to make an invitation. New hosts join with an invitation from whoever runs this site."; `how.hostingOpen` "Create an account to make your own invitation pages."
  - `signIn` "Sign in", `signUp` "Create an account", `runBy` "Run by {name}", `poweredBy` "Powered by OpenInvites".
  - `fresh.title` "Your OpenInvites is ready"; `fresh.text` "Create the first account to finish setting up. That account runs this site: you choose its name, who can join, and how long events are kept."; `fresh.stepsTitle` "Three steps"; `fresh.step1` "Create the operator account" / "The first account is the operator. Do it before you share the address."; `fresh.step2` "Name your instance" / "The name and a welcome line go on this page."; `fresh.step3` "Invite your hosts" / "Send host invitations, or open registration to everyone."; `fresh.button` "Create the operator account".
- [x] The card. Invitation: two rows (a link icon, then a pen icon from lucide), the hosting row's text set by the registration mode. Fresh: an ordered list of the three steps, numbered.
- [x] The bar. Invitation only: **Sign in** (primary, the accent). Open: **Create an account** (primary) and **Sign in**. Fresh: **Create the operator account** → `/sign-up`. These are links styled as the bar's buttons.
- [x] `PageFooter` gains `poweredBy?: boolean`: a first item "Powered by OpenInvites" linking to `SOURCE_URL = "https://github.com/leongyeehang/OpenInvites"` (one constant, in `src/instance/source.ts`). Only the home page passes it.
- [x] `generateMetadata` in `src/app/page.tsx`: the title is `instanceDisplayName(page)`, the description the welcome line or `defaultWelcome`. Fresh: "OpenInvites".
- [x] Unit tests: `pickPoster` at `random` 0 and just under 1 and with a one-poster pool; `homeTheme` taking Disco's font and placement with no effect; `runBy` in its four cases.
- [x] Browser tests:
  - `e2e/home.spec.ts` (shared `app`: Open, no name), rewritten:
    - the heading "OpenInvites" and the default welcome line show; **Create an account** comes before **Sign in** in the bar and both lead to their pages; "Powered by OpenInvites" links to the repository; switching to 简体中文 and reloading keeps it; a zh-TW browser sees Traditional Chinese;
    - a signed-in host opening `/` lands on `/dashboard`;
    - at 390 px the bar is fixed to the foot of the screen and the page does not scroll sideways.
    - The health check test stays.
  - `e2e/home-page.spec.ts` (from ticket 01), extended. Before the first sign-up, `/` shows "Your OpenInvites is ready", the three steps, and one button that leads to `/sign-up`. After the operator exists and with nothing set:
    - Invitation only: the bar has **Sign in** alone and the hosting row says new hosts need an invitation;
    - after a name and welcome line are saved, `/` shows them and the tab title is the name;
    - a name of 40 characters with no spaces wraps without the page scrolling sideways at 390 px;
    - with "Always the same poster" set to Disco, two visits both show Disco (the poster image's `src` names `disco-ball`);
    - with "Only the ones I pick" set to Candlelight and Rose garden, five visits show only those two;
    - "Run by" with the operator's display name shows only while the setting is on;
    - with registration switched to Open, the next visit shows **Create an account** first.
- [x] `e2e/legal-and-analytics.spec.ts` and any other spec that opens `/` and expects the old text are updated.

## Notes for the implementer

- `src/themes/poster-layout.tsx` is the event page's Poster layout: the host line, `Glass`, `SectionLabel`, `initialsOf`. `src/themes/poster-card.tsx` has `PosterHero`. The home page is not an event, so pass it only what those parts need; do not fake an event.
- The root layout draws the plain footer under every page and hides it under a themed page (`themed:hidden`), as on an event page.
- Commit subject, e.g. `Home: every instance opens on an invitation to it`.

## Comments

**2026-11-04, implementing agent.** Done. `pnpm lint`, `pnpm typecheck` and `pnpm test` (81 files, 851 tests) pass. Against the Docker test profile rebuilt with this change (`CI=1`): `e2e/home.spec.ts` on mobile and desktop (11 passed with the operator setup), `e2e/home-page.spec.ts` under `home-instance` (13 passed, `--no-deps`: the spec recreates `app-fresh` itself), `legal-and-analytics`, `rsvp-sheet`, `poster` and `polls` on both widths (35 passed), and the anyone-can-open, Poster and RSVP-flow cases of `accessibility.spec.ts` with `reduced-motion.spec.ts` on both widths (23 passed).

How it landed: `src/app/page.tsx` redirects a session to `/dashboard`, draws the fresh state when `hasAccounts()` is false, and otherwise the invitation with `registrationMode()` setting the card's hosting row and the bar. It renders inside `ThemedPage` with `homeTheme(pickPoster(posterPool(...)))` (the fresh state draws from `DEFAULT_HOME_PAGE`, the whole gallery), `PosterHero` with no `when`, the welcome line, `HostLine` for "Run by", one `Glass` card titled with `SectionLabel`, rows in `IconTile`s (lucide `LinkIcon` and `PenLine`; numbers in an `<ol>` when fresh), `PinnedBar` with `Link`s styled by `rsvpButtonClasses` (`solid` for the primary, `glass` for Sign in beside Create an account), and `PageFooter themed poweredBy`. `generateMetadata` gives the instance's name and welcome line (or `defaultWelcome`), and "OpenInvites" when fresh. `pickPoster`, `homeTheme`, `runBy` are in `src/instance/home.ts`; `operatorName()` in the repository; `SOURCE_URL` in `src/instance/source.ts`.

Decisions and things to know:
- The bar's frame was drawn twice already (rsvp-flow.tsx and poll-flow.tsx's `PollBar`); it is now `src/themes/pinned-bar.tsx`, used by both and the home page, with the same classes and the `data-slot` passed in (`rsvp-bar` on events, `home-bar` here). The event page's DOM is unchanged.
- The host line and the icon tile were inline in the Poster layout; they are now `HostLine` and `IconTile`. With `SectionLabel`, `initialsOf`, `CAPS` and the entrance classes they moved to `src/themes/poster-parts.tsx`, because importing `poster-layout.tsx` from the home page brings the event sections' client components with it, which `client-messages.test.ts` refuses (they read `EventPage.*`). `guest-list.tsx` and `thread-layout.tsx` import from there now.
- "Powered by OpenInvites" is the footer's first item, on a pill of its own above Privacy and Terms: in one row the three wrapped inside the pill at 390 px.
- The key `Home.poweredBy` is read by `PageFooter`, as the ticket names it.
- Only `Home.status` goes (controller's ruling); `Home.title` and `Home.tagline` stay for the root layout and the host header until ticket 03.

Left for later tickets or noted:
- Ticket 05: a one-word title wider than the column breaks mid-word in the shared `PosterTitle` ("OpenInvite / s" in the grotesque face at desktop width under Sunshine or Aurora, title below the poster). An event titled the same breaks the same way; the fix belongs to the poster title's sizes, not the home page, and was left alone so as not to change the event page.
- Ticket 05: the accessibility and reduced-motion runs saw one random poster per visit; the three states at both widths are its to cover.
- Ticket 04: the serial spec's second scenario is where the operator signs up; the welcome sheet's dismissal goes there.
- Chinese least sure of: `how.title` "使用方式", `poweredBy` "由 OpenInvites 驱动 / 驅動", `defaultWelcome`.

Evidence:
- RED: `pnpm exec vitest run src/instance/home.test.ts` → `Tests 4 failed | 18 passed (22)`, e.g. `TypeError: runBy is not a function` (and `pickPoster`, `homeTheme` likewise).
- GREEN: the same command → `Tests 22 passed (22)`.
- Browser (Docker test profile, `CI=1`): home.spec 11 passed; home-page.spec 13 passed; legal-and-analytics + rsvp-sheet + poster + polls 35 passed; accessibility (pages anyone can open, Poster, RSVP flow) + reduced-motion 23 passed.

**2026-11-04, implementing agent, review fix.** The review ruled that a title whose words fit keeps them whole on the home page. `PosterHero` takes `fitTitle` (only the home page passes it), which hands `PosterTitle` the width its title has (`fitTo`: the card's 100cqi below the poster, the poster's own width on it). The title is then set inside the heading at `min(1em, max(1.75rem, (width − 3rem) / widest word in ems))`. The widest word's width is estimated from its letters in `src/themes/title-fit.ts` (per face: capitals and figures, m/w, the rest, measured in a browser from the shipped fonts, plus 8% room; Chinese, Japanese and Korean characters count as one-character words). Event pages are unchanged: without the prop `PosterTitle` draws as before. The 40-character name with no spaces still breaks, at the 1.75rem floor. Tailwind inlines the `--text-poster-*` sizes (`@theme inline`), so the fitted size is set on a block span inside the `h1`, where 1em is the class's size. The `home-page.spec.ts` scenario "the name keeps its word whole…" checks "OpenInvites" on one line, at least 28px, at 1280 and 390 px, under Sunshine, Aurora, Seaside, Candles, Candlelight, Disco and Balloons (one poster per face and placement). Run against the image built before the fix, it failed with "Sunshine at 1280 px, Expected: 1, Received: 2". After the fix all 14 scenarios pass. `title-fit.test.ts` failed first because the module did not exist, then passed 5 of 5. `e2e/home.spec.ts`, `poster.spec.ts` and the anyone-can-open accessibility case passed on both widths (35 passed).
