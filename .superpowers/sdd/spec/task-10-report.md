# Task 10 report: Design drawer, templates and knobs

**Status:** DONE_WITH_CONCERNS (the concerns are about the look, which the maintainer should see, not about correctness)

**Commit:** `2d5d2ce` Design drawer: a host picks a template, changes any part of it, and guests see what was saved

## What I implemented

- **Templates as data files** in `src/themes/templates/`: `birthday.ts`, `vows.ts`, `supper-club.ts`, `kids-party.ts`, `festival.ts`, `quiet.ts`, with the shape in `template.ts`, the drawer order in `index.ts`, and a contributor README (`README.md`) documenting every field and how to add a template. Each file sets every knob (layout, background, title placement, font, accent, text tone, button style, RSVP style, effect). The host's own upload and upload mode are not template knobs. Birthday is round one's A (poster, golden, serif, auto accent, glass, sheet, sparkles). Festival is round one's B (poster, aurora, grotesque, auto accent, glass, inline, doodles). Supper club and Kids' party name `broadsheet` and `thread` in their files. The other templates follow the prototype, except that Quiet's accent is auto: the prototype's `#d9d9e3` is Slate's own auto accent, so auto gives the same colour and keeps the accent row's choice visible.
- **`DEFAULT_THEME` now comes from the Birthday file**: `applyTemplate(null, birthday)`.
- **Pure rules:**
  - `theme.ts`: `applyTemplate` and `OFFERED_LAYOUTS`. Unoffered layouts apply as `poster`, the upload stays in the gallery, and the template is recorded as `{ id, dirty: false }`.
  - `changes.ts`: `applyChange`. A knob change sets dirty. A no-op change returns the same theme. Re-applying a template resets. Re-applying the template that is already on and untouched writes nothing. A background change puts the accent back on auto, which is the prototype's rule.
  - `changes.ts`: `themeReadout`, and `parseThemeChange`, which validates what the browser sends. The accent may only be auto or one of the six swatches.
- **The drawer.** Following the ruling, it lives on the event page:
  - `design-drawer.tsx` is the Design button, rendered only when the viewer is the event's host.
  - `design-panel.tsx` is the plain non-modal panel, loaded with `next/dynamic` the first time it opens. I verified on the production build that none of the panel's code is in the chunks a guest's page loads.
  - The panel's order is Upload (disabled placeholder, "Coming soon"), Templates with thumbnails, Layout (Poster; Broadsheet and Thread disabled, "Coming soon"), Background gallery, then Details, collapsed. Details holds title font, accent (Auto plus six named swatches), text tone (Auto, Light, Dark) and RSVP buttons (Glass, Solid accent, Outline).
  - The thumbnails show the event's own title in each template's resolved theme.
  - The readout says "Theme: Birthday" or "Theme: Custom, started from Birthday".
  - Choices are native radios laid over their tiles, so arrow keys and screen readers work. Escape closes the panel and focus returns to the Design button.
- **Live preview and saving. I chose save on each change**, because it makes the ticket's "reload and see it persisted" read naturally.
  - `ThemedPage` is now a client component that holds the theme in `useOptimistic`. It still renders on the server, so first paint is unchanged.
  - A change shows at once. `changeThemeAction` (`src/themes/actions.ts`) saves it and calls `refresh()`, so the host's page settles on the saved theme, which is what guests see. A failed save reverts, and the panel says it failed.
  - The title (`poster-title.tsx`) and the RSVP buttons read the live theme.
  - `changeEventTheme` in the events repository reads and writes under a row lock. Every write moves `updatedAt`, so the preview card URL changes (ticket 14); a no-op writes nothing.
