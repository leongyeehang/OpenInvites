# 06: Theme and the Poster layout

**What to build:** The event page looks like the prototype's Poster layout with the Birthday template: a warm layered background with grain, a frosted glass card, a large serif title, and an accent colour and text tone derived on the server. Every new event gets this look without the host doing anything.

**Blocked by:** 05 Create, publish, and view an event

**Status:** done

- [x] The theme is stored on the event with the shape settled by the prototype (branch prototype/event-page), inlined here because it encodes decisions:

  ```ts
  type Theme = {
    layout: "poster" | "broadsheet" | "thread";   // M1 stores it, only "poster" is rendered
    backgroundId: string | null;                   // curated background, or null when an upload is used
    uploadId: string | null;
    uploadMode: "background" | "poster";
    titlePlacement: "on" | "below";                // poster mode only
    font: "serif" | "grotesque" | "display" | "rounded";
    accentOverride: string | null;                 // null means derive
    textTone: "auto" | "light" | "dark";
    buttonStyle: "glass" | "solid" | "outline";
    rsvpStyle: "inline" | "sheet";
    effect: "none" | "confetti" | "sparkles" | "doodles"; // stored, not rendered in M1
    template: { id: string; dirty: boolean } | null;
  };
  ```

- [x] New events receive the Birthday template's knobs with template `{ id: "birthday", dirty: false }`; the template files themselves arrive in ticket 10, so this ticket may hard-wire Birthday's values as the default.
- [x] The nine curated backgrounds and four fonts from the prototype exist as data files; each background carries a pre-chosen accent and a luminance; fonts are self-hosted and subset.
- [x] The server resolves the accent (override, else upload's sampled accent, else the background's) and the text tone (override, else light on dark backgrounds and dark on light ones) into CSS variables so the page is finished on first paint.
- [x] The Poster layout renders: poster card with the title in the theme font, "Hosted by", when, where, description, and empty slots where the RSVP buttons and guest list will go. Effects are not rendered. Any entrance animation stops under reduced motion.
- [x] Unknown or non-poster layouts render as Poster.
- [x] Visual check against PROTOTYPE.md at 390px and desktop; a browser test asserts the theme's font and CSS variables are applied; unit tests cover accent and text tone resolution.
- [x] Components are built with the ui-styling skill.

## Comments

**2026-09-21, implementing agent.** Done. Lint, type check, 63 unit tests, and 44 browser tests (22 scenarios at 390px and desktop) pass locally against the production image on the Compose `test` profile. Visual check at 390px and 1280px matches PROTOTYPE.md's verdict: warm layered gradient with two drifting blobs and grain, frosted glass poster card, large Instrument Serif title, "Hosted by" with an initials disc in the accent, glass tiles for When, Where, and About.

How it landed:

- Themes module in `src/themes/`: `theme.ts` (the `Theme` shape from the prototype, `DEFAULT_THEME` with Birthday's knobs and template `{ id: "birthday", dirty: false }`, and `parseTheme`, which completes a stored theme knob by knob so an empty or partly unknown one still renders), `backgrounds.ts` (the nine curated backgrounds as data, each with its pre-chosen accent and a measured average luminance; the four scenes are the prototype's SVGs in `public/backgrounds/`), `fonts.ts` (the four title fonts as data) and `title-fonts.ts` (`next/font/local` over Latin-subset woff2 files committed in `src/themes/fonts/` with their OFL licences, so nothing is fetched from Google at build or run time), `resolve.ts` (accent: override, else the upload's sampled accent when an upload is in use, else the background's; text tone: override, else dark above 0.6 luminance, else light; every stored layout renders as Poster), `themed-page.tsx` (the page root with the accent as inline CSS variables, the tone as `data-tone`, the font's class, and the backdrop) and `poster-layout.tsx` (the card, the tiles, and empty `rsvp` and `guestList` slots for tickets 07 and 08).
- The theme is a `jsonb` column on `event` (migration `0003_theme`, default `{}`); `createEvent` writes the Birthday theme and every repository read runs `parseTheme`, so the `Event.theme` type is honest for rows from before this ticket.
- Tone tokens live in `globals.css` under `.event-page[data-tone]` with utilities (`bg-theme-glass`, `text-theme-text-muted`, `shadow-poster`, `text-poster-serif`...) so the page is finished on first paint; the dashboard's tokens are untouched.
- Entrance and drift animations are CSS behind `motion-safe:` (tw-animate-css, no Motion dependency yet); the browser test emulates reduced motion and asserts the card's animation is `none`.
- An upload counts as in use only when `backgroundId` is null (the settled shape), so a host who keeps an upload but picks a curated background again gets the background's accent and tone. Unit tests cover every accent and tone branch.
- Review caught and fixed before commit: the page root's own background painted over the fixed backdrop (the gradient was invisible); the `cn` class merger dropped `leading-*` after a font-size class (the line height now rides on the size token); the second blob's `direction-reverse` was a no-op on symmetric keyframes (a negative delay offsets it instead); `role="status"` on static content.

Decisions and things to know:

- The event page uses theme-token utilities rather than shadcn's Card, Alert, and Button, because those are bound to the dashboard's semantic tokens and the event page must always show its own theme. The draft notice was restyled to match.
- Fonts are not preloaded: a page uses one face of four, and preloading would fetch all four. The title first paints in a metrics-adjusted fallback and swaps.
- The date sticker (weekday, day, month in the event's zone) is part of the prototype's poster card and was kept.

Left for later tickets or noted:

- **For ticket 20 (accessibility):** on Golden hour the top of the poster card sits on the brightest part of the gradient. Measured on the 1280px render: the white title is 3.5:1 (passes AA for large text); the eyebrow at 75% white is about 2:1 and "Hosted by" at 75% white about 3.3:1, both below AA for small text. The prototype had the same values. Candidate fixes that change the settled look slightly: a tone scrim over the top of gradient backdrops, or a darker frost on the poster card in the light tone.
- The theme's upload branches (accent, luminance, poster mode) are wired for tickets 12 and 13 but no event has an upload yet; the background is always curated.
- Templates as data files, the drawer, and the Birthday values moving out of `DEFAULT_THEME` are ticket 10.
