# 03: The custom link

**What to build:** A host may give an event a custom link such as `/e/adas-birthday` beside its random one. Both open the page; the custom one is the one shown, printed and emailed. Changing it retires the old custom link; resetting the link retires both.

**Blocked by:** 02 Report an event (its page link moves to the helper)

**Status:** done

- [x] Schema: `event.custom_slug text unique` (nullable). Migration 0025.
- [x] `src/events/slug.ts` (pure, unit tested): `CUSTOM_SLUG_MIN = 3`, `CUSTOM_SLUG_MAX = 40`, `isCustomSlug(value)` (lowercase letters, digits and single hyphens, neither first nor last: the pattern `^[a-z0-9]+(-[a-z0-9]+)*$` within the length), `normaliseCustomSlug(input)` (trim, lowercase), `isSlug(value)` accepting the random shape or the custom shape, `eventPath(event: { slug: string; customSlug: string | null })` returning `/e/<customSlug or slug>`, and `eventUrl(event)` prefixing `baseUrl()`.
- [x] Repository (`src/events/repository.ts`): `findEventBySlug` matches `slug` or `custom_slug`; `eventLinkExists` and `isRetiredSlug` consider both columns; `withFreshSlug` treats a unique violation on either column as a collision; `setCustomSlug(hostId, id, custom: string | null)` in one transaction that locks the event row: refuses `taken` when another event's `slug` or `custom_slug`, or a `retired_slug`, equals it; inserts the previous custom slug into `retired_slug` when changing or removing it. `resetEventLink` also retires the custom slug and clears it. Gate: `can(role, "share")`.
- [x] Share page (`/events/[id]/share`): a **Custom link** card: the field with the prefix `{baseUrl}/e/` shown before it, Save; when set, the custom link with Copy and a Remove button; refusals "That link is taken." and "Use 3 to 40 lowercase letters, digits and hyphens."; one line "Anyone can guess a custom link. The random link stays the private one."; beside the Reset button: "Reset retires the custom link too." The copy button, the QR code, the share sheet and the preview card use `eventUrl`. Keys under `Events.share.customLink.*`.
- [x] Every link to an event page goes through `eventPath` or `eventUrl`: the manage page's link card, the share page, the preview card and calendar routes' links, `src/rsvps/notify-cancellation.ts`, `src/comments/notify-hosts.ts`, `src/reminders/queue.ts`, `src/announcements/*` (the reminder draft and the announcement mail), the report page's links (task 2), and `revalidatePath` calls, which revalidate both paths when both exist. Grep `"/e/"` and `` `/e/${ `` across `src/` and leave none.
- [x] `e2e/events.ts`: `createDraft` matches the link with `/e/[A-Za-z0-9-]+$`.
- [x] Unit tests: `isCustomSlug` at 2, 3, 40 and 41 characters, hyphens first, last and doubled, uppercase, non-ASCII; `isSlug` for both shapes; `eventPath` with and without a custom slug.
- [x] Browser tests (`e2e/custom-link.spec.ts`): a host sets `adas-birthday-<suffix>`, the share page shows it, the page opens at the custom link and still at the random link, the manage page's link card shows the custom one; `ADAS-Birthday-<suffix>` is saved lowercased; a second host's event cannot take the same link ("That link is taken."); `ab` and `-abc` are refused with the shape line; changing the custom link makes the old one show the "link no longer valid" page; an announcement emailed to a guest carries the custom path (assert the path); Reset retires both links and clears the field.

## Notes for the implementer

- `retired_slug` and `RetiredLink` (`src/app/e/[slug]/`) already render the retired page; a retired custom slug uses them unchanged.
- The random slug is still issued to every event and is never removed: it is the private link (ADR-0004).
- Commit subject, e.g. `Links: a host can give an event a custom link beside its random one`.

## Comments

**2026-10-09, implementing agent.** Done. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 547 passed (66 files).