- **"Nothing unreadable" as a pure rule: `src/themes/legibility.ts`.** It uses WCAG 2 contrast maths with sRGB alpha compositing, as the browser does.
  - **Inputs:** each background's measured `lightest` and `darkest` points (new fields in `backgrounds.ts`), the text tone and the accent.
  - **The glass tint:** a tint of the tone's shade under the settled frost, as little as reading needs.
  - **A veil** behind text set straight on the page: outline buttons and the "not taking RSVPs" note. It is transparent where bare text already reads.
  - **Muted and faint alphas:** they fade no further than the settled 75% and 55%, and come no closer to full strength than 80%, so the hierarchy survives.
  - **Text on the accent:** plum or white, falling back to black or white, one of which always reaches 4.58:1.
  - **The accent as text:** moved towards the tone's text until it reads.
  - **How the check covers the page:** every surface the Poster layout stacks is listed in `SURFACES`, with what it carries, and the unit tests check every background, in both tones, with every accent the page can wear. All colours are now inline `--theme-*` variables, and the per-tone blocks in `globals.css` are gone.
  - **Measurement:** the extremes were measured on the real page backdrop (blobs, scrim over scenes, bottom fade, grain) under the glass's 24px backdrop blur. I used five viewports (360x740, 390x844, 768x1024, 1280x800, 1920x1080), with the blobs at rest and at the far end of their drift. The light tone was measured with the white accent, the brightest blob possible. The method is documented in `backgrounds.ts`.
- **Markup changes the rule required:**
  - Solid RSVP buttons are opaque accent (they were 85%).
  - Outline buttons sit on the veil with a backdrop blur.
  - The chosen RSVP answer is ringed in the tone's text colour, where before the others faded to 60%.
  - The countdown is a solid accent chip with on-accent text.
  - "Remove my RSVP" and the required asterisk use the accent ink.
  - The guest list's "+N" uses faint text instead of `opacity-60`.
  - The "not taking RSVPs" note sits on a veil pill.
- **Messages:** a new `DesignDrawer` namespace in `messages/en.json`, English only.
- **Page:** the session lookup now runs for every event page to decide whether the viewer is the host. Without a session cookie Better Auth returns before touching the database; I checked its source.

## Test results

- `pnpm lint`: clean. `pnpm typecheck`: clean.
- `pnpm test`: **27 files, 178 tests passed** (127 before this ticket).
- **Definitive browser run** against the production image on the Compose test profile. I stopped the dev server with `fuser -k 3000/tcp`, then ran `docker compose --profile test up -d --build --wait && pnpm exec playwright test`. Result: **128 passed (1.4m)**, 64 scenarios at 390px and desktop, including the 4 new ones in `e2e/design.spec.ts`. After the run I stopped the app container (`docker compose --profile test stop app`), and port 3000 is free.
  - On the dev-server fast loop, a full parallel run had 6 timeouts, at 5 seconds each, in older specs such as the cancel dialog and the RSVP confirmation. Re-run alone they all passed, and they pass on the production image. This is dev-mode load, not a regression. The password-reset test needs the container and cannot pass on the dev loop.
- **New browser tests** (`e2e/design.spec.ts`):
  1. **A host applies a template, changes knobs, and guests see the saved theme.**
     - The host applies Festival: the title font becomes Bricolage live, and the template's button is pressed.
     - They change the RSVP buttons to Solid accent: the readout says "Theme: Custom, started from Festival".
     - They set the text tone to Dark: the page's `data-tone` flips live.
     - The test waits until a guest's fetched HTML carries the dark tone, then sees "Saved".
     - After a reload the readout and the radios persisted, and the `og:image` URL has changed.
     - A guest sees the dark tone, the Bricolage title and opaque aurora-accent buttons, and no Design button.
     - Re-applying Festival resets the theme, and the guest's page goes back to light.
  2. **The drawer keeps its order, offers only the Poster layout for now, and gets out of the way.**
     - The upload placeholder is disabled.
     - The heading order is Templates, Layout, Background, Details, and Details starts collapsed.
     - Broadsheet and Thread are disabled and say "Coming soon".
     - Supper club applies with Poster checked.
     - A background from the gallery makes the theme custom.
     - Escape closes the panel and returns focus to the Design button.

### TDD evidence for the pure rules

RED for templates and changes, with the tests written first:

