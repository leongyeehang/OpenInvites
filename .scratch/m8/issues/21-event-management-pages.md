# 21: Event pages for hosts: an event's guests, invites, share, co-hosts and announcements pages wear that event's poster

**What to build:** The pages where a host manages one event sit in the host frame on that event's own Theme: its poster's blurred copy or its colour behind, still, its accent on the buttons, and the page's heading in the event's title font. A host moving from the dashboard to an event's guest list sees the invitation they made, not the dashboard's poster. Rows that sat on white become glass panels; the editor, which is its own tree, is not touched.

**Blocked by:** 20

**Status:** ready-for-agent

**Stories:** 298, 301

**Interfaces**
- Consumes: `HostFrame` (ticket 20, `src/app/(host)/host-frame.tsx`); `eventLook` (ticket 17); `Glass`, `Veil` (ticket 18); `findHostEvent(hostId, id)` (`src/events/repository.ts`), `findEventUpload(eventId)` (`src/uploads/repository.ts`), `themeUpload` (`src/uploads/uploads.ts`); `TITLE_FONTS` (`src/themes/fonts.ts`), `TITLE_FONT_FILES` (`src/themes/title-fonts.ts`); `expectSiteLook`, `worstContrast`, `expectRingStandsOut` (ticket 18).
- Produces:
  - `src/app/(host)/events/[id]/layout.tsx`: `export default async function EventPagesLayout({ children, params }: LayoutProps<"/events/[id]">)`: `requireHost()`, `findHostEvent(host.id, id)` or `notFound()`, the event's upload when its poster is one, `preload` of the title font's file as `ThemedPage` does, then `<HostFrame host={host} look={eventLook(event.theme, upload)}>`.
  - `src/app/(host)/events/[id]/manage-heading.tsx`: `export function ManageHeading({ font, id, children }: { font: FontKey; id?: string; children: ReactNode })`: an `h1` in `font-title` with `TITLE_FONTS[font].className`, `tabIndex={-1}` and `outline-none` when it has an `id`, as the five pages' headings have today.

- [ ] Add to `e2e/site-look.spec.ts` (shared `app`, both projects) and watch them fail:
  - "an event's pages wear its poster, still, with its title font": a published event on Disco (whose look brings sparkles and the Syne face); `/events/{id}/guests`, `/invites`, `/share`, `/hosts` and `/announcements` each pass `expectSiteLook(page, "disco-ball-copy")`, the backdrop has three children (its picture, scrim and fade: no effect drawn), and the h1's computed `font-family` matches `/Syne/`.
  - "the dashboard keeps the host's poster beside an event's own": a host whose next event is on Cake and a later one on Disco; the later event's `/guests` holds `disco-ball-copy`, `/dashboard` holds `birthday-cake-copy`.
  - "a colour poster's blobs stand still": an event on the Dusk colour; its `/share` page's backdrop holds a `linear-gradient` and `document.getAnimations()` is empty.
  - "a guest list reads on a busy picture in both tones": a poster uploaded from a 1200×1500 picture of black and white bands 60 px tall (made with `sharp`, as `keyboard.spec.ts:452` makes one); a guest replies Going; with the text tone set to Light, then Dark, in the editor's Theme sheet (as `accessibility.spec.ts`'s tone rows do), on `/guests` `worstContrast` is at least 4.5 for the h1, the guest's name and the row's reply time, and `expectRingStandsOut` holds for "Back to the event" and the row's first button.
- [ ] `layout.tsx` and `manage-heading.tsx`. The five pages each pass their event's `theme.font` to `ManageHeading` in place of their `h1`, keeping its id: `src/app/(host)/events/[id]/guests/page.tsx` (`guest-list-heading`), `invites/page.tsx` (`HEADING`), `share/page.tsx` (no id), `hosts/page.tsx` (`HEADING`), `announcements/page.tsx` (`HEADING`). Each page's back link, heading and the line under it sit on one `Veil`.
- [ ] Rows: every `bg-card` row and every ring-only row that sits straight on the page becomes a `Glass` panel with its own radius and padding (`rounded-xl p-4`): `guests/guest-row.tsx:58`, the invited rows (`guests/page.tsx`, the `invite` list), `invites/page.tsx` (each invite's row), `announcements/page.tsx` (each announcement), `hosts/page.tsx` (the owner, co-host and link rows). A ring-only row inside a `Card` stays as it is. `hosts/co-host-link-form.tsx`'s `bg-muted/50` panel becomes `bg-muted`. The share page's QR code keeps its white tile (`share/page.tsx`), which the code needs to scan. The invites page's invite-only notice keeps its `Alert`, glass by the scope with the attention ink.
- [ ] Existing specs: run `guest-list.spec.ts`, `invites.spec.ts`, `invite-only.spec.ts`, `sharing.spec.ts`, `custom-link.spec.ts`, `co-hosts.spec.ts`, `announcements.spec.ts`, `approval.spec.ts`, `capacity.spec.ts`, `contact-details.spec.ts`, `questions.spec.ts`, `keyboard.spec.ts` (the share page's ring in both colour schemes, the invites by keyboard), `accessibility.spec.ts` (the announcements, hosts and invites pages, the guest list's sections), `reduced-motion.spec.ts` (the guest list and the share screen), `locales.spec.ts` and `site-look.spec.ts`; fix what they find.
- [ ] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, the specs above on the Docker test profile rebuilt with the change (`CI=1`, `--workers=2`). Comments entry; commit `Event pages for hosts: an event's guests, invites and share wear its poster`.

- [ ] Review focus (plan). Browser, `e2e/site-look.spec.ts`: "an event deleted while its guests page is open" (the event is deleted in a second tab; following the page's link to Invites shows the not-found page with exactly one `[data-slot="backdrop"]` and one `contentinfo`); "a poster changed in the editor shows on the guests page at once" (the host picks another gallery poster in the editor and follows a link to Guests without a reload: the backdrop wears the new poster).

## Notes for the implementer

- The layout reads the event as each page does; `findHostEvent` is the one gate, so a co-host sees the event's look too, and anyone else meets the not-found page (the proxy answers first for a document request, `src/proxy.ts`).
- The effect is never drawn here: `eventLook` sets it to none and `SitePage` draws the backdrop still. The event page itself keeps its effect and drift.
- **(plan)** The heading takes the event's title face through a small component rather than a CSS rule on every `h1` in the scope, since each face has its own weight and tracking (`TITLE_FONTS[…].className`, `src/themes/fonts.ts:22-27`), and a site area's `h1` (Sign in, Account) stays in the interface's face.
- A host's upload as the backdrop is measured as the event page measures it (`uploads/sample.ts`), and `legibility.test.ts` sweeps every grey from black to white for it (ticket 17), so no picture can make these pages unreadable; the striped picture is the browser's check of that.
- The guest list refreshes itself while watched (`guests/refresh-every.tsx`). `router.refresh()` draws the layout again too; the look depends only on the event's Theme, so the backdrop stays the same, and an image already loaded is not fetched again.
- A host who changes the event's poster in the editor and comes back sees the new one: the editor is another tree, so the layout here is drawn afresh on the way back.

## Comments
