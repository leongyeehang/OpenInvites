# 01: Operator limits

**What to build:** Two limits the operator sets on the instance settings page: how many events a host may have and how many replies an event may take. A host or guest at a limit is refused with a plain sentence. Nothing else changes.

**Blocked by:** nothing

**Status:** done

- [x] Schema: `instance_settings` gains `max_events_per_host integer not null default 50` and `max_rsvps_per_event integer not null default 500`. Migration 0023; the one existing row takes the defaults.
- [x] `src/instance/limits.ts` (pure, unit tested): `DEFAULT_LIMITS = { maxEventsPerHost: 50, maxRsvpsPerEvent: 500 }`, `LIMIT_MIN = 1`, `LIMIT_MAX = 100000`, `parseLimits(fields: { maxEventsPerHost: string; maxRsvpsPerEvent: string })` returning the limits or the field that is wrong (not an integer, or outside the range). `src/instance/repository.ts`: `instanceLimits()` (cached per request, as `registrationMode()` is) and `setInstanceLimits(limits)`.
- [x] `/instance` gains a **Limits** card between Registration and Host invitations: two number fields, "Events per host" (hint: "Counts every event a host owns, drafts and past events included.") and "Replies per event" (hint: "Counts every reply to an event, whatever its answer."), a Save button and "Saved." on success, in the shape of the registration form (`instance-forms.tsx`). Action `setInstanceLimitsAction` in `src/instance/actions.ts`, behind `requireOperator()`. Keys under `Instance.limits.*`.
- [x] Events per host: `createEventAction` and `duplicateEventAction` (`src/events/actions.ts`) count the events the host owns (`event.host_id`, any state; co-hosted events do not count) and refuse at the limit with `Events.errors.limitReached`: "You have {count} events, the most this instance allows. Delete an event you no longer need to make another." The new-event page shows it as a `FormOutcome`; the manage page shows it beside Duplicate. The dashboard replaces its New event button with the same sentence when the host is at the limit.
- [x] Replies per event: `saveRsvpAction` refuses a reply that would be new on this device when the event already has `maxRsvpsPerEvent` RSVPs in any status, with the refusal `limitReached` (`RsvpRefusal` gains it; `Rsvp.errors.limitReached`: "This event can't take more replies."). The check sits after the rate limit and the `closed` check. A guest who already has a reply on the device can still edit and withdraw it. Task 6 moves this check into its transaction; keep it a small function it can call.
- [x] Docs: `docs/operator/configuration.md`, section "The operator, registration, and host invitations", gains a paragraph **Limits**: the two limits, their defaults, what each counts, where they are set, and that they take effect at once.
- [x] Playwright: a new project `limits-instance` in `playwright.config.ts` (desktop viewport, `baseURL: http://localhost:3002`, `testMatch: /limits\.spec\.ts/`, `dependencies: ["fresh-instance"]`), so the spec runs after the fresh-instance specs and alone on `app-fresh`; the `mobile` and `desktop` projects ignore it as they ignore the fresh-instance specs.
- [x] Unit tests: `parseLimits` (the bounds, a decimal, a blank, letters).
- [x] Browser tests (`e2e/limits.spec.ts`, serial, recreating `app-fresh` and `db-fresh` first as `registration.spec.ts` does): the first account signs up and verifies (it is the operator), sets events per host to 2 and replies per event to 2, sees "Saved."; creates two events; the third is refused with the sentence on the new-event page and the dashboard shows the sentence in place of the button; Duplicate on an event is refused with the same; the operator publishes one event, two guests (two browser contexts) reply, a third guest is refused with "This event can't take more replies.", and the first guest changes their answer to Maybe without refusal.

## Notes for the implementer

- `registrationMode()` and `isOperator()` in `src/instance/repository.ts` show the cached read pattern; `setRegistrationModeAction` shows the action and form pattern (`useActionState`, "Saved.").
- Events owned: `event.host_id = $1`, not `hostedBy` (which includes co-hosted events).
- Commit subject, e.g. `Instance: the operator limits events per host and replies per event`.

