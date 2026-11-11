# 18: Notice pages: every notice a visitor meets sits on a still poster, in glass

**What to build:** The frame every page that is not an event page will wear, and the notice pages first. `Backdrop` moves out of `themed-page.tsx` into a file of its own and learns to hold still; a server component `SitePage` paints a `SiteLook` behind its children as the event page does, with the theme's variables, the themed footer, and a scope in `globals.css` that turns shadcn's cards, fields, alerts and buttons into the glass `legibility.ts` solves. Too fast, not found, privacy and terms wear the fallback poster, chosen without the database; the locked page, the report form, a retired link, a draft that is not ready and the stop-mail page wear the guest area's poster from the site's set, never the event's Theme, so they read the same whatever the host chose.

**Blocked by:** 17

**Status:** ready-for-agent

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

- [ ] Write `e2e/site-look.spec.ts` (shared `app`, both projects) and watch it fail:
  - "the pages drawn without the database wear one poster from the whole gallery, still": `/too-fast`, `/privacy`, `/terms` and `/no-such-page` each pass `expectSiteLook(page, SITE_POSTERS.fallback)` (contextOptions without reduced motion), with their h1 visible.
  - "a guest's notice pages wear the site's poster, never the event's": a published event on the Disco poster (`pickDesign(page, "Poster", "Poster", "Disco", "Gallery")`); its report form, the locked page of an invite-only event (as `invite-only.spec.ts` makes one), a draft opened by a guest ("This invitation isn’t ready yet"), a reset link (as `sharing.spec.ts` resets one) and the stop-mail page from a guest's confirmation email (as `guest-mail.spec.ts` reads it) each pass `expectSiteLook(page, SITE_POSTERS.guest)`, and none holds `disco-ball-copy`.
  - "a legal page reads on a light poster and the report form on a dark one": on `/privacy` (Cake, dark text) `worstContrast` of the h1 and of the first paragraph of `[data-slot="legal-text"]` is at least 4.5; on the report form (Cocktails, light text) the h1, the label "What’s wrong with this page?" and the reason field's typed text are at least 4.5, and `expectRingStandsOut` holds for the reason field, the email field and Send report.
- [ ] Move `Backdrop` (`src/themes/themed-page.tsx:77-113`) unchanged into `src/themes/backdrop.tsx`, its comment with it; `still` leaves off the two blobs' `motion-safe:animate-theme-drift` (and the second's delay) and draws no effect. `ThemedPage` (`:69`) passes no `still`, so the event page is drawn exactly as before.
- [ ] Write `SitePage` and `Veil`, and the CSS. In `globals.css`: line 11's variant widened; and a section `/* === 5. SITE PAGES === */` at the end of the file, outside every `@layer` and so after `.dark`:

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
- [ ] Restyle each notice page inside `SitePage`, its `<main>` taking `flex-1` in place of `min-h-svh`; a notice's heading, text and actions in one `Glass` panel; a heading outside a panel on `Veil`. Fallback look, no query: `src/components/too-fast.tsx` (`/too-fast`, and the event page's own 429 at `src/app/e/[slug]/page.tsx:246`), `src/app/not-found.tsx`, `src/legal/legal-page.tsx` (`/privacy`, `/terms`: the title on `Veil`, the operator's text and the contact line in `Glass`). Guest look, `areaLook(posterPool(await homePage()), "guest")`: `src/app/e/[slug]/retired-link.tsx`, the not-ready page (`src/app/e/[slug]/page.tsx:263-271`, moved into `not-ready.tsx`), `src/app/e/[slug]/locked-page.tsx`, `src/app/e/[slug]/report/page.tsx`, `src/app/m/[token]/page.tsx`. Rewrite the comments that call the locked and report pages plain (`locked-page.tsx:6-10`, `report/page.tsx:28-31`): they wear the site's backdrop, never the event's Theme, so they read the same whatever the host chose.
- [ ] Existing specs: `e2e/dashboard.ts` and `e2e/keyboard.spec.ts` import from `e2e/contrast.ts`; `keyboard.spec.ts`'s comments at `:266-268` and `:296` stop calling the report page plain. Run `accessibility.spec.ts` (the pages anyone can open, the stop-email page, the report form), `keyboard.spec.ts` ("a guest reports an event page by keyboard alone"), `reduced-motion.spec.ts`, `legal-and-analytics.spec.ts` (still exactly one `contentinfo`), `rate-limits.spec.ts`, `invite-only.spec.ts`, `reports.spec.ts`, `sharing.spec.ts`, `custom-link.spec.ts`, `guest-mail.spec.ts`, `events.spec.ts` (the not-ready draft) and `site-look.spec.ts`; fix what they find.
- [ ] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, the specs above on the Docker test profile rebuilt with the change (`CI=1`, `--workers=2`). Comments entry; commit `Notice pages: every notice sits on a still poster, in glass`.

## Notes for the implementer

- `SitePage` is not `ThemedPage`: that is a client component with `useOptimistic` and the event page's context. `Backdrop` has no hooks, so one file serves both; `Sparkles` and `Doodles` have no `"use client"` and import as they do now.
- **(plan)** The scope and its focus rule are unlayered, at the end of the file. shadcn's controls carry `outline-none`, `bg-transparent` and `dark:bg-input/30` as utilities, which beat the `components` layer where `.event-page :focus-visible` (`:455-458`) lives, and `.dark` (`:123-151`) sets the same tokens at the same specificity. Headings focused by script (`tabIndex={-1}`) keep no outline, as today.
- **(plan)** shadcn's own fills that would stack a surface `legibility.ts` does not prove are pointed at strong glass in the scope: `CardFooter`'s `bg-muted/50`, an outline button's `dark:bg-input/30`, a field's `dark:bg-input/30`. A link-variant button takes the accent ink, never the accent.
- **(plan)** A notice's heading sits in its `Glass` panel with its text, as in the mock-up's sign-in panel; only headings outside a panel need `Veil`.
- Nothing here changes how the backdrop looks at rest, so `pnpm measure:backgrounds` is not needed (`docs/contributing/backgrounds.md`, "When the backdrop changes"). The docs' path to `Backdrop` is ticket 23's.
- axe reads contrast over a fixed full-screen backdrop as incomplete (`e2e/axe.ts:50-59`): the pixel rows above are the browser's half of the guarantee, `legibility.test.ts` the other.
- The body stays white outside the scope: the backdrop is fixed under every page, as on the event page.

## Comments
