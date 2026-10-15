# 02: Report an event

**What to build:** Every published or cancelled event page carries "Report this event". A report is stored, emailed to the operator when the instance has mail, and listed on a reports page under the instance settings, where the operator can delete the event or mark the report handled.

**Blocked by:** nothing

**Status:** done

- [x] Schema: `report` (`id`, `event_id` uuid references `event` on delete **set null**, `event_title text not null` copied at creation, `reason text not null`, `contact text`, `created_at`, `handled_at`). Migration 0024.
- [x] Rate limit `report`: `LimitName` gains `report`, variable `RATE_LIMIT_REPORT`, default `5/1h` (`src/rate-limit/config.ts`), a row in the docs table, and `RATE_LIMIT_REPORT: 5/1m` on the Compose `app` service and in `.env.development`, as the other low test limits.
- [x] `src/reports/report.ts` (pure, unit tested): `REASON_MIN = 20`, `REASON_MAX = 1000`, `parseReport(fields: { reason: string; contact: string })` trimming both, refusing `reasonTooShort`, `reasonTooLong`, `contactInvalid` (the RSVP email rule), and returning `{ reason, contact: string | null }`. `src/reports/repository.ts`: `createReport`, `listReports()` (unhandled first, then newest first; with the event's slug and state when it still exists), `markReportHandled(id)`, `deleteEventAsOperator(eventId)` (through `removeEvents`, then marks every report of that event handled). `src/reports/notify-operator.ts`: with mail, one row through `queueMail` to the operator account's email (the `user` row `instance_settings.operator_id` names; nothing is sent when there is no operator), `eventId` set, keys `Mail.report.{subject,body}` in English (the operator docs' language): the event's title, its link, the reason, the contact or "no contact given", and that the report is also on the instance's reports page.
- [x] `/e/[slug]/report` (`src/app/e/[slug]/report/page.tsx` and a form component): the heading "Report {title}", a textarea "What's wrong with this page?" (required), "Your email (optional)", "Send report"; refusals under the fields; after sending, "Thank you. Your report has reached the operator of this instance." and a link back to the page. A draft or an unknown slug is the not-found page; a cancelled event can be reported. The action: `consume("report")` (refusal `tooFast` with the usual "You're going too fast" line), parse, store, notify. The proxy's `notFoundHere` recognises `/e/<slug>/report` as it recognises `/e/<slug>` (the `eventPage` limit already covers `/e/:path*`). Keys under `Report.*`.
- [x] Every layout's footer (the `contentinfo` the legal-and-analytics spec reads) gains a "Report this event" link to the report page for published and cancelled events; a draft shows none.
- [x] `/instance/reports` (`src/app/instance/reports/page.tsx`, `requireOperator()`), linked from `/instance` as "Reports" with the count of unhandled ones in the link: each report shows the event's title (a link to its page while the event exists, "Event deleted" otherwise, which counts as handled), the reason, the contact as a mailto link, when it was sent, and for an unhandled report of an existing event two buttons: **Delete event** (an `AlertDialog` saying the event, its guest list and everything else about it will be deleted) and **Mark handled**. Handled reports read "Handled". Keys under `Instance.reports.*`. The proxy's `/instance` check covers `/instance/reports`.
- [x] Docs: the `RATE_LIMIT_REPORT` row; in the operator section a paragraph **Reports**: the link on every event page, where reports go (the operator account's email with mail; the reports page always), and what the operator can do.
- [x] Unit tests: `parseReport`.
- [x] Browser tests (`e2e/reports.spec.ts`): a guest opens the footer link on a published event, sends a report with a contact, sees the thank-you; the operator (`OPERATOR`, signing in as `operator.setup.ts` does) sees it on `/instance/reports` with the title, the reason and the contact, and Mailpit has an email to the operator's address carrying the reason and the event's path (assert the path, not the host); the operator marks it handled; a second guest reports a second event, the operator deletes that event from the inbox, its link now shows not-found and the report reads "Event deleted"; a draft's page (seen by its host) has no report link; a reason of ten characters is refused; the sixth report from one client in a minute is refused as too fast.

## Notes for the implementer

- The operator's address for mail is the operator account's `user.email`, not `OPERATOR_CONTACT_EMAIL`.
- `removeEvents` (`src/events/repository.ts`) is the one removal; the operator's delete passes the event id without an owner.
- Commit subject, e.g. `Reports: a guest can report an event page to the operator`.

## Comments

**2026-10-09, implementing agent.** Done (commit c6b2151). `pnpm lint`, `pnpm typecheck`, `pnpm test` (542 passed, 66 files) green.

How it landed:
- `report` table, migration `0024_reports.sql`. `src/reports/`: `report.ts` (`parseReport`, `REASON_MIN/MAX`), `repository.ts` (`createReport`, `listReports`, `countUnhandledReports`, `markReportHandled`, `deleteEventAsOperator`, `reportableEventExists`), `notify-operator.ts`, `actions.ts` (`sendReportAction`, `markReportHandledAction`, `deleteReportedEventAction`). `operatorEmail()` added to `src/instance/repository.ts`; `removeEvents` is now exported from `src/events/repository.ts`.
- `/e/[slug]/report` (page and `report-form.tsx`); `PageFooter` takes `reportSlug`, which the event page passes for every state but draft (there is one footer for all three layouts). `/instance/reports` page, linked from `/instance` as "Reports (N)" (just "Reports" at zero). Proxy: `/e/<slug>/report` is not-found for a slug that is unknown (unknown, retired, or draft), and `/instance/reports` is covered by the operator check and the matcher.
- Rate limit `report` in config, config test, docs table, `.env.development`, Compose `app` and `deploy/.env.example`. Docs "Reports" paragraph under the operator section.

Decisions and things to know:
- Reports of an event are marked handled before `removeEvents` runs, not after: the delete sets `report.event_id` to null, so afterwards nothing finds them. A report whose event is gone also counts as handled in the inbox order and the unhandled count, whoever deleted the event (the host's own delete does not touch reports).
- The operator email is queued with the event id set; if the event is deleted before the worker sends it, the outbox row cascades away with it (existing schema behaviour).
- The reason textarea has no maxLength, so the "too long" refusal is reachable; the email field is `type=email`, so the browser refuses most bad addresses before the server's `contactInvalid` does.
- Report mail is always English (`getTranslations({ locale: "en" })`); the zh files carry translations of it only because `translations.test.ts` wants every key.
- Times in the inbox are shown in UTC with the zone name.

Left for later tickets or noted:
- Ticket 03: the report link (`/e/${slug}/report`), the operator mail's event link and the inbox's event link are built by hand from `event.slug`; move them to `eventPath(event)`. `reportableEventExists` in the proxy matches the random slug only (as `eventLinkExists` does), so a custom slug needs adding there.
- Ticket 09: Turnstile belongs on the report form (spec) and `sendReportAction`.
- Ticket 10 (retention): reports are not part of retention as written; a report outlives its event by design.

Evidence:
- RED: `vitest run src/reports` failed with the module missing before `report.ts` existed; GREEN: 6 passed. Mutation: `<` to `<=` on the minimum length made "wants a reason of at least 20 characters" fail; restored, 6 passed.
- Browser, Docker test profile (`up -d --build --wait` from the commit's tree, `CI=1`, 2 workers): `reports.spec.ts` 11 passed (mobile and desktop, the first run also exposed a race in my own helper, since `signIn` does not wait). Then `reports legal-and-analytics instance-settings accessibility reduced-motion rate-limits`: 75 passed in 7.1 minutes, including the accessibility and reduced-motion specs that open `/instance` after task 1's Limits card.

Chinese strings least sure of: `Report.errors.reasonTooShort` ("请再多写一点：至少 20 个字符。" / "請再多寫一點：至少 20 個字元。"), `Report.thanks` ("你的举报已经送达这个实例的运营者。"; "运营者" for operator, "實例營運者" in Hant), `Report.contactHint`, `Footer.report` ("举报这个活动" / "檢舉這個活動"), `Instance.reports.link` (plural folded to `other`: "举报（#）"), `Instance.reports.deleteText`.

**2026-10-09, implementing agent (review fix round 1).** Done. `pnpm lint`, `pnpm typecheck`, `pnpm test` (542 passed) green.
- Chinese `Instance.reports.link` gained `=0` branches; `deleteText` (Hans) says 宾客名单; `Report.errors.tooFast` reuses the files' usual line.
- `report_event_id_idx` added, migration `0025_report_event_index.sql`.
- `deleteEventAsOperator` selects the unhandled report ids, removes the event, then marks those ids handled.
- The CONTEXT.md citation is dropped from `report.ts`. Proposal for the maintainer: a CONTEXT.md entry "Report: a visitor's note to the operator that an event page does not belong on the instance".
- The rate-limit test reaches the report page by `goto(`${link}/report`)` after the first footer click.
- Evidence: Docker test profile rebuilt, `CI=1 reports.spec.ts --workers=2`: 11 passed.
