# 18: Notice pages: every notice a visitor meets sits on a still poster, in glass

**What to build:** The frame every page that is not an event page will wear, and the notice pages first. `Backdrop` moves out of `themed-page.tsx` into a file of its own and learns to hold still; a server component `SitePage` paints a `SiteLook` behind its children as the event page does, with the theme's variables, the themed footer, and a scope in `globals.css` that turns shadcn's cards, fields, alerts and buttons into the glass `legibility.ts` solves. Too fast, not found, privacy and terms wear the fallback poster, chosen without the database; the locked page, the report form, a retired link, a draft that is not ready and the stop-mail page wear the guest area's poster from the site's set, never the event's Theme, so they read the same whatever the host chose.

**Blocked by:** 17

**Status:** done

**Stories:** 297, 301

**Interfaces**
- Consumes: `SiteLook`, `areaLook`, `DBLESS_POOL`, `PageKind` (ticket 17); `resolveTheme(theme, upload, "site")`, `themeVariables` (`src/themes/resolve.ts`); `posterPool` (`src/instance/home.ts`), `homePage()` (`src/instance/repository.ts`, cached per request); `Glass` (`src/themes/glass.tsx`); `PageFooter({ themed })` (`src/components/page-footer.tsx`); `TITLE_FONT_CLASSES` (`src/themes/title-fonts.ts`).
- Produces:
  - `src/themes/backdrop.tsx`: `export function Backdrop({ theme, effect, still = false }: { theme: ResolvedTheme; effect: Effect; still?: boolean })`, still `aria-hidden` with `data-slot="backdrop"`. `ThemedPage` imports it from here.
  - `src/themes/site-page.tsx` (server component, no `"use client"`): `export function SitePage({ look, children }: { look: SiteLook; children: ReactNode })` rendering `<div data-slot="site-page" data-tone={tone} className="site-page relative flex min-h-dvh flex-col font-sans text-theme-text …">` with `dark` added when the text tone is light, the title font's class, `style={themeVariables(resolveTheme(look.theme, look.upload, "site"))}`, then `<Backdrop theme={…} effect="none" still />`, the children and `<PageFooter themed />`.
  - `src/themes/glass.tsx`: `export function Veil({ className, ...props }: ComponentProps<"div">)`: `w-fit max-w-full rounded-2xl bg-theme-veil px-3 py-2 backdrop-blur-xl`, the surface a heading outside a panel sits on (`SURFACES.page`).
  - `src/app/globals.css`: the `themed` variant becomes `body:has(.event-page, .site-page) &`; `--color-theme-danger-ink` and `--color-theme-attention-ink` in `@theme inline`; the `.site-page` scope below.
  - `src/app/e/[slug]/not-ready.tsx`: `export async function NotReady()`.
  - `e2e/contrast.ts`: `worstContrast(text: Locator): Promise<number>` (moved from `e2e/dashboard.ts:44-74`) and `expectRingStandsOut(page: Page, control: Locator)` with `stripBeside` and `contrast` (moved from `e2e/keyboard.spec.ts:465-505`); both specs import them from here.
  - `e2e/site-look.ts`: `SITE_POSTERS = { welcome: "bokeh-copy", guest: "cocktails-copy", fallback: "birthday-cake-copy", site: "rose-garden-copy", host: "string-lights-copy" } as const` (the shared `app` keeps the whole gallery as its set) and `expectSiteLook(page: Page, copy: string)`: one `.site-page`, one `[data-slot="backdrop"]` whose picture's style names `copy`, one `contentinfo`, and `document.getAnimations()` empty.

