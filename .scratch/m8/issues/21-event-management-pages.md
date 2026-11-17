# 21: Event pages for hosts: an event's guests, invites, share, co-hosts and announcements pages wear that event's poster

**What to build:** The pages where a host manages one event sit in the host frame on that event's own Theme: its poster's blurred copy or its colour behind, still, its accent on the buttons, and the page's heading in the event's title font. A host moving from the dashboard to an event's guest list sees the invitation they made, not the dashboard's poster. Rows that sat on white become glass panels; the editor, which is its own tree, is not touched.

**Blocked by:** 20

**Status:** done

**Stories:** 298, 301

**Interfaces**
- Consumes: `HostFrame` (ticket 20, `src/app/(host)/host-frame.tsx`); `eventLook` (ticket 17); `Glass`, `Veil` (ticket 18); `findHostEvent(hostId, id)` (`src/events/repository.ts`), `findEventUpload(eventId)` (`src/uploads/repository.ts`), `themeUpload` (`src/uploads/uploads.ts`); `TITLE_FONTS` (`src/themes/fonts.ts`), `TITLE_FONT_FILES` (`src/themes/title-fonts.ts`); `expectSiteLook`, `worstContrast`, `expectRingStandsOut` (ticket 18).
- Produces:
  - `src/app/(host)/events/[id]/layout.tsx`: `export default async function EventPagesLayout({ children, params }: LayoutProps<"/events/[id]">)`: `requireHost()`, `findHostEvent(host.id, id)` or `notFound()`, the event's upload when its poster is one, `preload` of the title font's file as `ThemedPage` does, then `<HostFrame host={host} look={eventLook(event.theme, upload)}>`.
  - `src/app/(host)/events/[id]/manage-heading.tsx`: `export function ManageHeading({ font, id, children }: { font: FontKey; id?: string; children: ReactNode })`: an `h1` in `font-title` with `TITLE_FONTS[font].className`, `tabIndex={-1}` and `outline-none` when it has an `id`, as the five pages' headings have today.

- [x] Add to `e2e/site-look.spec.ts` (shared `app`, both projects) and watch them fail:
  - "an event's pages wear its poster, still, with its title font": a published event on Disco (whose look brings sparkles and the Syne face); `/events/{id}/guests`, `/invites`, `/share`, `/hosts` and `/announcements` each pass `expectSiteLook(page, "disco-ball-copy")`, the backdrop has three children (its picture, scrim and fade: no effect drawn), and the h1's computed `font-family` matches `/Syne/`.
  - "the dashboard keeps the host's poster beside an event's own": a host whose next event is on Cake and a later one on Disco; the later event's `/guests` holds `disco-ball-copy`, `/dashboard` holds `birthday-cake-copy`.
  - "a colour poster's blobs stand still": an event on the Dusk colour; its `/share` page's backdrop holds a `linear-gradient` and `document.getAnimations()` is empty.
  - "a guest list reads on a busy picture in both tones": a poster uploaded from a 1200×1500 picture of black and white bands 60 px tall (made with `sharp`, as `keyboard.spec.ts:452` makes one); a guest replies Going; with the text tone set to Light, then Dark, in the editor's Theme sheet (as `accessibility.spec.ts`'s tone rows do), on `/guests` `worstContrast` is at least 4.5 for the h1, the guest's name and the row's reply time, and `expectRingStandsOut` holds for "Back to the event" and the row's first button.