```
$ pnpm exec vitest run src/themes/templates src/themes/changes.test.ts
 FAIL  src/themes/changes.test.ts
Error: Cannot find module './changes' imported from /home/leong/rsvp/src/themes/changes.test.ts
 FAIL  src/themes/templates/templates.test.ts
Error: Cannot find module '../swatches' imported from /home/leong/rsvp/src/themes/templates/templates.test.ts
 Test Files  2 failed (2)
      Tests  no tests
```

GREEN after the data files, `applyTemplate` and `changes.ts`:

```
$ pnpm exec vitest run src/themes
 Test Files  5 passed (5)
      Tests  42 passed (42)
```

A second cycle, "re-applying the template already on, untouched, changes nothing", was written first and failed:

```
 × changes nothing when the template is already on and untouched
AssertionError: expected { uploadId: null, …(11) } to be { uploadId: null, …(11) } // Object.is equality
      Tests  1 failed | 19 passed (20)
```

After adding `sameTheme` it went green: 69 of 69 theme tests.

For legibility, I wrote the test file before `legibility.ts`. Its first run against the first implementation failed 4 assertions on real behaviour:

- the mid-grey `#787878` accent: on-accent at 4.42:1;
- the Slate frost claim;
- the Golden hour tint bound;
- the accent ink.

Those failures drove the model's corrections: surfaces that declare what they carry, opaque solid buttons, and measured extremes in place of a pessimistic blob bound. The suite then went green.

**Mutation checks.** Each rule was broken, the suite run, and the file restored; the suite was 69 of 69 green afterwards:

| Mutation | Result |
| --- | --- |
| Changing a knob no longer marks the template dirty | 7 failed |
| A template's layout applies even when it is not offered | 1 failed |
| A new background keeps the old accent override | 1 failed |
| Picking what is already chosen marks the theme dirty | 1 failed |
| Any colour accepted as an accent | 1 failed |
| Legibility solved to 3:1 instead of AA | 21 failed |
| No black or white fallback on mid-tone accents | 2 failed |
| Outline buttons get no veil | 12 failed |
| Faint text keeps its settled 55% everywhere | 18 failed |
| The accent is set as text unchanged | 18 failed |

## Designer pass

**Screenshots.** I screenshotted all 36 combinations (6 templates × text tone auto or dark × glass, solid or outline) at 390x844 and 1280x800, with reduced motion. For each I captured the top of the page, the page scrolled so the tiles pass over the brightest part of the backdrop, and the RSVP stepper open. I also took the draft page (draft notice, disabled buttons, the "not taking RSVPs" note) with glass and outline buttons. I looked at montages of every template in both tones and all three styles, the open forms, the draft pages and desktop.

**Render audit.** For every text element on screen, the harness hid all text and sampled the lightest and darkest pixels actually behind it. It composited the element's computed colour over both and checked WCAG contrast: 4.5:1, or 3:1 for large text. **4,830 text elements were checked and every one reads at AA**, disabled and decorative (`aria-hidden`) text excepted. The screenshots and harness live in my scratchpad and are not committed.

**What I changed as a result:**

- **Dimmed RSVP buttons.** The unchosen buttons faded to 60% while the stepper was open, and measured from pixels they came in at 3.16 to 4.5:1 in about half the combinations, though they are still active controls. I removed the fade and ring the chosen answer instead, which also keeps solid-style selection visible.
- **The countdown chip.** Gold text on a gold wash could not reach AA over smoked glass (the accent ink went nearly white and looked generic), so it is now a solid accent chip with on-accent text.
- **The drawer layout.** At 390px the section hints overlapped the swatches and the swatch row wrapped. Hints now sit under their headings, swatches are 36px, and the desktop panel is 380px wide so the row fits.
- **Pre-hydration screenshots.** A few early screenshots had been taken before the countdown and "Open in Maps" hydrated. That was a harness timing artefact; the audit itself ran after hydration, and the harness now waits.

**What the maintainer's eye is still wanted on:**

- **Golden hour (Birthday) in the light tone** now has a smoked plum-tinted card rather than the settled 10% white frost, with secondary text at 80% white. That is the cost of AA over the brightest part of the gradient, and it resolves the ticket 06 contrast note that was addressed to ticket 20. It looked intentional to me, with the golden glow still framing the card, but it is a visible change to the round-one A look.
- **The dark text tone on these all-dark backgrounds** turns the cards into a milky frost over a dark page, and outline buttons become milky-filled pills with a border. That is what dark text needs to be readable here. It looks deliberate, but it is the least "designed" of the combinations.

