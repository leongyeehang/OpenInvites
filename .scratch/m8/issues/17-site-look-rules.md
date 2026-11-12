# 17: Site look: every area of the site has its own poster, and danger and attention read on every backdrop

**What to build:** The pure rules the rest of the Glass part draws from. Each area of the site that is not an event page wears one gallery poster, the same on every visit: the signed-out screens and the co-host link one from the site's home-page set, the guest's notice pages another from that set, the pages drawn without the database one from the whole gallery, Site settings and reports another from the site's set, and a host's own pages their pick, else their next event's poster, else one from the site's set. An event's management pages wear that event's Theme, still. Beside them, `legibility.ts` learns two more inks, for danger and for attention, solved per backdrop like the accent ink, and the surfaces only site pages stack (glass on glass, a control on the header bar), so every word on a site page is proven to read before any page is restyled.

**Blocked by:** nothing

**Status:** done

**Stories:** 297, 298, 300, 301

**Interfaces**
- Consumes: `posterPool(page)`, `homeTheme(id)`, `DEFAULT_HOME_PAGE`, `HomePage` (`src/instance/home.ts:26`, `:67-72`, `:85-87`); `GalleryPosterId`, `GALLERY_POSTERS`, `findGalleryPoster` (`src/themes/posters.ts`); `Theme` (`src/themes/theme.ts`); `ThemeUpload`, `resolveTheme`, `themeVariables` (`src/themes/resolve.ts:65`, `:120-137`); `toneTokens`, `SURFACES`, `ToneTokens`, `hexToRgb`, `over` (`src/themes/legibility.ts`).
- Produces, in `src/instance/site-look.ts` (pure, beside `home.ts`):
  - `export type SiteArea = "welcome" | "guest" | "fallback" | "site" | "host"`
  - `export const DBLESS_POOL: readonly GalleryPosterId[]` (`posterPool(DEFAULT_HOME_PAGE)`: the whole gallery, in gallery order, no query)
  - `export function sitePoster(pool: readonly GalleryPosterId[], area: SiteArea): GalleryPosterId`
  - `export function siteTheme(id: GalleryPosterId): Theme` (`homeTheme(id)`)
  - `export type SiteLook = { theme: Theme; upload: ThemeUpload | null }`
  - `export function areaLook(pool: readonly GalleryPosterId[], area: SiteArea): SiteLook`
  - `export function eventLook(theme: Theme, upload: ThemeUpload | null): SiteLook`
  - `export function hostLookOf(input: { pick: GalleryPosterId | null; glow: SiteLook | null; pool: readonly GalleryPosterId[] }): SiteLook`
- Produces, in `src/themes/legibility.ts`: `export const DANGER: Rgb` (`#dc2626`), `export const ATTENTION: Rgb` (`#d97706`), `export const INK_TINT = 0.3`; `ToneTokens` gains `dangerInk: Rgb` and `attentionInk: Rgb`; `export type PageKind = "event" | "site"`; `export function SITE_SURFACES({ glass, glassStrong }: Pick<ToneTokens, "glass" | "glassStrong">)` returning `nested: { layers: [glass, glass], carries: "every strength" }`, `nestedInset: { layers: [glass, glass, glassStrong], carries: "every strength" }`, `onBar: { layers: [glassStrong, glassStrong], carries: "full strength" }`; `toneTokens(tone, backdrop, accent, use = "background", page: PageKind = "event")`.
- Produces, in `src/themes/resolve.ts`: `resolveTheme(theme: Theme, upload: ThemeUpload | null = null, page: PageKind = "event"): ResolvedTheme`; `themeVariables` adds `"--theme-danger-ink"` and `"--theme-attention-ink"` (hex, through `css`).

