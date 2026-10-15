# 10: How often the event page was opened

**What to build:** The host sees how many times the event page has been opened by people other than its hosts.

**Blocked by:** 05 Co-hosts (hosts are not counted)

**Status:** done

- [x] Schema: `event.views` integer not null default 0.
- [x] `src/events/views.ts`: `countsAsView(request, event, viewer)` is pure and unit tested: a document request (GET or HEAD without the `rsc` header, as `src/proxy.ts` defines it), for a published or cancelled event, by a viewer who is not one of its hosts; not a draft, not a server action redraw, not a prefetch (`next-router-prefetch` or `purpose: prefetch` headers).
- [x] The event page increments `views` once per counted request (`UPDATE … SET views = views + 1`), after the page has decided it is the invitation (not the not-ready page) and not "too fast". The increment never fails the page: an error is logged and the page renders.
- [x] The manage page shows "Opened {count} times" beside the link, in the viewer's locale with plural rules, and the dashboard card does not (keep the card as it is).
- [x] Browser test (extend `e2e/events.spec.ts`): the host opens their own published page three times and the count stays 0; a guest opens it twice and the count reads 2; a draft opened by a guest (the not-ready page) adds nothing.
- [x] `docs/operator/configuration.md` or the upgrade guide: one sentence that the count is of page opens, inside the instance, and includes link previews fetched by chat apps (ADR-0005: nothing leaves the instance).

## Notes for the implementer

- Rendering a page is not a place for writes in general; this is the one exception, kept to a single statement with no read-back. Say so in a comment.
- Commit subject, e.g. `Events: the host sees how often the event page has been opened`.

## Comments

**2026-10-08, implementing agent.** Done. `pnpm lint`, `pnpm typecheck`, `pnpm test` (473 passed) clean; `events`, `rsvp`, `rate-limits` and `co-hosts` specs 67/67 against a production build.

How it landed:
- `event.views` (migration `0021_optimal_boom_boom.sql`); `countsAsView` in `src/events/views.ts` (pure, 7 unit tests); `recordView` in `src/events/repository.ts` (one `UPDATE … views = views + 1`, try/catch logs); one call in `src/app/e/[slug]/page.tsx` after the not-ready decision; `Events.manage.opened` beside the link on the manage page; one paragraph in the Analytics section of `docs/operator/configuration.md`.

Decisions and things to know:
- A page cannot read its request's method, so the page says POST when `next-action` is present and GET otherwise; that is exactly what a redraw after a server action is. Not a forwarded header from the proxy, which a client could forge.
- The count shows on drafts too (always 0 there, since drafts never count).
- The dashboard card is unchanged.

Left for later tickets or noted:
- Ticket 15, translations least sure of: `Events.manage.opened` in zh-Hans ("活动页面已被打开 {count} 次") and zh-Hant ("活動頁面已被開啟 {count} 次"); "opened" is rendered as a page open, not a visit by a person.
- The calendar file and preview card are their own routes and never count.

Evidence:
- RED: `pnpm exec vitest run src/events/views.test.ts` failed (module `./views` missing, "no tests"); GREEN: 7 passed.
- Browser (production build, port 3000): host's three opens leave 0; guest's two opens read "Opened 2 times"; a guest on a draft adds nothing, then after publishing one open reads "Opened once".
