# 14: Sharing: link, QR, preview card, reset link

**What to build:** A host copies the event link, uses their phone's share sheet, shows a QR code, sees the link unfurl in chat apps as a preview card rendered from the theme, and can reset the link so the old one stops working.

**Blocked by:** 06 Theme and the Poster layout

**Status:** done

- [x] A share screen with copy to clipboard, the native share sheet where the browser supports it, and a QR code generated on the server as a vector image.
- [x] The event page carries Open Graph and Twitter card meta tags; the preview image is rendered on the server from the theme (background, title font, title, date) at the standard card size, cached per event, and regenerated when the theme or details change.
- [x] Reset link asks for confirmation, issues a new slug, and retires the old one; a request for a retired slug shows a dedicated "this link is no longer valid" page distinct from not-found.
- [x] Browser tests: copy works, the QR image is present, the preview image responds and the meta tags reference it, and after a reset the old link shows the retired page while the new one works.

## Comments

**2026-09-22, implementing agent.** Done. Lint, type check, 127 unit tests, and 124 browser tests pass against the production image on the Compose `test` profile. Visual check of the rendered card: the Golden hour gradient, the host, the title and the date at 1200x630.

How it landed:

- A share screen of its own at `/events/[id]/share`, linked from the manage page: the link, a copy button, the phone's share sheet where the browser has one, the QR code, and the reset.
- `src/sharing/qr.ts` wraps `qrcode-svg`; `src/sharing/preview-card.tsx` holds the card itself so the route handler stays thin, the way `calendar.ics` delegates to the calendar module.
- The preview card is an `ImageResponse` at `/e/<slug>/preview.png`, drawn from the theme's own background gradient, accent and text tone. The page's Open Graph and Twitter tags point at it with the event's version in the query, so each version caches forever while a change publishes a new URL.
- Resetting the link retires the old slug into its own table (migration `0010`) and issues a fresh one. A request for a retired slug gets a page saying so, which is a different thing from not-found, and the tab title says the same.

Decisions and things to know:

- **A new runtime dependency, `qrcode-svg`** (MIT, zero dependencies). A QR encoder is Reed–Solomon coding, version selection and mask evaluation; hand-rolling one for an invitation app is not a trade anyone would take.
- **The card is drawn in the face `next/og` bundles, not the theme's title font.** Satori reads ttf, otf and woff; this repo's title fonts are woff2 only, subset and self-hosted on purpose. Closing this means shipping a second copy of each face in a format Satori reads — worth doing when the drawer (ticket 10) makes the font a real choice.
- A cancelled event unfurls with its real title and card. Its page is public and says it is cancelled, so hiding the title in chat would only confuse.
- The card's date is written in English: a crawler brings no language of its own.
- Review caught a race: two resets at once could each retire the same old slug and leave the second's new link unretired, so a link the host had just been shown would read as not-found. The read now happens inside the transaction and the update is keyed on the slug that reset actually read, so the loser changes nothing.
- Review also caught that a request for `/preview.png` without the version would have been cached as immutable for a year; only versioned requests get that now.

Left for later tickets or noted:

- Freshness of the card rests on `updatedAt` moving whenever the theme does. **Ticket 10** writes `event.theme` and must keep that true.
- **For ticket 18:** `/preview.png` renders an image per distinct `?v=`, on an unauthenticated route. The per-slug rate limit should cover it.
- **For ticket 20 (accessibility):** the QR code is an `img` role with a label but no text alternative carrying the link itself, which is printed beside it.

**2026-09-26, implementing agent, final fix wave (branch review, finding 1).** The preview card no longer touches the network. Lint, type check, 375 unit tests (5 new), and the full browser suite (258 tests) pass against the production image rebuilt on the Compose `test` profile, once more with `CI=1` (no flaky test); `deploy/smoke-test.sh` passes against a freshly built local image. Commit `47ea96e`.

How it landed:

- `next/og` always passed Satori a loader for missing glyphs that fetched from Google Fonts (with the missing text in `&text=`) and each emoji from jsDelivr, and it cannot be turned off. The thin spaces Intl puts in an English time range were enough to trigger it, as was any Chinese title. The card is now drawn by `satori` directly, with no loader, and rasterised by `sharp` (`drawPreviewCard` in `src/sharing/preview-card.tsx`; the route returns its PNG).
- Faces, in `src/sharing/fonts/` with each OFL licence beside it: the four title faces as TTFs unpacked from their WOFF2 in `public/fonts` (same Latin subset, 164 kB together), so the card's title is now in the event's own title face; and Noto Sans SC Bold, subset to GB 2312 plus Big5's symbols and level-1 characters (8,861 hanzi, Simplified and Traditional, 2.2 MB OTF), for the host's name, the date, and whatever the title face lacks. `card-fonts.ts` has the subsetting recipe. `next.config.ts` traces the folder into the image (`outputFileTracingIncludes`).
- `src/sharing/card-text.ts`: the card writes only what its faces draw, read from each face's character map. A space the faces lack (U+2009, U+202F) becomes a plain space; any other character they lack is dropped, an emoji whole with its joiners, skin tone or keycap. Nothing is fetched for it.

Decisions and things to know:

- **New runtime dependency `satori` (MPL-2.0)**, the renderer `next/og` already bundles. It loads `harfbuzzjs` (MIT), which reads `hb.wasm` from its own folder, so `satori` is in `serverExternalPackages`: bundled, the route failed with ENOENT on `hb.wasm`.
- **The test** is the unit test at the Sharing module's seam (`src/sharing/preview-card.test.ts`): it draws the card in all four title faces, for an English title with an emoji and for a Simplified and a Traditional Chinese title, with and without a host's picture, while `fetch` throws and records. It asserts a 1200x630 PNG each time and no recorded request. Mutation check: with `next/og` put back, the same test fails on the requests to Google Fonts. I picked it over a browser test in a container with no outbound traffic because it runs in `pnpm test` everywhere and sees the network directly, where the browser test would need a new Compose network, and published ports do not work on an internal Docker network. I also ran that check by hand: the final image, on an internal Docker network with no route out, drew 200 PNGs for an English, a Chinese and a Traditional-with-emoji event. Its own `fetch` to fonts.googleapis.com failed there with EAI_AGAIN.
- Cards looked at: English (Birthday, Instrument Serif), Chinese in Birthday, Festival (Bricolage) and Kids' party (Fredoka, which wraps the title onto a second line), and poster mode (the poster's card rendition under the shade, title "Summer fair 夏日市集"). Emoji are gone, Traditional characters are drawn, and the time range reads "7:00 – 10:00 PM". Bricolage Grotesque does have U+2009, so its cards keep the thin spaces and read "12:00–3:00 PM" more tightly than the other faces.
- The image grows by 6.8 MB (307,938,464 to 314,781,693 bytes): the fonts are 2.4 MB, and harfbuzzjs 3.2 MB of it, since the trace copies its whole package (a 1.8 MB `test/` folder, `hb-subset.wasm`, a logo). The rest is Satori and its parsers.

Left for later tickets or noted:

- The trace could leave harfbuzzjs's `test/`, `logo.png` and `hb-subset.wasm` out (`outputFileTracingExcludes`), saving about 2.7 MB. Not done in this fix wave.
- A character outside the subset is dropped from the card, not drawn as a box. A title made only of emoji leaves the card with the host and the date.
