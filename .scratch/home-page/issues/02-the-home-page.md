# 02: The home page as an invitation

**What to build:** `/` becomes an invitation to the instance: a gallery poster, the instance name as its title, the welcome line, a "How this works" card and a pinned bar with the way in. A fresh instance gets its setup version; a signed-in host goes to their events.

**Blocked by:** 01 The Home page card in Instance settings

**Status:** ready-for-agent

- [ ] `src/app/page.tsx` decides the state: a session → `redirect("/dashboard")`; `hasAccounts()` false → fresh; otherwise the invitation, with `registrationMode()` setting the bar. The page reads the session, so it is dynamic: a change to the settings or the registration mode shows on the next visit.
- [ ] In `src/instance/home.ts` (pure, unit tested):
  - `pickPoster(pool: GalleryPosterId[], random: () => number = Math.random): GalleryPosterId`.
  - `homeTheme(id: GalleryPosterId): Theme`: `DEFAULT_THEME` with that gallery poster, its look applied with `applyPosterLook`, and the effect forced to `"none"`.
  - `runBy(showOperator: boolean, operatorName: string | null): string | null`: the name when the setting is on and an operator exists, otherwise null.
  - The fresh state always picks from the whole gallery.
- [ ] The page draws inside `ThemedPage` with that theme, reusing the Poster layout's parts, not copies of them:
  - `PosterHero` with the instance's name (or, when fresh, "Your OpenInvites is ready") as the title and no `when`;
  - the welcome line under it (or the fresh text);
  - when `runBy` returns a name, a line in the style of the event page's host line, with `initialsOf(name)` in the accent circle: "Run by {name}";
  - one `Glass` card (below);
  - the themed `PageFooter`;
  - the bar.
  If the reply bar's frame (the fixed glass bar in `rsvp-flow.tsx`) is not a component of its own, extract it into one in `src/themes/` and use it from both places, without changing what the event page draws. Its look and its layout at 390 px and at desktop width match the event page's.
- [ ] Copy, keys under `Home.*` in all three languages (`status` and `tagline` go):
  - `defaultWelcome`: "Event invitations, made here: one link that is the invite, the reply and the place guests come back to."
  - `how.title` "How this works"; `how.invitedTitle` "Invited to something?"; `how.invitedText` "Open the link you were sent. Guests never need an account."; `how.hostingTitle` "Hosting?"; `how.hostingInvitationOnly` "Sign in to make an invitation. New hosts join with an invitation from whoever runs this site."; `how.hostingOpen` "Create an account to make your own invitation pages."
  - `signIn` "Sign in", `signUp` "Create an account", `runBy` "Run by {name}", `poweredBy` "Powered by OpenInvites".
  - `fresh.title` "Your OpenInvites is ready"; `fresh.text` "Create the first account to finish setting up. That account runs this site: you choose its name, who can join, and how long events are kept."; `fresh.stepsTitle` "Three steps"; `fresh.step1` "Create the operator account" / "The first account is the operator. Do it before you share the address."; `fresh.step2` "Name your instance" / "The name and a welcome line go on this page."; `fresh.step3` "Invite your hosts" / "Send host invitations, or open registration to everyone."; `fresh.button` "Create the operator account".
- [ ] The card. Invitation: two rows (a link icon, then a pen icon from lucide), the hosting row's text set by the registration mode. Fresh: an ordered list of the three steps, numbered.
- [ ] The bar. Invitation only: **Sign in** (primary, the accent). Open: **Create an account** (primary) and **Sign in**. Fresh: **Create the operator account** → `/sign-up`. These are links styled as the bar's buttons.
- [ ] `PageFooter` gains `poweredBy?: boolean`: a first item "Powered by OpenInvites" linking to `SOURCE_URL = "https://github.com/leongyeehang/OpenInvites"` (one constant, in `src/instance/source.ts`). Only the home page passes it.
- [ ] `generateMetadata` in `src/app/page.tsx`: the title is `instanceDisplayName(page)`, the description the welcome line or `defaultWelcome`. Fresh: "OpenInvites".
- [ ] Unit tests: `pickPoster` at `random` 0 and just under 1 and with a one-poster pool; `homeTheme` taking Disco's font and placement with no effect; `runBy` in its four cases.
- [ ] Browser tests:
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
- [ ] `e2e/legal-and-analytics.spec.ts` and any other spec that opens `/` and expects the old text are updated.

## Notes for the implementer

- `src/themes/poster-layout.tsx` is the event page's Poster layout: the host line, `Glass`, `SectionLabel`, `initialsOf`. `src/themes/poster-card.tsx` has `PosterHero`. The home page is not an event, so pass it only what those parts need; do not fake an event.
- The root layout draws the plain footer under every page and hides it under a themed page (`themed:hidden`), as on an event page.
- Commit subject, e.g. `Home: every instance opens on an invitation to it`.

## Comments
