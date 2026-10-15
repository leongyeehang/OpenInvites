# Task 20b: accessibility and reduced motion

The second part of ticket 20 (`.scratch/openinvites/issues/20-translations-accessibility-performance.md`), split by the controller: its second and third checkboxes. Task 20a (translations) is done; task 20c (performance) follows.

## Acceptance

- [ ] Automated accessibility checks, with axe-core through Playwright (`@axe-core/playwright` as a dev dependency), report zero serious or critical violations on:
  - the home page, sign-up, sign-in, the dashboard, and the event form (create and edit);
  - the Design drawer, open, in both its phone and desktop forms, with the Details group expanded;
  - the event page as a guest: background mode, poster mode, cancelled, and draft;
  - the RSVP flow in both styles (Inline and Sheet): each step, and the confirmation;
  - the host's guest list, the share screen, the admin settings page, the legal pages, the too-fast page, and the not-found page.
  Run the checks at 390px and desktop, in light and dark text tones where the theme applies. They are browser tests in the normal suite, so CI enforces them. Do not disable axe rules to get to zero. A rule excluded because of a known false positive needs a comment naming the axe issue or the reason, and is listed in the ticket comment.
- [ ] The RSVP flow in both styles, and the Design drawer, can be completed by keyboard alone. Browser tests do this with `keyboard.press` only, no clicks: answer Going with a plus-one and a required question; in the drawer, apply a template, change a knob, and close it, with focus returning to the Design button. Visible focus is on every control, and focus rings meet 3:1 non-text contrast against what is behind them (extend `src/themes/legibility.ts` for the themed page).
- [ ] Images carry the host's alternative text: the poster `<img>` in poster mode, and the background description in background mode. A browser test checks the accessible name.
- [ ] Under reduced-motion emulation, no animation or transition plays anywhere. One browser test visits the pages above with `reducedMotion: "reduce"` and asserts that `document.getAnimations()` is empty after interactions and that no element has a non-zero transition or animation duration. Nothing else is switched off.
- [ ] The accessibility notes earlier tickets left for ticket 20 are each fixed, or explicitly ruled out with a reason in the ticket comment. Grep `ticket 20` in `.scratch/openinvites/issues/*.md`. They include:
  - template tiles use `aria-pressed` buttons while every other group is a radiogroup;
  - focus rings on the accent and in the sheet were never checked for 3:1;
  - the disabled Continue button is at 50% accent;
  - the upload hint is not tied to its file input;
  - the QR code has no text alternative carrying the link;
  - the countdown is not announced (decide whether it should be: announcing every 30 s is worse than not announcing);
  - the rich-text toolbar has no `aria-pressed`, and the editor is labelled by `aria-label` rather than a clickable label;
  - the guest list's status dots and locked discs;
  - the questions editor's group label points at nothing, and the required asterisk has no text equivalent.
- [ ] Every `notFound()` page is currently served as `<html id="__next_error__">` with no server-rendered content and no `lang` attribute (found in ticket 18's review; the analytics fallback in the layout works around it). Find out why and fix it, so not-found pages render on the server with `lang`. If the analytics marker and client fallback become unnecessary, remove them and keep the analytics tests green.

Out of scope: performance (task 20c); translation wording (20a is done, the maintainer reads it).
