# Task 10 report: how often the event page was opened

Commit b5aa0a1 "Events: the host sees how often the event page has been opened".

Implemented: `event.views` column (migration 0021); pure `countsAsView` (GET/HEAD, no `rsc`, no `next-router-prefetch`, no `purpose`/`sec-purpose` prefetch, state not draft, viewer not host); `recordView` (single UPDATE, errors logged); one call in the event page after the not-ready decision (method inferred as POST when `next-action` is present); `Events.manage.opened` in all three message files, shown beside the link on the manage page; operator doc paragraph in Analytics.

TDD: RED `pnpm exec vitest run src/events/views.test.ts` failed (module missing); GREEN 7 passed.
Checks: lint and typecheck clean; `pnpm test` 473 passed; Playwright events, rsvp, rate-limits, co-hosts 67/67 on the production-build loop (standalone server needed `drizzle/`, `public`, `.next/static` copied into `.next/standalone`; the copied `drizzle` dir was removed afterwards). Port 3000 stopped.
Browser tests added to e2e/events.spec.ts: host opens x3 stays 0, guest x2 reads 2; draft opened by guest adds nothing, one opening after publishing reads once.
Files: src/events/views.ts, views.test.ts, repository.ts, duplicate.test.ts (fixture gets `views: 0`), src/db/schema.ts, drizzle/0021*, src/app/e/[slug]/page.tsx, src/app/(host)/events/[id]/page.tsx, messages/*.json, docs/operator/configuration.md, e2e/events.spec.ts.
Self-review: no problems found. Concern: method detection relies on `next-action`; zh strings flagged for ticket 15. No mutation check run on the pure rule beyond the RED run.
