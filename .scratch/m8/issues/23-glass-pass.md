# 23: Glass: every restyled page is proven readable, still and keyboard-friendly in three languages, and the docs and screenshots show it

**What to build:** The pass that ends the Glass part. Every page tickets 18 to 22 put on a poster is checked in every state it has: axe at a phone's width and a desktop's, the pixel contrast of its words and its focus rings on a light poster and a dark one and on a host's busy picture, keyboard reach, nothing moving with or without reduced motion, and the three languages. The docs say how a page joins the site's look; the operator docs say the home page's posters now dress the signed-out and notice pages and Site settings; the README's screenshots show the new look; the release note gains the part's section.

**Blocked by:** 17, 18, 19, 20, 21, 22

**Status:** done

**Stories:** 297, 298, 299, 300, 301

**Interfaces**
- Consumes: everything tickets 17 to 22 produce, in particular `SitePage`, `Veil`, `SITE_SURFACES`, `areaLook`, the `.site-page` scope, `e2e/site-look.ts` (`expectSiteLook`, `SITE_POSTERS`) and `e2e/contrast.ts` (`worstContrast`, `expectRingStandsOut`); `expectNoSeriousViolations` (`e2e/axe.ts`), `expectStill` (`e2e/still.ts`).
- Produces: new rows in existing specs; `docs/screenshots/sign-in.webp`; the docs below; the release note's Glass section. No new code paths: a fix this pass needs is the smallest change to the ticket's file that owns it, named in Comments.

- [x] Contrast over a long page: add to `e2e/site-look.spec.ts` "a long guest list reads to its last row on a busy picture": the striped upload of ticket 21 as the poster, thirty guests replied (from one address, within the reply limit of the shared `app`, or across addresses with `clientAddress()`), the guest list scrolled to its last row: `worstContrast` of that row's name and reply time is at least 4.5, and the header's site-name link at the top is at least 4.5. Watch it pass; if it fails, the cause and fix go in Comments.
- [x] Every site area in both tones: add "every area reads in both text tones": for each of `/sign-in` (Bokeh, light text), `/privacy` (Cake, dark text), `/instance` (Rose, light text, as the operator), and a host's `/account` with the Backdrop set to Cake, then Disco, `worstContrast` of the h1 and of one muted line (a card's description, a hint, or the footer's Privacy link) is at least 4.5, and `expectRingStandsOut` holds for the first field or button in the page's main.
- [x] axe (`e2e/accessibility.spec.ts`), at 390 px and at 1280 px: the co-host link page signed out and signed in; the retired link and not-ready pages; `/account` with the Backdrop card on Automatic and with a poster; `/dashboard` empty and with every shelf; `/events/new`; an event's guests, invites, share, hosts and announcements pages on a picture poster; Site settings with a confirmation open; the reports page with a report. Contrast over the backdrop is reported incomplete by `e2e/axe.ts` and is proven by the rows above; any other serious violation is fixed.
- [x] Keyboard (`e2e/keyboard.spec.ts`): "every site page shows its focus on its poster": by Tab from the top of `/sign-in`, `/forgot-password`, `/account`, `/events/{id}/invites` and `/instance`, the first five stops each show a ring that `expectRingStandsOut` passes, and the site-name link above the sign-in card is the first stop of `/sign-in`.
- [x] Reduced motion (`e2e/reduced-motion.spec.ts`): the opening list gains `/forgot-password` and `/no-such-page`; the host's walk gains `/account`, `/events/{id}/invites`, `/hosts` and `/announcements`; the operator's gains `/instance/reports`; each `expectStill`. Without reduced motion, `e2e/site-look.spec.ts`'s `expectSiteLook` already finds no animation on every area.
- [x] Locales (`e2e/locales.spec.ts`): zh-Hant on `/sign-in` (the card and the site's name above it), on `/account` (the Backdrop card's title, Automatic and Save), and on the locked page; zh-Hans on `/too-fast` and the stop-mail page. Read every `Account.backdrop` string in both scripts against the English and list in Comments the ones least sure of, with the reason.
- [x] Docs:
  - `docs/contributing/backgrounds.md`: "When the backdrop changes" points at `src/themes/backdrop.tsx`; a new section "Every other page" says that a page that is not an event page wraps itself in `SitePage` with a look from `src/instance/site-look.ts`, that headings outside a panel sit on `Veil` and the rest in glass, that `.site-page` in `globals.css` makes shadcn's components glass, that a surface `SURFACES` and `SITE_SURFACES` do not list must be added there and to `legibility.test.ts`, and that `still` changes nothing that is measured.
  - `docs/contributing/posters.md:91`, and the comments that name `themed-page.tsx` as the backdrop (`src/themes/backgrounds.ts:14`, `:23`, `src/uploads/renditions.ts`, `src/uploads/process.ts`, `src/uploads/sample.test.ts`), name `backdrop.tsx`.
  - `docs/operator/configuration.md`, "The home page" (`:126-150`): the posters chosen there also dress sign-in and the other signed-out screens, the notice pages a guest meets (locked, report, a reset link, not ready, stop email) and Site settings, each wearing one of them, the same on every visit; the pages drawn without the database (not found, too fast, privacy, terms) wear one of the whole gallery.
  - `README.md`, "What it does": the hosts' bullet says every page wears a poster, the host's pages their next event's or one they pick in Account, and an event's own pages that event's.
