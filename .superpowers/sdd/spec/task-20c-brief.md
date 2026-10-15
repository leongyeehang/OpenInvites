# Task 20c: performance

The last part of ticket 20 (`.scratch/openinvites/issues/20-translations-accessibility-performance.md`), split by the controller: its fourth checkbox. 20a (translations) and 20b (accessibility, reduced motion) are done. Finishing this sets the ticket's Status to done, except for the maintainer's own reading of the Chinese, which stays unticked.

## Acceptance

- [ ] The event page scores at least 90 for performance in a Lighthouse mobile audit, using Lighthouse's default mobile profile (a mid-range phone with slow 4G, simulated throttling), against the production image from the Compose test profile. Measure all of these:
  - a published event on a curated background;
  - the same event with an uploaded photo as background;
  - poster mode with a portrait poster;
  - with the Sheet RSVP style;
  - in English and in Simplified Chinese.

  Report the median of three runs per variant, with LCP, TBT, CLS and the largest opportunities.
- [ ] A script in the repo reproduces the audit, for example `pnpm perf`, using Lighthouse as a dev dependency with Playwright's Chromium via `CHROME_PATH`. It seeds the variants through the product, the way the browser tests do, and fails when any variant's median falls below 90. It is not wired into CI: Lighthouse scores vary between runners, and a flaky gate is worse than none. The README's Tests section says how to run it.
- [ ] Images are served responsively.
  - Uploaded pictures get the widths a phone and a desktop need: a `srcset`/`sizes` on the poster `<img>`, and `image-set()` or media queries for the background. This probably means adding smaller widths to `RENDITIONS` (`src/uploads/renditions.ts`), which stores and removes every name it lists, then documenting the new file names where ticket 19 documented the others (`docs/operator/upgrade-backup.md`).
  - The poster, or the background when it is the largest paint, is fetched early with the right priority.
  - Uploads made before this change are fine to lack the new widths; the app has never been released, so no backfill or fallback is needed.
- [ ] Fonts are subset and self-hosted (they already are; verify). The page preloads only the title font it actually uses, and text is not hidden while it loads (`font-display`).
- [ ] The client gets only the messages it needs. Today `NextIntlClientProvider` in `src/app/layout.tsx` sends every namespace to every page (ticket 10's note). Pass the event page, and the other pages, only the namespaces their client components use. Keep a test or type check that fails if a client component uses a namespace its page did not pass: a missing message at runtime is worse than a larger page.
- [ ] The proxy's not-found check (task 20b) loads the full event row on every guest document view. Make it an existence and state query. The Next.js docs say to keep proxy checks fast.
- [ ] If the page-wide blur (24px glass `backdrop-filter`; 64px blur behind a poster) shows in the audit as a real cost, reduce it without changing the look beyond what the legibility rule allows. Otherwise say that it does not.

Out of scope: host-area performance, the preview card route, Safari-specific tuning.
