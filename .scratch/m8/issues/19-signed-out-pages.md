# 19: Signed-out pages: sign-in, sign-up, the password screens and the co-host link look like the invitation that sent the visitor there

**What to build:** Every screen a person sees before signing in, and the co-host link page, sits on one poster from the site's home-page set, the same on every visit and on every one of these screens, with the site's name above the glass cards. The operator's choice of posters for the home page now dresses these screens too, so the moment a visitor presses Sign in the site keeps its character.

**Blocked by:** 18

**Status:** done

**Stories:** 297, 300, 301

**Interfaces**
- Consumes: `SitePage`, `Veil`, `Glass` (ticket 18); `areaLook`, `posterPool` (ticket 17, `src/instance/home.ts`); `homePage()`, `instanceDisplayName` (`src/instance/repository.ts`, `src/instance/home.ts`); `expectSiteLook`, `SITE_POSTERS`, `worstContrast`, `expectRingStandsOut` (`e2e/site-look.ts`, `e2e/contrast.ts`, ticket 18).
- Produces: `src/app/(auth)/layout.tsx` as an async server component wearing `areaLook(posterPool(await homePage()), "welcome")`, with the site's name above its column as a link to `/` carrying `data-slot="site-name"`; `src/app/co-host/[token]/page.tsx` wearing the same look. No new messages: the name is the operator's, and the pages' strings are unchanged.