How it landed: commit 0371503. Migration is 0026 (`0026_custom_link`), not 0025. `src/events/slug.ts` gained the pure rules plus `eventPaths` (both paths, for `revalidatePath`). Repository: `setCustomSlug` (row lock, taken check across `event.slug`, `event.custom_slug`, `retired_slug`), `findEventBySlug`/`eventLinkExists` match both columns, `isSlugCollision` accepts either constraint, `resetEventLink` retires and clears the custom slug. `reportableEventExists` and the inbox (`listReports` now returns `eventCustomSlug`) take the custom slug. Every `/e/` link in `src/` goes through the helpers (grep leaves only slug.ts). `PageFooter`'s `reportSlug` prop became `reportPath`; `ReportForm` takes `eventPath` for its back link. Share page: Custom link card (`custom-link-form.tsx`), keys under `Events.share.customLink.*`.

Decisions and things to know:
- A retired link is never given out again, not even to the event that retired it (ticket: refuse when any `retired_slug` equals it). Returning to an old custom link therefore says "That link is taken."
- Saving an empty field removes the custom link, as the Remove button does.
- A refusal hands the typed value back (`CustomLinkState.typed`), since React resets a form's uncontrolled field after the action; without it the typed value vanished with the error.
- The card shows no second copy of the link text (the page's top line already shows the custom one); Copy is labelled "Copy custom link" so it does not clash with the existing "Copy link". The field's accessible name is "Custom link", same as the section heading, so tests use `getByRole("textbox")`.
- The random link of a guest cannot be typed as a custom link (uppercase is lowercased), so "taken by another event's random link" is only reachable for an all-lowercase random slug; the SQL covers it, the browser test does not.
- Both unique constraints now count as a slug collision for `withFreshSlug`.

Left for later tickets or noted: ticket 08 (personal invite links), 06, 07 and any new mail or page link must use `eventPath`/`eventUrl` (and `eventPaths` for revalidation), and any `Pick<Event, ...>` passed to them needs `customSlug`. Ticket 11: Chinese strings least sure of: zh-Hans "这个链接已被占用。" and "重置时，自定义链接也会一并停用。"; zh-Hant "這個連結已被使用。", "請使用 3 到 40 個小寫字母、數字或連字號。" and "任何人都猜得到自訂連結，隨機連結仍是私密的那一個。". No glossary change made; CONTEXT.md could name "custom link".

Evidence: RED: `slug.test.ts` with the new cases failed 5 of 10 before `slug.ts` changed; GREEN 10/10; mutation (regex loosened to `^[a-z0-9-]+$`) failed the hyphen test, restored. Browser, Docker test profile rebuilt from the working tree (`up -d --build --wait`), `CI=1 --workers=2`: custom-link, sharing, events, reports, announcements, cancel-delete, rate-limits: 81 passed; duplicate, limits, reminders, comments, guest-mail: 36 passed with one flaky `registration.spec.ts` operator test on the fresh-instance project (waits for a second mail to the operator address; unrelated to links, and it passed on retry, but it fails a `CI=1` run). The custom-link spec was flaky once before the `typed` fix, and not after.

**2026-10-09, implementing agent (review fix round 1).** Done. lint, typecheck clean; `pnpm test` 548 passed.

- `generateSlug` redraws while the draw is custom-shaped; unit test stubs `randomInt` (first draw all lowercase, second not) and checks 1000 draws. RED: failed before the change; GREEN: 11/11.
- The event page now carries `{ ...found, slug }` with the slug it was opened at, `settings` is just the three RSVP fields, the calendar file is named after the opened slug; the spec checks `page.content()`, the calendar body and its `Content-Disposition` hold no random slug. Preview and metadata only use `eventUrl`, so they show the custom link.
- Share card: "The random link still works:" with the random link and "Copy random link"; `role="status"` for Saved/Removed; Remove is now a button of the same form (name `remove`), so it clears a stale refusal, and `removeCustomLinkAction` is gone. `resetEventLink` locks the row `for update`. zh `notFound` lines aligned. Spec: shape loop reloads each iteration; the empty-field path is driven by clearing and saving. Comment rewrapped.
- Browser, Docker loop rebuilt, `CI=1 --workers=2`: custom-link, sharing, rsvp, comments, reports: 57 passed.

**2026-10-09, implementing agent (review fix round 2).** The report page passes `ReportForm` the route's slug, not `event.slug`; the spec checks the report page at the custom link holds no random slug and that sending a report there shows the thanks. lint, typecheck clean; test 548 passed; custom-link + reports on the Docker loop: 23 passed.