## Files changed

- **New:**
  - `e2e/design.spec.ts`
  - `src/app/e/[slug]/design-drawer.tsx`, `src/app/e/[slug]/design-panel.tsx`
  - `src/themes/actions.ts`, `changes.ts`, `changes.test.ts`, `legibility.ts`, `legibility.test.ts`, `poster-title.tsx`, `swatches.ts`
  - `src/themes/templates/`: `README.md`, `template.ts`, `index.ts`, the six template files, `templates.test.ts`
- **Modified:**
  - `messages/en.json`, `src/app/globals.css`, `src/events/repository.ts`
  - `src/app/e/[slug]/guest-list.tsx`, `page.tsx`, `rsvp-flow.tsx`, `viewer.tsx`
  - `src/themes/backgrounds.ts` and `backgrounds.test.ts`, `poster-layout.tsx`, `resolve.ts` and `resolve.test.ts`, `rsvp-buttons.ts`, `theme.ts`, `themed-page.tsx`
- **Not staged, as instructed:** `.scratch/openinvites/issues/10-design-drawer-templates-and-knobs.md`, which I updated: status done, all checkboxes ticked, a dated comment with notes for tickets 11, 12, 13, 14 and 20, and for 21's contributing docs. CONTEXT.md and decisions.md are untouched.

## Self-review

- **Security.** The server action re-validates the change (`parseThemeChange`) and writes only with `hostId = session user` under a row lock. The event id comes from the client but is scoped to the host. Guests get no drawer and no panel code. Server actions are dispatched one at a time, and the row lock covers concurrent tabs.
- **Tests at the right seams.** The browser tests observe only what a host or guest can see: the readout, radios, the `data-tone` attribute, computed font and colours, and fetched HTML. The unit tests call the pure rules directly.
- **Checked by hand:** focus moves into the panel on open and back to the button on close; there are no console errors or hydration warnings on host or guest pages; reduced motion stops the panel's entrance.
- **Things I considered and left:**
  - `refresh()` re-renders the whole event page on the server for each change. That costs a few queries per host click, which is acceptable for the host.
  - The layout row reflects the resolved layout, which is always Poster in M1.

## Concerns

1. **The look changes on Golden hour, and the dark-tone-on-dark cards**, as described above. They are deliberate consequences of the AA ruling but need the maintainer's eye.
2. **The extremes are measured data.** They are coupled to the backdrop's rendering (blob strength, scrim, fade) and were measured at five viewport sizes; the solver aims for 4.6:1 as a margin. Anyone who changes the backdrop or adds a background must re-measure. The method is documented in `backgrounds.ts`, but my measuring script was a scratch tool and is not in the repo. Ticket 21's contributing docs may want it committed.
3. **Uploads (ticket 12)** use `UNMEASURED` (white or black under the scrim) until their extremes are sampled. That is safe but heavily tinted.
4. **Glossary.** "Design drawer" (the ticket's and decisions' term) is not in CONTEXT.md, and CONTEXT lists "design" under Theme's _Avoid_ words. The code keeps "theme" for the stored thing and uses "Design" only for the drawer and its button. A glossary entry for the drawer might be worth adding; I did not touch CONTEXT.md.
5. **Vitest notices.** `pnpm test` prints Vitest's config-loader warning, plus intermittent "Isolate" and "Transform" performance hints. All three also appear at HEAD without this ticket, which I checked in a throwaway worktree, and they come from Vitest 5 and the untouched config. I left them alone.
6. **The desktop plain panel** overlaps the content's right edge by about 40px at 1280px. Ticket 11 replaces it with a side panel.
7. **Ticket 14's card font:** the title font is now a real choice, so the preview card drawn in `next/og`'s bundled face differs visibly from the page for three of the four fonts. I noted it in the ticket comment, as asked.