- [x] Write `src/instance/site-look.test.ts` and watch it fail:
  - `DBLESS_POOL` equals `GALLERY_POSTERS.map((p) => p.id)` and has 20 ids.
  - `sitePoster(DBLESS_POOL, area)`: `welcome` "bokeh", `guest` "cocktails", `fallback` "cake", `site` "rose", `host` "string-lights" (five different posters).
  - `sitePoster(["disco", "balloons", "aurora"], area)`: `welcome` "disco", `guest` "disco", `fallback` "balloons", `site` "aurora", `host` "aurora".
  - A pool of one, `["seaside"]`: "seaside" for all five areas. The same arguments twice give the same poster.
  - `siteTheme("disco")` equals `homeTheme("disco")`; `areaLook(DBLESS_POOL, "welcome")` equals `{ theme: homeTheme("bokeh"), upload: null }`.
  - `eventLook(theme, upload)` with a theme whose effect is "sparkles": the same theme with `effect: "none"`, and the same upload object.
  - `hostLookOf`: a pick wins over a glow (`{ pick: "aurora", glow: eventLook(theme, upload), pool: DBLESS_POOL }` gives `{ theme: siteTheme("aurora"), upload: null }`); with no pick the glow is returned as given; with neither, `areaLook(DBLESS_POOL, "host")`, whose theme is `homeTheme("string-lights")`.