## Comments

**2026-10-09, implementing agent.** Done (commit 7041b69). `pnpm lint`, `pnpm typecheck`, `pnpm test` (534 passed, 65 files) green.

How it landed:
- `src/instance/limits.ts` (`DEFAULT_LIMITS`, `LIMIT_MIN/MAX`, `parseLimits`, plus a one-line `atLimit(count, limit)`), tested in `limits.test.ts`. Migration `0023_operator_limits.sql` (columns with defaults, so the one row takes them). `instanceLimits()` (cached) and `setInstanceLimits()` in the repository; `setInstanceLimitsAction` behind `requireOperator()`; `LimitsForm` and the card between Registration and Host invitations.
- Events: `src/events/limit.ts` `eventsOwnedAtLimit(hostId)` (returns the count when at the limit) used by `createEventAction`, `duplicateEventAction` and the dashboard; `countOwnedEvents` counts `event.host_id`. `duplicateEventAction` now returns a `FormState` and is driven by a client `DuplicateButton` (`src/app/(host)/events/duplicate-button.tsx`), which shows the refusal beside the button after a click.
- Replies: `countEventRsvps(eventId, db = getDb())` in `src/rsvps/repository.ts` and `repliesAtLimit` in `saveRsvpAction`, after rate limit, closed, parsing and the device lookup; `RsvpRefusal` gains `limitReached`. All three layouts show it through `errors.${refusal}`.
- Docs paragraph added; `limits-instance` Playwright project added.

Decisions and things to know:
- The `Save` button of the Limits form is a second "Save" on `/instance`, so `e2e/operator.setup.ts` and `e2e/registration.spec.ts` now scope their click to the Registration form.
- `LIMITS_INSTANCE` is `/(^|\/)limits\.spec\.ts$/`: the first draft `/limits\.spec\.ts/` also matched `rate-limits.spec.ts`.
- English uses the curly apostrophe ("can’t") like the rest of `en.json`; the spec matches `can.t`.
- The events sentence uses ICU plural (`# event`/`# events`), since a limit of 1 is allowed; Chinese folded to `other`.
- The reply check sits after parsing and the device lookup (it needs `mine`), not directly after `closed`; a malformed answer is therefore reported before the limit.
- The duplicate refusal appears after clicking, not before.

Left for later tickets or noted:
- Ticket 06: move `repliesAtLimit`/`countEventRsvps` into the admit transaction (it takes a `db` argument for that); the check is racy until then (two guests at count limit-1 may both pass).
- Ticket 06: the host's capacity field should hint the instance's reply limit (`instanceLimits().maxRsvpsPerEvent`).
- Ticket 10/others adding `/instance` cards: any new "Save" button needs the same form scoping in the two specs above.

Evidence:
- RED: `vitest run src/instance/limits.test.ts` failed with the module missing before `limits.ts` existed; GREEN: 8 passed. Mutation: allowing `.` in the digit regex made "refuses a decimal, a blank and letters" fail; restored, 8 passed.
- Browser, Docker test profile (`up -d --build --wait`, `CI=1`, 2 workers): `--project=limits-instance` 16 passed (the 12 fresh-instance tests including `registration.spec.ts`, plus 4 in `limits.spec.ts`); `rsvp.spec.ts events.spec.ts instance-settings.spec.ts duplicate.spec.ts` on `app`, 49 passed (mobile and desktop).

Chinese strings least sure of: `Instance.limits.description` ("一位主办人或一场活动最多能容纳的数量。更改立即生效，已有的内容保持不变。" / 主辦人…), `Events.errors.limitReached` and `Host.dashboard.limitReached` ("你已有 {count} 场活动，这是本实例允许的上限。…"; "实例" for instance follows existing strings), `Rsvp.errors.limitReached` ("这场活动无法再接受更多回复了。" / "這場活動無法再接受更多回覆了。"), and the field labels "每位主办人的活动数" / "每场活动的回复数".