- [x] `layout.tsx` and `manage-heading.tsx`. The five pages each pass their event's `theme.font` to `ManageHeading` in place of their `h1`, keeping its id: `src/app/(host)/events/[id]/guests/page.tsx` (`guest-list-heading`), `invites/page.tsx` (`HEADING`), `share/page.tsx` (no id), `hosts/page.tsx` (`HEADING`), `announcements/page.tsx` (`HEADING`). Each page's back link, heading and the line under it sit on one `Veil`.
- [x] Rows: every `bg-card` row and every ring-only row that sits straight on the page becomes a `Glass` panel with its own radius and padding (`rounded-xl p-4`): `guests/guest-row.tsx:58`, the invited rows (`guests/page.tsx`, the `invite` list), `invites/page.tsx` (each invite's row), `announcements/page.tsx` (each announcement), `hosts/page.tsx` (the owner, co-host and link rows). A ring-only row inside a `Card` stays as it is. `hosts/co-host-link-form.tsx`'s `bg-muted/50` panel becomes `bg-muted`. The share page's QR code keeps its white tile (`share/page.tsx`), which the code needs to scan. The invites page's invite-only notice keeps its `Alert`, glass by the scope with the attention ink.
- [x] Existing specs: run `guest-list.spec.ts`, `invites.spec.ts`, `invite-only.spec.ts`, `sharing.spec.ts`, `custom-link.spec.ts`, `co-hosts.spec.ts`, `announcements.spec.ts`, `approval.spec.ts`, `capacity.spec.ts`, `contact-details.spec.ts`, `questions.spec.ts`, `keyboard.spec.ts` (the share page's ring in both colour schemes, the invites by keyboard), `accessibility.spec.ts` (the announcements, hosts and invites pages, the guest list's sections), `reduced-motion.spec.ts` (the guest list and the share screen), `locales.spec.ts` and `site-look.spec.ts`; fix what they find.
- [x] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, the specs above on the Docker test profile rebuilt with the change (`CI=1`, `--workers=2`). Comments entry; commit `Event pages for hosts: an event's guests, invites and share wear its poster`.

- [x] Review focus (plan). Browser, `e2e/site-look.spec.ts`: "an event deleted while its guests page is open" (the event is deleted in a second tab; following the page's link to Invites shows the not-found page with exactly one `[data-slot="backdrop"]` and one `contentinfo`); "a poster changed in the editor shows on the guests page at once" (the host picks another gallery poster in the editor and follows a link to Guests without a reload: the backdrop wears the new poster).

## Notes for the implementer

- The layout reads the event as each page does; `findHostEvent` is the one gate, so a co-host sees the event's look too, and anyone else meets the not-found page (the proxy answers first for a document request, `src/proxy.ts`).
- The effect is never drawn here: `eventLook` sets it to none and `SitePage` draws the backdrop still. The event page itself keeps its effect and drift.
- **(plan)** The heading takes the event's title face through a small component rather than a CSS rule on every `h1` in the scope, since each face has its own weight and tracking (`TITLE_FONTS[…].className`, `src/themes/fonts.ts:22-27`), and a site area's `h1` (Sign in, Account) stays in the interface's face.
- A host's upload as the backdrop is measured as the event page measures it (`uploads/sample.ts`), and `legibility.test.ts` sweeps every grey from black to white for it (ticket 17), so no picture can make these pages unreadable; the striped picture is the browser's check of that.
- The guest list refreshes itself while watched (`guests/refresh-every.tsx`). `router.refresh()` draws the layout again too; the look depends only on the event's Theme, so the backdrop stays the same, and an image already loaded is not fetched again.
- A host who changes the event's poster in the editor and comes back sees the new one: the editor is another tree, so the layout here is drawn afresh on the way back.

## Comments

### 2026-11-12: landed (Opus 5.5)

**How it landed.** As Produces says. `src/app/(host)/events/[id]/layout.tsx` replaces ticket 20's
stopgap: `requireHost()`, `findHostEvent` or `notFound()`, the event's upload when its poster is one
(`findEventUpload`, `themeUpload`), `preload` of `TITLE_FONT_FILES[event.theme.font]` as
`ThemedPage` does, and `HostFrame` with `eventLook(event.theme, upload)`; no wrapping panel.
`manage-heading.tsx` is `ManageHeading` (`font-title text-3xl leading-tight`, the face's own
`TITLE_FONTS[font].className`, `tabIndex={-1}` and `outline-none` with an `id`). The five pages pass
`event.theme.font` and keep their ids. Each page's back link, heading and the line under it are on
one `Veil` (the hosts page's line is the owner's explainer or the co-host's intro, moved up from
`OwnersView` and `LeaveEvent`; the announcements page's three lines are all there).

**What differs from the ticket's text (controller's rulings):**
- **A list is one `Glass` panel, its rows divided** by borders in `--theme-glass-border`
  (`divide-theme-glass-border`), not one panel per row: each guest section (its `h2` in the panel,
  "Nobody." too), the Invited section, the invites (Send to everyone not yet sent, or "Invitations
  can be emailed while the event is published.", heads that panel), the announcements, the owner and
  co-host rows, and the pending co-host links (inside the links panel, under its heading).
  `GuestRow` lost its own `bg-card`/ring; the `li` carries the padding. A list that is empty shows
  its line in a panel of its own.
- **The co-host link panel stays as ticket 20 left it** (an edge, no fill), not `bg-muted`.
  `legibility.ts` is untouched; "a site page's glass is settled" passes unchanged.
- **No text is on the bare backdrop**, so beyond the rows: the invites page's letters switch and
  both forms share one panel; the share page's link and buttons are a panel, and the QR code, the
  custom link and Reset the link are each a `section` holding one panel with its heading; the
  announcement form is a panel; the co-host's Leave button is a panel; the guest list's "This list
  updates on its own as guests reply." is on `Veil`. The invite-only notice keeps its `Alert`
  (strong glass by the scope, attention ink); the QR code keeps its white tile.

**Partial fills checked on these pages**, against `SURFACES` (no `SITE_SURFACES` surface is needed
now: nothing is glass on glass any more). Rows and panels are `card` (glass on the backdrop).
Fields, textareas and native selects (guest edit form, invite forms, letters, custom link, co-host
link, announcement message) are strong glass in the scope, on glass: `inset`; disabled ones keep
strong glass (the scope's unlayered rule beats `disabled:bg-input/50`, `dark:disabled:bg-input/80`)
at half opacity, which WCAG exempts. Outline buttons (Approve, Decline, Move to Going, Copy, Share,
Send, Save letter, Remove, Revoke, Reset the link, Send a reminder now, Add several) are strong
glass on glass, `inset`, hovered too (edged in the tone's text). Ghost buttons (Edit/Close, Delete)
have no fill at rest and strong glass hovered or `aria-expanded` (`inset`). Default buttons and the
default badge are the accent with onAccent. Destructive buttons (Remove, Leave) are strong glass
with the danger ink. Badges: secondary is strong glass on glass (`inset`), outline has no fill
(`card`). Checkboxes (letters, audience; disabled without mail) carry no text; their labels are on
glass. The invite-only `Alert` is strong glass on the backdrop (`strongGlass`), its title in the
attention ink; "Anyone with this link can open the invitation" is the attention ink on glass;
refusals (`FieldError`) are the danger ink on glass or inset; all proven alone. No `bg-muted/50`,
table, tab or switch is drawn on these pages. Dialogs are portalled outside the scope and stay
opaque.

**Tests.** New in `site-look.spec.ts`: the ticket's four rows, plus the two review-focus rows ("an
event deleted while its guests page is open" goes on to Invites with `window.next.router.push`, as a
link would, since the guests page has no link to Invites; "a poster changed in the editor…" follows
More's "Guest list" link). In "a guest list reads on a busy picture", the row's first button is
Edit. The stopgap test "a host's pages read on a light poster and a dark one" keeps its guest-list
part with its comment rewritten: the guests page wears the event's poster, with one banner, one main
and one contentinfo (there the event's poster and the host's are the same; "the dashboard keeps the
host's poster beside an event's own" tells them apart).

**Evidence.** RED, against the test profile before the change (desktop): "an event's pages wear its
poster" failed (`guests's title face`: the interface's sans, not `/Syne/`), "the dashboard keeps the
host's poster…" failed (no `disco-ball-copy` on the later event's guests page: it wore the host's
Cake), and "a poster changed in the editor…" failed on a wrong link name in the test itself (fixed:
"Guest list"); the colour, busy-picture and deleted-event rows passed before the change, as the
stopgap wore the host's look, which for a host's only event is that event's. GREEN, on the test
profile rebuilt with the change, `CI=1 --workers=2`, both widths: `site-look.spec.ts`, 39 passed.
`guest-list`, `invites`, `invite-only`, `sharing`, `custom-link`, `co-hosts`, `announcements`,
`approval`, `capacity`, `contact-details`, `questions`, `keyboard`, `accessibility`,
`reduced-motion`, `locales` and `album-voting` at both widths: 373 passed, 1 flaky, 1 failed. The
flaky one, `invites.spec.ts:490` [mobile], timed out at its last step on the guest's event page and
passed on retry; alone, twice at each width with no retries, 4 passed. The failed one,
`accessibility.spec.ts:129` [desktop] ("a host's own pages…"), timed out at 90 s twice, in axe's
colour-contrast read of the guest list; alone it passed in 57 s. At two workers, both widths, twice
each, it failed 4 of 4, then 2 of 4. **An A/B against an image built from HEAD** (the stopgap) on
the same instance, each axe read timed by a probe in `e2e/axe.ts` (removed): at two workers it
passed 4 of 4, in 77 to 89 s of its 90; at one worker both builds took 1.8 min for the pair. Each
axe read timed: the share screen 1.3 to 2.0 s and the guest list 0.9 to 1.3 s on both builds; under
two workers the editor's Settings sheet alone takes 28 to 35 s. So the test was already at its edge.
Its budget is now `test.setTimeout(180_000)`, as "the event page with the host's picture…" in the
same spec has; with it, at two workers, both widths, twice: 4 passed, in 90, 90, 106 and 104 s
(mobile as on HEAD; desktop slower than HEAD's 77 s, which these pages' own axe reads do not account
for). `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 119 files, 1408 tests.