- [x] Write `e2e/site-look.spec.ts` (shared `app`, both projects) and watch it fail:
  - "the pages drawn without the database wear one poster from the whole gallery, still": `/too-fast`, `/privacy`, `/terms` and `/no-such-page` each pass `expectSiteLook(page, SITE_POSTERS.fallback)` (contextOptions without reduced motion), with their h1 visible.
  - "a guest's notice pages wear the site's poster, never the event's": a published event on the Disco poster (`pickDesign(page, "Poster", "Poster", "Disco", "Gallery")`); its report form, the locked page of an invite-only event (as `invite-only.spec.ts` makes one), a draft opened by a guest ("This invitation isn’t ready yet"), a reset link (as `sharing.spec.ts` resets one) and the stop-mail page from a guest's confirmation email (as `guest-mail.spec.ts` reads it) each pass `expectSiteLook(page, SITE_POSTERS.guest)`, and none holds `disco-ball-copy`.
  - "a legal page reads on a light poster and the report form on a dark one": on `/privacy` (Cake, dark text) `worstContrast` of the h1 and of the first paragraph of `[data-slot="legal-text"]` is at least 4.5; on the report form (Cocktails, light text) the h1, the label "What’s wrong with this page?" and the reason field's typed text are at least 4.5, and `expectRingStandsOut` holds for the reason field, the email field and Send report.
- [x] Move `Backdrop` (`src/themes/themed-page.tsx:77-113`) unchanged into `src/themes/backdrop.tsx`, its comment with it; `still` leaves off the two blobs' `motion-safe:animate-theme-drift` (and the second's delay) and draws no effect. `ThemedPage` (`:69`) passes no `still`, so the event page is drawn exactly as before.
- [x] Write `SitePage` and `Veil`, and the CSS. In `globals.css`: line 11's variant widened; and a section `/* === 5. SITE PAGES === */` at the end of the file, outside every `@layer` and so after `.dark`:

  ```css
  .site-page {
    color-scheme: light;
    --background: transparent;
    --foreground: var(--theme-text);
    --card: var(--theme-glass);
    --card-foreground: var(--theme-text);
    --primary: var(--theme-accent);
    --primary-foreground: var(--theme-on-accent);
    --secondary: var(--theme-glass-strong);
    --secondary-foreground: var(--theme-text);
    --muted: var(--theme-glass-strong);
    --muted-foreground: var(--theme-text-muted);
    --accent: var(--theme-glass-strong);
    --accent-foreground: var(--theme-text);
    --destructive: var(--theme-danger-ink);
    --destructive-soft: var(--theme-glass-strong);
    --attention: var(--theme-attention-ink);
    --attention-soft: var(--theme-glass-strong);
    --border: var(--theme-glass-border);
    --input: var(--theme-text-faint);
    --ring: var(--theme-focus-ring);
  }
  .site-page[data-tone="light"] { color-scheme: dark; }
  .site-page :is([data-slot="card"], [data-slot="alert"]) {
    backdrop-filter: blur(24px); /* the glass's blur, backdrop-blur-xl */
    box-shadow: inset 0 0 0 1px var(--theme-glass-border), 0 8px 40px -16px rgb(0 0 0 / 0.35);
  }
  .site-page :is([data-slot="input"], [data-slot="textarea"], [data-slot="native-select"], [data-slot="card-footer"], [data-slot="button"][data-variant="outline"]) {
    background-color: var(--theme-glass-strong);
  }
  .site-page [data-slot="button"][data-variant="link"] { color: var(--theme-accent-ink); }
  .site-page :focus-visible:not([tabindex="-1"]) {
    outline: 2px solid var(--theme-focus-ring);
    outline-offset: 2px;
  }
  ```

  with a comment in the voice of section 4 saying what the scope is for, why it is unlayered, and that dialogs and menus are portalled to `<body>`, outside it, and stay opaque.