- [x] Add to `e2e/site-look.spec.ts` (shared `app`, both projects) and watch them fail:
  - "the signed-out screens wear one poster of the site's, the same on every visit, still": `/sign-in` twice, `/sign-up`, `/forgot-password`, `/verify-email?error=invalid_token` and `/sign-in?linkError=1` each pass `expectSiteLook(page, SITE_POSTERS.welcome)`; on each the link named "OpenInvites" (the shared app's name) leads to `/`.
  - "a co-host link wears the same poster, signed out and signed in": an owner makes a co-host link as `e2e/co-hosts.spec.ts` does; a signed-out visitor and a second signed-in host each open it and see the event's title, and the page passes `expectSiteLook(page, SITE_POSTERS.welcome)`.
  - "sign-in reads on its poster": on `/sign-in` (Bokeh, light text) `worstContrast` is at least 4.5 for the h1 "Sign in", the Email field with an address typed into it, and the "Forgot your password?" link in the card's footer; `expectRingStandsOut` holds for the Email field, the Sign in button and that link.
- [x] Add to `e2e/home-page.spec.ts` (the `home-instance` project; the shared `app` may never change the home page's posters), while the home page is set to Always the same poster with Disco: `/sign-in`, `/sign-up` and `/forgot-password` each pass `expectSiteLook(page, "disco-ball-copy")`, and the site-name link reads the name the operator saved. Watch it fail.
- [x] `src/app/(auth)/layout.tsx`: wrap the column in `SitePage`; the `<main>` keeps its narrow centred column, taking `flex-1` in place of `min-h-svh`; above the first card, on `Veil`, the site's name (`instanceDisplayName(home)`) as a link to `/`, the size of the host header's name, its focus shown by the scope's ring. The screens under it keep their shadcn `Card`s, `Alert`s, fields and buttons, which the scope makes glass: `src/app/(auth)/sign-in/page.tsx`, `sign-up/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `verify-email/page.tsx`, and their forms and `social-sign-in.tsx` unchanged.
- [x] `src/app/co-host/[token]/page.tsx`: inside `SitePage` with the welcome look; its `<main>` takes `flex-1`; the title, the line under it and the button or form in one `Glass` panel, as the notice pages are in ticket 18.
- [x] Existing specs: run `registration.spec.ts` and `registration-without-mail.spec.ts` (`fresh-instance`), `host-accounts.spec.ts`, `passkeys.spec.ts`, `magic-link.spec.ts`, `social-login.spec.ts`, `turnstile.spec.ts`, `co-hosts.spec.ts`, `accessibility.spec.ts` (the pages anyone can open, the sign-in link form, the hosts page and co-host link page), `keyboard.spec.ts` (the home page to Create an account, the sign-up through the bot check), `reduced-motion.spec.ts`, `locales.spec.ts`, `home-page.spec.ts` and `site-look.spec.ts`. A spec that finds the site's name by text on these screens may now also find the new link above the card: scope such a locator to what it means. Fix what they find.
- [x] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, the specs above on the Docker test profile rebuilt with the change (`CI=1`, `--workers=2`). Comments entry; commit `Signed-out pages: sign-in and its screens wear the site's poster`.

## Notes for the implementer

- **(plan)** The site's name above the cards comes from the mock-up's sign-in screen ("Poster and glass everywhere"), where the brand sits over the glass panel. It is the operator's name, not a message, so no locale file changes; the layout already reads `homePage()` for the poster set, which is cached per request.
- The verify-email page is reached after a click in an email; with `?error=` it says the link failed. Both read on glass, and both go through the layout.
- Turnstile's widget draws itself with `theme: "auto"` (`src/turnstile/`), by the device's colour scheme, not the backdrop's tone. It is opaque, so it reads either way; leave it.
- `e2e/home.ts` `openHome` reads the home page's own document for its poster's file. The home page is a `ThemedPage`, not a `SitePage`, and must stay so: nothing here draws `/`.
- The `home-instance` row runs after the earlier rows of `home-page.spec.ts` have set the poster; place it where Disco is the one poster, or set it in the row.

## Comments

### 2026-11-12: landed (Opus 5.5)

**How it landed.** As Produces says. `src/app/(auth)/layout.tsx` is an async server component in
`SitePage`, wearing `areaLook(posterPool(await homePage()), "welcome")` (Bokeh on the shared `app`,
light text); its `<main>` keeps the `max-w-sm` column and takes `flex-1`. Above the first card, on
`Veil`, the site's name (`instanceDisplayName`) is a link to `/` with `data-slot="site-name"`, at
the host header's size (`text-lg font-semibold tracking-tight`), wrapping when long, with the
scope's ring for its focus. The screens under it are unchanged. `src/app/co-host/[token]/page.tsx`
wears the same look; its `<main>` takes `flex-1`, and the title, the line under it and the button
or form sit in one `Glass` panel. No messages changed.

**Beyond the ticket's text (from ticket 18's review):**
- `backdropPainted` moved from `e2e/site-look.spec.ts` to `e2e/site-look.ts`; every new pixel row
  waits on it.
- **Danger words.** No signed-out screen draws a destructive `Alert`, button or badge: their notices
  (`?linkError=1`, the sign-up notices) are the default `Alert`, and a refusal is a `FieldError`
  (`text-destructive`) in the card. New row "a signed-out screen's notices and refusals read on its
  poster": on Bokeh under light text, the expired-link notice and a refused sign-in's "That email
  and password do not match." each read at 4.5 or more. The pixel check of a destructive button's
  or badge's words on a site page is still ticket 20's to carry.
- **Partial fills.** A default button's `hover:bg-primary/80` let 20% of the card through under
  its words, a stack no surface proves. The scope now keeps a default button's whole accent at rest
  and hovered (onAccent is proven on it) and shows the hover by an edge in the words' colour, as a
  hovered destructive button is edged in the danger ink. Outline buttons (the passkey button, the
  social sign-in buttons, Send me the link, Resend email), fields (with `disabled:bg-input/50` and
  `dark:disabled:bg-input/80`) and the card footer were already strong glass in the scope at rest,
  hovered and disabled; alerts are glass. No secondary, ghost or link-variant button is on these
  screens. A disabled control is drawn at half opacity, which WCAG exempts. "sign-in reads on its
  poster" also reads Sign in and Send me the link hovered, each at 4.5 or more.

**Things to know.**
- `worstContrast` on a button: a button can sit half a pixel off the grid, so its top and bottom
  rows blend with what is round it, more than the 2% left out as noise (32 px tall: about 6%), and
  its rounded corners and edge show the card. The spec paints those with the button's fill (no
  border colour, `background-clip: border-box`, no radius, a 2 px box-shadow in the fill) while it
  reads the words; later pixel checks of a button should do the same.
- A spec that wants the site's name on these screens should use `[data-slot="site-name"]` or an
  exact link name: the footer's "Powered by OpenInvites" matches "OpenInvites" otherwise. No
  existing spec needed a change.

**Evidence.** RED: the four new `site-look.spec.ts` rows failed against the app before the change
(`.site-page` count 0), and the new `home-page.spec.ts` row failed the same way. GREEN, on the test
profile rebuilt with the change, `CI=1 --workers=2`: `site-look.spec.ts` at both widths, 14 passed;
`home-instance` (`--no-deps`), 19 passed; `fresh-instance` (`registration`,
`registration-without-mail`), 15 passed; `host-accounts`, `passkeys`, `magic-link`, `social-login`,
`turnstile`, `co-hosts`, `accessibility`, `keyboard`, `reduced-motion`, `locales` and `site-look`
at both widths, 248 passed and 1 flaky: `keyboard.spec.ts:314` [mobile] (the sign-up through the
bot check) waited 15 s for Create account to be enabled, which is Cloudflare's test widget passing,
and passed on retry; alone, twice at each width with no retries, 4 passed. `pnpm lint` and
`pnpm typecheck` clean; `pnpm test` 119 files, 1404 tests.