- [x] Write `src/instance/site-look.ts`. The hash is fixed so the tests above hold: over the area name's code points, from 0, `h = (h × 31 + code point) mod 2³²`; the poster is `pool[h mod pool.length]`.
- [x] Extend `src/themes/legibility.test.ts` and watch it fail:
  - `expectEveryTextReads` also checks `tokens.dangerInk` and `tokens.attentionInk` on every surface of `SURFACES(tokens)`, each at AA alone and with its own colour at `INK_TINT` laid over the surface (shadcn's destructive button and badge fill with their own colour at 10% to 30%), so every existing describe (colours, uploads, gallery posters, posters) covers them.
  - New describe "a site page": for every gallery poster in both tones with its accent and every swatch (`use "poster"`), every colour in both tones with every accent, and the grey sweeps of "an upload" and "a poster", `toneTokens(…, "site")` reads at AA on `SURFACES` and `SITE_SURFACES` for text, muted, faint (every-strength surfaces), both inks (alone and on their tint) and the focus ring at 3:1.
  - "site surfaces leave the event page alone": for Golden hour (`BACKGROUNDS[0]`) light tone with `#ffc36b`, `toneTokens(…)` and `toneTokens(…, "background", "event")` are equal, and the site's glass alpha is at least the event's.
  - "the inks keep their colour": on every gallery poster and every colour, both tones, the danger ink's red channel is its largest, and the attention ink's channels fall from red to green to blue.
- [x] In `legibility.ts`: the two constants, `SITE_SURFACES`, the `page` argument (the glass tint, the muted and faint strengths and the focus ring are solved over `SURFACES` plus `SITE_SURFACES` when `page === "site"`; the sheet and the title on the poster are unchanged), and `dangerInk` and `attentionInk`, each its base colour moved towards the tone's text (as `inkAt` moves the accent, `:252`) only as far as reading on every surface of the page, alone and under its own tint, needs.
- [x] `src/themes/resolve.test.ts`: `themeVariables` carries `--theme-danger-ink` and `--theme-attention-ink` as `#rrggbb`; `resolveTheme(theme, null, "site").tokens` equals `toneTokens(tone, background, accent, use, "site")` for a gallery theme. Watch fail, then pass the `page` argument through `resolveTheme` (`:102`) and add the two variables.
- [x] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`. No browser spec changes here. Comments entry; commit `Site look: every area has its poster, and danger and attention read on every backdrop`.

## Notes for the implementer

- Why `fallback` reads no database: the not-found, privacy, terms and too-fast pages draw without it (`src/app/layout.tsx:10-12`), and every 429 is rewritten to `/too-fast` (`src/proxy.ts:42-45`), which must not cost a query that may fail. `DBLESS_POOL` is a constant for that reason.
- The expected posters over `DBLESS_POOL` follow the gallery's order. A poster added to the gallery changes them: update this test and `SITE_POSTERS` in `e2e/site-look.ts` (ticket 18) together.
- **(plan)** Site pages are solved with `SITE_SURFACES` as well as `SURFACES`, through a `page` argument, where the design said `resolveTheme(theme, upload)`. A card holding a row, or the header's hover on its bar, stacks glass on glass, which `SURFACES` never proves. Leaving the event page's solve alone keeps every measured and pinned event-page value (the "settled look" tests) unchanged; the cost is that an event's management pages may be a shade more tinted than its event page.
- **(plan)** The inks are solved against their own 30% tint too: under light text `SitePage` adds the `dark` class (ticket 18), and shadcn's destructive button then fills with `dark:bg-destructive/20` and `dark:hover:bg-destructive/30`.
- **(plan)** The base colours are Tailwind's red-600 (`#dc2626`) and amber-600 (`#d97706`): mid tones, so the ink moves only a little in either tone and stays red or amber.
- Nothing here changes what a page paints, so `pnpm measure:backgrounds` and `pnpm posters` are not needed.

## Comments

### 2026-11-11: landed (Opus 5.5)

**How it landed.** `src/instance/site-look.ts` is as Produces says, with the fixed hash; every
poster the ticket expects holds. `legibility.ts` gains `DANGER`, `ATTENTION`, `PageKind`,
`SITE_SURFACES`, the `page` argument, `dangerInk` and `attentionInk`. `resolveTheme` takes the
`page` argument through and `themeVariables` carries `--theme-danger-ink` and
`--theme-attention-ink`. The event page's solve is untouched: every "settled look" test and every
other existing test passes unchanged, and `toneTokens(…)` equals `toneTokens(…, "background",
"event")`.

**What differs from the ticket, and why (ruled by the controller after a BLOCKED report):**
- **`INK_TINT` is not produced, and the inks are proven alone.** No ink can read at AA on its own
  30% tint over the event page's surfaces. The glass is tinted only until 80% text reaches 4.6:1,
  and 30% of the ink pulls the surface towards the ink, so even the text itself fails on it as ink.
  Measured over the grey sweeps of "an upload" and "a poster": no ink works in 54 of 72 cases, for
  danger and for attention, on every light-tone surface and on dark/page. Tinting a site page's glass
  until one would read needs light-tone glass alpha 0.80 to 0.96, with the ink pure white.
  `expectEveryTextReads` therefore checks both inks alone at AA on every `SURFACES` surface. "A site
  page" checks them alone on `SURFACES` and `SITE_SURFACES`.
- **The ticket's two (plan) notes on the inks were wrong.** The 30% tint note is answered above.
  "Mid tones, so the ink moves only a little" does not hold. On the gallery posters under light text,
  the danger ink is `#f9d8d8` (about 82% of the way to white; `#fae1e1` on Aurora) and the attention
  ink (245, 220, 190). Under dark text, the danger ink runs from `#bf2328` (Cake) to `#58172d`.
  The attention ink reaches (68, 39, 39) on seven posters: candles, candlelight, disco,
  sunset-drive, cocktails, seaside and string-lights. Any colour that reads on the light tone's
  glass needs a luminance of about 0.6, so these are what AA asks for.
- **"The inks keep their colour" has an allowance.** The danger ink's red channel is its largest.
  The attention ink's red is its largest too, and its green may sit below its blue by at most 1:
  under dark text it moves towards the blue-heavy `#1a1030`, and green and blue meet (above). The
  test asserts this on event and site pages alike.

**For ticket 18:** inside the `.site-page` scope the destructive button and badge must fill with
`--destructive-soft` (strong glass), never `bg-destructive/10–30`. The danger ink is proven only
on the surfaces `SURFACES` and `SITE_SURFACES` name, not on its own tint. The same holds for any
attention fill (`--attention-soft`).

**Things to know.** On most backdrops a site page solves the same as an event page. Site glass is
tinted further only where glass on glass needs it: on the gallery, Candlelight, Aurora, Bokeh and
Streamers under light text (Aurora's glass alpha goes from 0.244 to 0.289). `resolve.test.ts` pins
Aurora as the case where `"site"` differs.

**Evidence.** RED: `site-look.test.ts` failed to import `./site-look`. `legibility.test.ts`: 70
failed of 90 (`SITE_SURFACES is not a function`, `dangerInk` undefined). `resolve.test.ts`: 2 failed
(`--theme-danger-ink` undefined; site tokens unequal). GREEN: 9, 90 and 25 passed. `pnpm lint` and
`pnpm typecheck` are clean, and `pnpm test` passes 119 files and 1379 tests. No browser spec
changes, and no Docker run, as the ticket says.