- [x] Restyle each notice page inside `SitePage`, its `<main>` taking `flex-1` in place of `min-h-svh`; a notice's heading, text and actions in one `Glass` panel; a heading outside a panel on `Veil`. Fallback look, no query: `src/components/too-fast.tsx` (`/too-fast`, and the event page's own 429 at `src/app/e/[slug]/page.tsx:246`), `src/app/not-found.tsx`, `src/legal/legal-page.tsx` (`/privacy`, `/terms`: the title on `Veil`, the operator's text and the contact line in `Glass`). Guest look, `areaLook(posterPool(await homePage()), "guest")`: `src/app/e/[slug]/retired-link.tsx`, the not-ready page (`src/app/e/[slug]/page.tsx:263-271`, moved into `not-ready.tsx`), `src/app/e/[slug]/locked-page.tsx`, `src/app/e/[slug]/report/page.tsx`, `src/app/m/[token]/page.tsx`. Rewrite the comments that call the locked and report pages plain (`locked-page.tsx:6-10`, `report/page.tsx:28-31`): they wear the site's backdrop, never the event's Theme, so they read the same whatever the host chose.
- [x] Existing specs: `e2e/dashboard.ts` and `e2e/keyboard.spec.ts` import from `e2e/contrast.ts`; `keyboard.spec.ts`'s comments at `:266-268` and `:296` stop calling the report page plain. Run `accessibility.spec.ts` (the pages anyone can open, the stop-email page, the report form), `keyboard.spec.ts` ("a guest reports an event page by keyboard alone"), `reduced-motion.spec.ts`, `legal-and-analytics.spec.ts` (still exactly one `contentinfo`), `rate-limits.spec.ts`, `invite-only.spec.ts`, `reports.spec.ts`, `sharing.spec.ts`, `custom-link.spec.ts`, `guest-mail.spec.ts`, `events.spec.ts` (the not-ready draft) and `site-look.spec.ts`; fix what they find.
- [x] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, the specs above on the Docker test profile rebuilt with the change (`CI=1`, `--workers=2`). Comments entry; commit `Notice pages: every notice sits on a still poster, in glass`.

## Notes for the implementer

- `SitePage` is not `ThemedPage`: that is a client component with `useOptimistic` and the event page's context. `Backdrop` has no hooks, so one file serves both; `Sparkles` and `Doodles` have no `"use client"` and import as they do now.
- **(plan)** The scope and its focus rule are unlayered, at the end of the file. shadcn's controls carry `outline-none`, `bg-transparent` and `dark:bg-input/30` as utilities, which beat the `components` layer where `.event-page :focus-visible` (`:455-458`) lives, and `.dark` (`:123-151`) sets the same tokens at the same specificity. Headings focused by script (`tabIndex={-1}`) keep no outline, as today.
- **(plan)** shadcn's own fills that would stack a surface `legibility.ts` does not prove are pointed at strong glass in the scope: `CardFooter`'s `bg-muted/50`, an outline button's `dark:bg-input/30`, a field's `dark:bg-input/30`. A link-variant button takes the accent ink, never the accent.
- **(plan)** A notice's heading sits in its `Glass` panel with its text, as in the mock-up's sign-in panel; only headings outside a panel need `Veil`.
- Nothing here changes how the backdrop looks at rest, so `pnpm measure:backgrounds` is not needed (`docs/contributing/backgrounds.md`, "When the backdrop changes"). The docs' path to `Backdrop` is ticket 23's.
- axe reads contrast over a fixed full-screen backdrop as incomplete (`e2e/axe.ts:50-59`): the pixel rows above are the browser's half of the guarantee, `legibility.test.ts` the other.
- The body stays white outside the scope: the backdrop is fixed under every page, as on the event page.

## Comments

### 2026-11-11: landed (Opus 5.5)

**How it landed.** As Produces says. `Backdrop` is in `src/themes/backdrop.tsx` with its comment;
`still` leaves off both blobs' drift (and the second's delay) and draws no effect, and `ThemedPage`
passes none. `SitePage` (`src/themes/site-page.tsx`, a server component) and `Veil`
(`src/themes/glass.tsx`) are as written. `globals.css`: the `themed` variant is
`body:has(.event-page, .site-page) &`, the two inks are in `@theme inline`
(`text-theme-danger-ink`, `text-theme-attention-ink`), and section 5, "SITE PAGES", ends the file,
unlayered, with the ticket's rules verbatim. Too fast (and the event page's 429, which renders
`TooFast`), not found, privacy and terms wear `areaLook(DBLESS_POOL, "fallback")` (Cake, dark text);
the retired link, `NotReady` (`src/app/e/[slug]/not-ready.tsx`), the locked page, the report form
and the stop-mail page wear `areaLook(posterPool(await homePage()), "guest")` (Cocktails on the
shared `app`, light text). Each notice's heading, text and actions sit in one `Glass` panel; the
legal pages put the title on `Veil` and the text and contact line in `Glass`. The report page keeps
its `Card`, which the scope makes glass. Every `<main>` takes `flex-1`.

