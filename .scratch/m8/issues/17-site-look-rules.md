# 17: Site look: every area of the site has its own poster, and danger and attention read on every backdrop

**What to build:** The pure rules the rest of the Glass part draws from. Each area of the site that is not an event page wears one gallery poster, the same on every visit: the signed-out screens and the co-host link one from the site's home-page set, the guest's notice pages another from that set, the pages drawn without the database one from the whole gallery, Site settings and reports another from the site's set, and a host's own pages their pick, else their next event's poster, else one from the site's set. An event's management pages wear that event's Theme, still. Beside them, `legibility.ts` learns two more inks, for danger and for attention, solved per backdrop like the accent ink, and the surfaces only site pages stack (glass on glass, a control on the header bar), so every word on a site page is proven to read before any page is restyled.

**Blocked by:** nothing

**Status:** ready-for-agent

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

- [ ] Write `src/instance/site-look.test.ts` and watch it fail:
  - `DBLESS_POOL` equals `GALLERY_POSTERS.map((p) => p.id)` and has 20 ids.
  - `sitePoster(DBLESS_POOL, area)`: `welcome` "bokeh", `guest` "cocktails", `fallback` "cake", `site` "rose", `host` "string-lights" (five different posters).
  - `sitePoster(["disco", "balloons", "aurora"], area)`: `welcome` "disco", `guest` "disco", `fallback` "balloons", `site` "aurora", `host` "aurora".
  - A pool of one, `["seaside"]`: "seaside" for all five areas. The same arguments twice give the same poster.
  - `siteTheme("disco")` equals `homeTheme("disco")`; `areaLook(DBLESS_POOL, "welcome")` equals `{ theme: homeTheme("bokeh"), upload: null }`.
  - `eventLook(theme, upload)` with a theme whose effect is "sparkles": the same theme with `effect: "none"`, and the same upload object.
  - `hostLookOf`: a pick wins over a glow (`{ pick: "aurora", glow: eventLook(theme, upload), pool: DBLESS_POOL }` gives `{ theme: siteTheme("aurora"), upload: null }`); with no pick the glow is returned as given; with neither, `areaLook(DBLESS_POOL, "host")`, whose theme is `homeTheme("string-lights")`.
- [ ] Write `src/instance/site-look.ts`. The hash is fixed so the tests above hold: over the area name's code points, from 0, `h = (h × 31 + code point) mod 2³²`; the poster is `pool[h mod pool.length]`.
- [ ] Extend `src/themes/legibility.test.ts` and watch it fail:
  - `expectEveryTextReads` also checks `tokens.dangerInk` and `tokens.attentionInk` on every surface of `SURFACES(tokens)`, each at AA alone and with its own colour at `INK_TINT` laid over the surface (shadcn's destructive button and badge fill with their own colour at 10% to 30%), so every existing describe (colours, uploads, gallery posters, posters) covers them.
  - New describe "a site page": for every gallery poster in both tones with its accent and every swatch (`use "poster"`), every colour in both tones with every accent, and the grey sweeps of "an upload" and "a poster", `toneTokens(…, "site")` reads at AA on `SURFACES` and `SITE_SURFACES` for text, muted, faint (every-strength surfaces), both inks (alone and on their tint) and the focus ring at 3:1.
  - "site surfaces leave the event page alone": for Golden hour (`BACKGROUNDS[0]`) light tone with `#ffc36b`, `toneTokens(…)` and `toneTokens(…, "background", "event")` are equal, and the site's glass alpha is at least the event's.
  - "the inks keep their colour": on every gallery poster and every colour, both tones, the danger ink's red channel is its largest, and the attention ink's channels fall from red to green to blue.
- [ ] In `legibility.ts`: the two constants, `SITE_SURFACES`, the `page` argument (the glass tint, the muted and faint strengths and the focus ring are solved over `SURFACES` plus `SITE_SURFACES` when `page === "site"`; the sheet and the title on the poster are unchanged), and `dangerInk` and `attentionInk`, each its base colour moved towards the tone's text (as `inkAt` moves the accent, `:252`) only as far as reading on every surface of the page, alone and under its own tint, needs.
- [ ] `src/themes/resolve.test.ts`: `themeVariables` carries `--theme-danger-ink` and `--theme-attention-ink` as `#rrggbb`; `resolveTheme(theme, null, "site").tokens` equals `toneTokens(tone, background, accent, use, "site")` for a gallery theme. Watch fail, then pass the `page` argument through `resolveTheme` (`:102`) and add the two variables.
- [ ] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`. No browser spec changes here. Comments entry; commit `Site look: every area has its poster, and danger and attention read on every backdrop`.

## Notes for the implementer

- Why `fallback` reads no database: the not-found, privacy, terms and too-fast pages draw without it (`src/app/layout.tsx:10-12`), and every 429 is rewritten to `/too-fast` (`src/proxy.ts:42-45`), which must not cost a query that may fail. `DBLESS_POOL` is a constant for that reason.
- The expected posters over `DBLESS_POOL` follow the gallery's order. A poster added to the gallery changes them: update this test and `SITE_POSTERS` in `e2e/site-look.ts` (ticket 18) together.
- **(plan)** Site pages are solved with `SITE_SURFACES` as well as `SURFACES`, through a `page` argument, where the design said `resolveTheme(theme, upload)`. A card holding a row, or the header's hover on its bar, stacks glass on glass, which `SURFACES` never proves. Leaving the event page's solve alone keeps every measured and pinned event-page value (the "settled look" tests) unchanged; the cost is that an event's management pages may be a shade more tinted than its event page.
- **(plan)** The inks are solved against their own 30% tint too: under light text `SitePage` adds the `dark` class (ticket 18), and shadcn's destructive button then fills with `dark:bg-destructive/20` and `dark:hover:bg-destructive/30`.
- **(plan)** The base colours are Tailwind's red-600 (`#dc2626`) and amber-600 (`#d97706`): mid tones, so the ink moves only a little in either tone and stays red or amber.
- Nothing here changes what a page paints, so `pnpm measure:backgrounds` and `pnpm posters` are not needed.

## Comments