- [x] Screenshots: `scripts/screenshots.ts` gains `sign-in.webp` (phone, the shared look); `pnpm screenshots` regenerates `dashboard.webp` and `guest-list.webp` among the rest; `README.md` shows `sign-in.webp` in its first row, and the alt texts of `dashboard.webp`, `guest-list.webp` and the new one say what is on screen, the poster behind included.
- [x] Release note: `.scratch/m8/release-note-0.8.0.md` (created here in the shape of `.scratch/m6-invited/release-note-0.6.0.md` if no earlier part has) gains a section "Poster and glass on every page": the areas and which poster each wears, the Backdrop card, nothing moves, every word proven to read; and under Upgrading, that the home page's posters now dress the signed-out pages and Site settings, and the migration that adds `host_look`.
- [x] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`; `df -h /` and `docker builder prune -f` first if the disk is near full; the Docker test profile rebuilt; then `CI=1 pnpm exec playwright test --workers=2` over every project, since this part restyles every page. Results per project in Comments, each failure or flake named with its spec and whether it is this part's. Comments entry, with the glossary proposal below; commit `Glass: every restyled page proven readable and still, with docs and screenshots`.

- [x] Review focus (plan). Browser, `e2e/site-look.spec.ts`, under `page.emulateMedia({ forcedColors: "active" })` on `/sign-in` and `/account`: every heading, field label and button text has a computed colour different from its computed background colour, and the focused field has an outline of at least 2px. Under a light-text backdrop, an open native `<select>` on `/instance` is checked by hand and the result noted in Comments (its options are drawn by the browser, outside any test's reach).

## Notes for the implementer

- Anything an earlier Glass ticket left as a follow-up in its Comments is listed here for the maintainer, not fixed silently.
- The glossary proposal to copy into Comments, for the maintainer's `CONTEXT.md` (not edited here): **Backdrop**: what fills a page that is not an event page: a poster's blurred copy, still. The glossary's Background stays the event page's.
- Never kill `next-server` by name: it also stops the Docker test app mid-run. A rebuild of the test profile per ticket fills the disk; prune the build cache before uploads start failing.
- `pnpm measure:backgrounds` is not needed: `Backdrop` at rest is what it was. If this pass changes how it looks (the blobs, the fade, the grain, the blur), it is needed, and `pnpm posters` too.

## Comments

### 2026-11-12: landed (Opus 5.5)

**How it landed.** The rows the ticket names are in place, the docs and the release note say what
it asks, and `sign-in.webp` is in the README's first row. Each proof that found a fault had the
fault fixed in the file that owns it (below). `Backdrop` at rest is unchanged, so neither
`pnpm measure:backgrounds` nor `pnpm posters` was needed; nothing was added to `SURFACES` or
`SITE_SURFACES`, and "a site page's glass is settled" passes unchanged.

**Tests added.**
- `site-look.spec.ts`: "a long guest list reads to its last row on a busy picture" (the bands
  upload, thirty guests replying five at a time from addresses of their own; the site's name, the
  last row's name and reply time at 4.5 or more); "every area reads in both text tones" (sign-in on
  Bokeh, privacy on Cake, Site settings on Rose as the operator, Account with the Backdrop on Cake
  then Disco: the h1, a muted line and the first control's ring; privacy has no control in its
  main, so the footer's Privacy policy link is ringed there); "forced colours keep every word apart
  from what is behind it" (review focus: `/sign-in` and `/account`, every visible h1/h2/h3, label and
  button in main has a colour unlike the first opaque background behind it, and a focused field an
  outline of 2px or more); "a former co-host learns nothing of an event's look" (item e); the
  hovered edge on sign-in (item h); the chosen poster's tick and ring (item c).
- `accessibility.spec.ts`: New event (its draft's post held), Site settings with Clear the album's
  confirmation open (after an album photo of the test's own) and closed with Never mind, the five
  event pages on the Disco poster, the page a reset link leads to; Account's two Saves (item d). The
  rest of the ticket's list was already read: the co-host link page signed out and in, not ready,
  Account on Automatic and with a poster, the dashboard empty and with every shelf, the reports page.
- `keyboard.spec.ts`: "every site page shows its focus on its poster": `/sign-in`,
  `/forgot-password`, `/account`, `/events/{id}/invites`, `/instance`, the first five Tab stops of
  each ringed at 3:1 (`expectRingStandsOut`), the site's name first on `/sign-in`. The ring round
  the initials is read with the New event pill hidden, as ticket 20's row does.
- `reduced-motion.spec.ts`: `/forgot-password`, `/no-such-page`, `/account`, the event's invites,
  hosts and announcements pages, and `/instance/reports`, each `expectStill`.
- `locales.spec.ts`: zh-Hant sign-in (title, field, button, the site's name) and the locked page;
  zh-Hans too fast and the stop-mail page; the Backdrop card's Save in zh-Hant (its title and
  Automatic were already read by ticket 22's row).

**Fixes this pass needed (each the smallest change in the file that owns it).**
- **A default button's hovered edge never showed under light text** (`globals.css`, ticket 19's
  rule). The edge was the border, which is clipped out of the fill (`padding-box`) and shows the
  glass behind; under light text the words' colour on the border is as dark as that glass. Measured
  on sign-in: 1.08:1. The edge is now an inset 1px shadow in the words' colour inside the fill, as
  ticket 20 drew the link-buttons' hover; 3:1 or more.
- **The chosen poster's ring on Cake was 2.26 to 2.29:1 against the card** (`poster-choices.tsx`).
  It is now in the focus ring's colour (`ring-ring`), which `legibility.ts` solves to stand out at
  3:1 from every surface, rather than the accent. This changes Site settings' small picker too.
- **Account's Sign out sat on the bare backdrop**, so its focus ring did as well, which nothing
  solves it against: 1.67:1 at the top of the golden-hour gradient a new event wears. It now sits
  on a `Veil`, as the heading beside it does.
- **Account's two Saves** are each `aria-describedby` their card's title (`display-name-title`,
  `backdrop-title`). Naming each form instead was tried first and dropped: a form named "Display
  name" is also found by `getByLabel("Display name")`, which every spec reading that field uses.

**The items carried in from the reviews of tickets 18 to 22.**
- (a) `e2e/axe.ts` leaves `color-contrast` out inside `.site-page`, and reads it once, outside the
  scope, for what is portalled over the page (dialogs, menus), which is opaque. Before, on Account,
  axe left 62 pieces of text incomplete and measured 5, all accent buttons (onAccent on the accent,
  which `legibility.ts` proves). Event pages read it exactly as before. "a host's own pages…" at two
  workers, idle machine: 90.6 s mobile and 88.2 s desktop before, 77.0 and 76.6 s after (a first
  after-run of 109 s was beside CPU-burning loops of my own and is set aside). Under its old budget,
  but with 13 s to spare where ticket 21 saw it time out beside other tests, so it is also split
  where it divides, each back on `test.slow()`: "a host's own pages: the dashboard, the account page
  and its menu, New event, the share screen and the guest list" and "the editor and its sheets…".
  In the full run: 26.3 and 25.8 s, and 73.4 s mobile and 58.8 s desktop (the editor's sheets are an
  event page's, read a view at a time as before).
- (b) With 40 reports and 20 host invitations on the shared `app` (`select count(*)` only), the
  instance settings accessibility test took 14.9 s mobile and 13.0 s desktop, the reports one 18.4
  and 14.3 s, alone at two workers; 15.1/11.6 s and 19.4/17.7 s in the full run. Both are under a
  quarter of their 90 s now that axe no longer reads a site page's contrast a view at a time. If
  the rows grow again, the page-side remedy is paging the reports inbox (`listReports` has no
  limit) and the host invitations list; not built.
- (c) In "the Backdrop card by keyboard, and its words", on Disco and on Cake: the chosen poster's
  tick at 3:1 or more on its disc (`worstContrast`, a graphic's threshold), and the ring round the
  chosen poster against the card with no focus anywhere, by a new `expectMarkStandsOut`
  (`e2e/contrast.ts`), which `expectRingStandsOut` now calls with focus and blur. Fix above.
- (d) Above.
- (e) `site-look.spec.ts`: while a co-host, the HTML of `/events/{id}/guests` holds `disco-ball-copy`
  and `/fonts/syne-800.`; once removed, it is the not-found page (`expectNotFoundAsSent`: 404, its
  h1 "Page not found") and holds neither `disco-ball` nor `syne-800`. Passed first time.
- (f) The convention more places use: a list's rows reach the panel's edges with `p-4`, divided by
  `divide-y divide-theme-glass-border`, with one line between the list and whatever else shares the
  panel (the guest sections, invites, announcements, the hosts list and the reports inbox). The
  hosts page's pending co-host links were the odd one (inset by the panel's padding, rows `py-3`):
  that panel now has no padding of its own, its heading `px-4 pt-4 pb-3`, rows `p-4`, and the link
  form in a `p-4` block below the list.
- (g) **What the 77 transitions are**, reproduced 2 times in 20 loads of `/sign-in` at 390px with
  three CPU-burning loops beside the browser (none in 40 loads without them, with CPU throttling
  ×4 and ×10 or a slow network): every property of shadcn's `transition-all` on the buttons
  (font-size, padding, margin, border widths and radii, flex-shrink, tab-size, colours) and the
  colour properties of the fields' transitions, moving from the browser's defaults to the page's.
  The controls' style was computed once before the page's one stylesheet had applied; no script of
  the app asked for it (no `getComputedStyle`, no autofocus), and no class or font changed (the
  screen loads no web font; no `class` or `style` attribute changed). A person is unlikely to see
  it: the transitions began 140 to 190 ms before the first paint and last 150 ms, so they had
  ended, or were within a frame of it, when anything was drawn. Not fixed: suppressing them needs
  a class removed after load (a script and a rule), not one rule. For the maintainer.
- (h) `expectHoverEdgeStandsOut` (`e2e/contrast.ts`) reads 2px outside to 4px inside a control's
  left edge, hovered and not; one row on sign-in's Sign in. It found the fault above.

**Review focus.** Forced colours: the row above. The native `<select>` on `/instance` under light
text: Site settings draws no native select today (none on the page, checked in the browser), so
there is nothing to open there; the native selects on site pages are on an event's pages (ticket
21). I could not open a browser-drawn popup by hand here. Under light text the scope sets
`color-scheme: dark`, which is what has Chrome draw the popup dark; checking one by eye is left to
the maintainer.

**Backdrop strings in both scripts, least sure first.**
- `title`, 页面底图 / 頁面底圖: a coinage ("the page's base picture"). It keeps the Backdrop apart
  from the event's Background (背景), as the glossary wants, but 底图 also reads as a GIS "base
  map"; 背景图 would be plainer and would blur that line.
- `description`: "dashboard" is rendered as the dashboard's own title in quotes (“我的活动”,
  「我的活動」), as "New event" is (“新建活动”, 「新增活動」); it matches what the host sees, but
  reads as a list of page names rather than a description.
- `automaticHint`, 你下一个活动的海报，或本站的一张海报。: "one of this site's" becomes "one of
  this site's posters", which is right but does not say the site picks it.
- `automatic`, `submit`, `saved`, `unknown`: as the English, and 图库 / 圖庫 for the gallery match
  the editor's Gallery tab.

**Docs.** `backgrounds.md` ("When the backdrop changes" names `backdrop.tsx`; new "Every other
page"), `posters.md`, the comments in `backgrounds.ts`, `renditions.ts`, `process.ts` and
`sample.test.ts`, `configuration.md` ("The home page"), the README's hosts bullet and its pictures.
Beyond the ticket: `upgrade-backup.md`'s "Upgrading to 0.8" said nine migrations, `0054` to `0062`;
it now says ten, to `0063`, with a bullet on the posters and `host_look`. `renditions.ts:49` says
the page chooses the portrait cut "(themes/backdrop.tsx, max-aspect-ratio: 2/3)": nothing in the
page code chooses it today (it already named `themed-page.tsx` wrongly); renamed as the ticket asks,
and left for the maintainer.

**Screenshots.** `pnpm screenshots` runs against port 3000, the test profile's `app`, signs a host
up and changes the Home page card for one picture and puts it back (checked after: name and welcome
line empty, all posters); it resets nothing. It now saves `sign-in.webp` first and waits for the
backdrop's picture before each save. Committed: `sign-in.webp` (new), `dashboard.webp` and
`guest-list.webp` (now on the event's golden-hour poster in glass). The other six it rewrote show
pages this part does not touch and were put back.

**Left for the maintainer (from tickets 17 to 22 and this pass).**
- Ticket 17: no ink reads on its own 30% tint over the event page's surfaces, so `INK_TINT` was not
  made; the inks are proven alone. Ticket 18: a field's border under light text is light, and
  pixel checks of a field's words make it transparent first. Ticket 19: a button's half-pixel rows
  are painted over while its words are read (`buttonWordsContrast`). Ticket 20: the local database
  had once grown to 350 host invitations and 657 reports, and those rows were cleared by hand
  before the rule against it; paging the reports inbox (above). Ticket 20's "77 transitions" (item
  g above). Ticket 21: the editor's sheets are slow for axe at two workers (73 s of 90 in the full
  run, mobile). Ticket 22: none open.
- The 77 transitions (item g); `renditions.ts:49` (above); the native select by eye (above).
- "every area reads in both text tones" took 72.7 s of its 90 on desktop in the full run (20 s
  alone): if it flakes, it divides at the host's Account.

**Glossary proposal** for `CONTEXT.md` (not edited here): **Backdrop**: what fills a page that is
not an event page: a poster's blurred copy, still. The glossary's Background stays the event page's.

**Evidence.** RED, against the test profile before each fix: the hovered edge 1.08:1 (both
widths); the chosen poster's ring on Cake 2.29 and 2.26:1; Account's fourth Tab stop (Sign out)
1.67:1 (both widths). GREEN: the same rows after. `pnpm lint` and `pnpm typecheck` clean;
`pnpm test` 119 files, 1412 tests. Full suite on the rebuilt test profile, `CI=1 pnpm exec
playwright test --workers=2`, 2.4 h: operator 1 passed; mobile 455 passed, 2 skipped, 1 flaky;
desktop 458 passed; fresh-instance 15, limits-instance 12, retention-instance 5,
album-reminder-instance 5, home-instance 19, worker-instance 1, features-instance 5,
sizes-instance 2, all passed. The flaky one is `keyboard.spec.ts:76` [mobile] (the Broadsheet
ballot, "nothing has the focus" at Tab 13), the known one, not this part's; alone it passed.

### 2026-11-15: Glass part review fixes (Opus 5.5)

The one fix pass after the glass part's two reviews (ticket 23's task review and the review of the
whole part, `part-glass-review.md`), from the controller's brief. Tickets 24 to 26 had landed
first; nothing of theirs is undone.

**A control never sits on the bare backdrop (the part review's one Important finding).**
- `expectSiteLook` (`e2e/site-look.ts`) now also holds, on every page it reads: every visible
  control a person can reach (links, buttons, fields, selects, `[tabindex]` not -1) inside a
  surface its focus ring is proven against, known by `data-slot`: `veil`, `glass`, `card`, `alert`,
  `host-header`, `page-footer`; and one `main` and one `h1` (a legal page's own text, inside
  `legal-text`, may hold more). `Glass` and `Veil` now carry `data-slot="glass"` / `"veil"` (a
  caller's own `data-slot`, as on the event page's sections, still wins), and the footer
  `data-slot="page-footer"`. So `data-slot="host-header"` is selected again and stays (it was to go
  only if nothing selected it).
- RED, against the test profile built with everything but the fix: `site-look.spec.ts` at both
  widths, 5 failed of 67; "Site settings and reports wear the site's poster" and "every area reads
  in both text tones: Site settings", each at both widths, with `controls on the bare backdrop:
  ["a “Reports (78)”"]`. No other route had a bare control: the only one was Site settings'
  Reports. (The fifth failure was the new banner row, below.) Site settings' Reports is now on a
  `Veil`, as Account's Sign out is. GREEN below.

**Ruled by the controller.** `SITE_SURFACES.nested` and `nestedInset` stay as a deliberate guard,
with the comment in `legibility.ts` and the sentence in `backgrounds.md` saying why and what it
costs; no solved value changed. `backgrounds.md`'s "Every other page" names the components not yet
safe inside the scope (`Switch`'s thumb, `FieldSeparator`'s label, a secondary `Button`'s hover,
link and ghost `Badge` hovers, a `FieldLabel` wrapping a `Field`, a link in a `FieldDescription`, a
destructive `Alert`'s description at 90%); no CSS change. The release note's "Nothing moves" says
nothing on these pages moves by itself and that a sheet or dialog opened over one keeps its own
entrance; its intro paragraph is re-flowed. The Backdrop's Automatic hint now says what
`glowEvent` does, one sentence in each locale: "The poster of your next event, or of another of
your events when none is coming up, or one of this site's." (你下一个活动的海报；没有即将举行的活动时，
用你另一个活动的海报，或本站的一张海报。/ 你下一個活動的海報；沒有即將舉行的活動時，用你另一個活動的海報，
或本站的一張海報。, "coming up" as the dashboard's 即将举行 / 即將舉行).

**Smaller fixes.**
- The dashboard's album reminders are one `Glass` panel, rows `p-4` divided by
  `divide-y divide-theme-glass-border` (item f's convention). `[data-slot="album-reminder"]` is
  unchanged, so `album-reminder.spec.ts` finds them as before.
- The locked page's "Send it again in N s" waits in `text-muted-foreground`, not at 70% opacity;
  its hover's 80% opacity no longer applies while it waits. No pixel row was added: `worstContrast`
  reads an element's `color`, not its opacity, so it could not have seen the fault.
- The hover edge: the three links drawn as a *default* button (the header's New event pill, the
  first invitation's button, Next up's Guests) are `Button asChild` round their `Link`, with
  `border-0` and their own height, radius, padding and weight, so the scope's rule edges them and
  the hand-written `hover:inset-ring` is gone. What they take from `Button` besides: a 1px press
  (`active:translate-y-px`) and the 150 ms colour transition every button has. Next up's Edit and
  Share are **left drawn by hand**: they are secondary fills, and the scope has no rule for a
  secondary button's hover (it is on the "not yet safe" list above), so as `Button
  variant="secondary"` they would lose their edge and take shadcn's unproven hover fill.
- Leftovers: the card and alert shadow is `var(--shadow-glass)` (checked emitted in the built CSS);
  `HostFrame` is no longer `async`; the back link, heading and line on a veil are `ManageIntro`,
  beside `ManageHeading` in `manage-heading.tsx`, used by the five event pages and the reports page
  with the same markup as before. The `glow` names and the two ink variables are left alone.

**Tests the reviews found missing.**
- (gap 1) `legibility.test.ts` "an event page's glass is what it was before site pages": the event
  page's glass under light text on Aurora 0.244, Candlelight 0.307, Bokeh 0.325, Streamers 0.316,
  Midnight 0.262, Slate 0.289, Ink 0.298. Confirmed against b9d541d by a scratch Vitest run (in the
  session scratchpad, not committed) that imported `git show b9d541d:src/themes/legibility.ts` beside
  the current one and solved the seven with each: the same RGBA in every case (`posters.ts` is
  unchanged since, and `backgrounds.ts` differs only in comments). "site surfaces leave the event
  page alone" is kept as it was.
- (gap 2) `src/instance/dbless-pages.test.ts`: from `not-found.tsx`, the too-fast page and its
  component and `legal-page.tsx`, every file reached through runtime imports (by the alias,
  relative and re-exported; type-only ones left out), transitively and not only through
  `src/themes` and `site-look.ts`, reaches neither `src/db/` nor `src/instance/repository.ts`.
  RED shown by putting `import { homePage } from "./repository"` in `site-look.ts` for one run: all
  four failed, naming the path (`not-found.tsx → site-look.ts → repository.ts → db/client.ts`).
- (gap 4) `expectNoDisco` looks for `disco-ball`.
- (gap 5) The former co-host check reads all five `EVENT_PAGES`, before and after the removal.
- (gap 8) "a checked radio stands out in the palest accent": Account, Automatic chosen, the next
  event on Balloons; `expectMarkStandsOut` now takes `across`, reading the row through the control
  itself from 4px outside each side, checked against unchecked and against the card. It passed at
  both widths on the first run, so native radios keep `accent-primary`: no `accent-color` change.
- (gap 11) "the verification banner reads on its poster": title, words, Resend email's words and
  its ring, on the host area's poster. On the first run the title read 1.44:1 at 390px: the
  Resend button sits in the alert's corner (`absolute`, 108px wide) over the last 45px of the
  title's box, as the alert's `pr-18` leaves 72px for it; no word reaches there in English, and the
  pixel read had taken the button's edge and words as what is behind the title. The button is
  hidden while the words are read, as the New event pill is for the initials' ring. Left for the
  maintainer: a longer title in another language would run under the button on a phone.
- (7) "every area reads in both text tones" is four tests, one per area, every check kept.
- (8) `e2e/axe.ts`: on a site page with a dialog open, the read of what is outside the scope must
  have measured something inside the dialog (`expect.soft`).
- (9) The hosts page's empty links message has a line under it, above the form.
- (10) `expectHoverEdgeStandsOut` compares the edge with the hovered strip's own fill.
- (11) The Site settings test opens More options and chooses Only the ones I pick (never saved) to
  draw the small picker on Rose, and rings its first tile.
- (12) Above.

**E.** `album-voting.spec.ts`'s Settings test is two: "the host starts the album vote from
Settings" (off and open read by axe) and "the host closes, reopens and turns off the album vote
from Settings" (closed and the Turn off confirmation), every check kept.

**Evidence.**
- RED: above (`site-look.spec.ts`, 5 failed, 62 passed, against the profile built without the
  Reports fix; the dbless test's RED above).
- GREEN, the test profile rebuilt with the change, `CI=1 --workers=2`, both widths, one command:
  `site-look`, `keyboard`, `accessibility`, `locales`, `reduced-motion`, `host-accounts`,
  `instance-settings`, `dashboard`, `album-voting`, `invite-only` (the locked page), `events`
  (New event's pill) and `co-hosts` (the hosts page): **451 passed** (1.0 h), none flaky. Then, one
  at a time with `--no-deps`: limits-instance 12 passed (the header's pill at the limit),
  album-reminder-instance 5 passed (the dashboard's reminders), home-instance 19 passed (its two
  `expectSiteLook` callers, `/instance` among them).
- Timings in that run: the four "every area" tests 2.1 to 18.3 s (the old one test was 72.7 s of
  90 in the last full run); album voting's two Settings tests 36.8 / 38.5 s mobile and 39.0 /
  39.7 s desktop (the old one timed out at 90 s with two workers in ticket 26's run).
- `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 123 files, 1481 tests.

**For the maintainer (beyond the brief's list).** The verification banner's Resend button overlaps
the end of the title's box on a phone (above). The dashboard's Edit and Share on Next up keep
their hand-written edge until a secondary button's hover is proven in the scope.