**Beyond the ticket's text (from ticket 17's Comments and its review):**
- **Destructive fills.** Inside `.site-page`, a destructive button and a destructive badge fill with
  `--destructive-soft` (strong glass) at rest and hovered, light or `dark`: one unlayered rule
  beside the other strong-glass fills, so `bg-destructive/10–30` never paints in the scope, and
  `button.tsx` and `badge.tsx` are untouched. A hovered one (a badge only when it is a link) shows
  its border in the danger ink, which `legibility.ts` proves alone at AA on every surface, so the
  border stands out at more than 3:1. **None of this ticket's pages draws a destructive button or
  badge**, so the pixel check of a destructive control's words on a site page under light text is
  ticket 19's to carry.
- `sitePoster` given an empty pool draws from `DBLESS_POOL` (unit test).
- `legibility.ts`: one helper, `towardsText(base, amount)`, finds the accent ink, the focus ring
  and both new inks; `inkAt` and `inkOf`'s own copy are gone. No value changed: every test in
  `legibility.test.ts` and `resolve.test.ts` passes unchanged.
- `site-look.test.ts`: `eventLook` leaves the theme it was given with its effect.
  `resolve.test.ts`: a site page's variables carry both inks as `#rrggbb`.

**Things to know.**
- `e2e/contrast.ts` holds `worstContrast`, `expectRingStandsOut` and, unexported, `stripBeside`,
  `contrast` and `luminance`. `dashboard.spec.ts` and `keyboard.spec.ts` import from it;
  `dashboard.ts` no longer holds `worstContrast`.
- `worstContrast` on a field reads its border too, and the field's border under light text
  (`--input`, the faint text) is light: on the report form's textarea it is over 2% of the box and
  gave 1.39. The spec makes the field's border transparent while it reads the typed words. Later
  pixel checks of a field's text should do the same.
- `e2e/site-look.spec.ts` waits for the backdrop's picture to be decoded before it reads pixels
  (`backdropPainted`, in the spec), or the worst pixel may be the base colour under it.
- The guest test reaches the stop-mail page through the email cancelling the event (as
  `guest-mail.spec.ts` does): a reply sends no confirmation email.

**Evidence.** RED: `site-look.test.ts`, 1 failed (`sitePoster([], …)` was `undefined`);
`site-look.spec.ts` against the app before the change, 3 failed (`.site-page` count 0). GREEN: unit
tests 35 and 115 passed; `pnpm test` 119 files, 1380 tests; `pnpm lint` and `pnpm typecheck` clean.
Browser, `CI=1 --workers=2`, both projects, on the rebuilt test profile: `site-look`,
`accessibility`, `keyboard` (whole), `reduced-motion`, `legal-and-analytics`, `rate-limits`,
`invite-only`, `reports`, `sharing`, `custom-link`, `guest-mail`, `events` and `dashboard`: 242
passed and 1 failed, "the editor's design sheets, each open, in both text tones" [mobile], timed out
in axe twice under load (the editor is untouched here); alone it passed. Then `site-look`, `locales`,
`cancel-delete`, `turnstile`, `instance-settings` and `dashboard` again, on the test profile
rebuilt after the last edits: 98 passed, 1 flaky ("a guest replies on the Broadsheet past the
check, then confirms the code" [mobile]: "Received" did not show within 15 s, on an event page
this ticket does not touch). It passed on retry, and again alone.

