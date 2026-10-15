# 12: After 0.4: the small follow-ups the maintainer took from M3's hand-off

**What to build:** Five small items the maintainer decided on 2026-10-14 after reading M3's hand-off; none blocks the 0.4.0 release, so they ship in 0.4.1 or with the next milestone's first ticket. Each is a surgical change with its own pin.

**Blocked by:** nothing (M3 is complete at 72ce04f); runs after the 0.4.0 tag.

**Status:** done

- [x] `promoted_at` is cleared whenever a reply leaves Going (a guest's change to Maybe or Can't go, a host's edit, a withdrawal), in the same transaction as the status write; it is set only by a promotion, as today. Unit row in `src/rsvps/` wherever the status write's plan is pure; a browser assertion is not needed (nothing shows it) — say so in the comment.
- [x] No confetti on a self-promotion: when a guest lands on their own confirmation after being promoted (the "A place opened up" path, `promoted_at` newer than their last save), the effect does not fire; confetti stays for a Going reply the guest just made. Pinned in `e2e/reduced-motion.spec.ts`'s sibling or `capacity.spec.ts` by the absence of the canvas/effect node where the existing confetti test asserts its presence.
- [x] The capacity field's hint no longer says "limit" (`CONTEXT.md` keeps "limit" under Capacity's _Avoid_ for the operator's settings): `Events.form.capacityHint` (or its key) reads "Leave empty to take everyone." in all three languages; `events.spec.ts` or `capacity.spec.ts` reads the new line.
- [x] "Send it again"'s countdown is announced and reachable: the seconds live in an `aria-live="polite"` region (or the button's accessible description) and the button stays in the tab order while it waits (`aria-disabled`, not `disabled`, with the click a no-op), in all three layouts. `e2e/keyboard.spec.ts` tabs to it during the wait; `e2e/accessibility.spec.ts` reads the code step with the countdown running.
- [x] Phone-field rows: `e2e/accessibility.spec.ts`, `e2e/keyboard.spec.ts` and `e2e/locales.spec.ts` each gain one row where the host asks for a phone (Optional) and a guest gives one, in one layout each (Poster, Broadsheet, Thread across the three specs), with the host's row showing the number.

## Notes for the implementer

- The maintainer's decisions behind these are in `.superpowers/sdd/m3-control-plan/progress.md` (the entry dated 2026-10-14, "Maintainer's decisions"); the other seven answers there need no code.
- Read `.superpowers/sdd/m3-control-plan/implementer-context.md` first: the testing rules bind, two workers at most, `fuser -k` never `pkill -f 'next dev'`, never `docker compose down -v`.
- Commit subject, e.g. `After 0.4: promotions leave no stale mark, confetti is the guest's own, and the resend countdown is heard`.

## Comments

**2026-10-15, implementing agent (Opus, finishing the ticket).** Done. Commit 864ee51 by the Sonnet implementer, whose session died before it produced evidence or touched this ticket. My commit 89253a0 sits on top of it and fixes two of its browser rows; it changes no source. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 739 passed (74 files).

How it landed:
- `promoted_at` (864ee51, kept as is): `promotedSince(status, current)` in `src/rsvps/admission.ts`, beside `waitlistedSince`, keeps the mark while the status written is Going and returns null otherwise. `saveRsvp` writes it next to the admitted status in `placed`, used by both the update and the insert; a new RSVP has no current, so it gets null. `editRsvpAsHost` writes it next to the host's status (`hostStatus`). Both writes are in the same `.set` as the status, inside the event-locked transaction. `promoteWaitlist` and `moveToGoing` still set it to now, the only writers that do. A withdrawal deletes the row. Approve and decline need nothing, because they only write pending or declined replies, which were never promoted. Unit rows in `admission.test.ts`: kept while Going; taken off for Maybe, Can't go and waitlisted; none for a reply never promoted or a new one. **No browser assertion: nothing a host or guest sees shows `promoted_at`.**
- Confetti (864ee51's source kept; 89253a0 fixes its test): `confettiFor` (`src/themes/effects/trigger.ts`) no longer fires when the answer before was waitlisted. **The exact case:** a waitlisted guest at the front of the waitlist changes their answer, still Going, with a smaller party that now fits. `admit` keeps a waitlisted reply asking Going on the waitlist, `promoteWaitlist` promotes it in the same transaction, and the response shows "You’re going!". Under `admit`, a guest's own save can move a reply from waitlisted to Going only by a promotion. So comparing the answer before is the deferred note's "written status, not saved status" check: the written status is waitlisted, the saved one Going. Confetti still fires for a Going reply the guest has just made (a first reply, or from Maybe or Can't go). The same rule also holds back confetti for a guest promoted while away who saves again from a page still showing the waitlist. That fits "a promotion found on return does not"; returning to the page alone never fired it (confetti comes only with a save). `trigger.test.ts` gains "waitlisted to Going, a self-promotion" → false. Browser row: `e2e/broadsheet.spec.ts` "under the Confetti effect, no confetti falls when a waitlisted guest lowers their own party until it fits". Capacity is 2 with one place taken; Priya's party of two waits at number 1, then she comes alone and lands on "You’re going!". The spec's existing confetti row asserts presence for a Going save with the same node (`[data-effect="confetti"]`) after the same wait (the receipt's heading). 864ee51 slept half a second before counting, on the belief that the effect mounts a tick after the receipt. It mounts with it: `setFalls` is set in the same update as `setStep("done")`. 89253a0 therefore counts once when "You’re going!" shows, as the spec's Maybe case does.
- Capacity hint (864ee51, kept): `Events.form.guests.capacityHint` reads "…Maybe doesn’t count. Leave empty to take everyone. This instance takes up to…". zh-Hans: 留空则接纳所有人。 zh-Hant: 留空則接納所有人。 Neither has 限制 or 上限. `e2e/capacity.spec.ts` reads the line in the event form's Guests group, at the start of "the host's capacity moves the waitlist".
- Resend countdown (864ee51's source kept; 89253a0 fixes its accessibility row): `rsvp-flow.tsx`, `broadsheet-ballot.tsx` and `thread-composer.tsx` give "Send it again" `aria-disabled` instead of `disabled`, on the same conditions (a request in flight, the countdown, the bot check).
  - Its click returns early while held, and `aria-label` keeps its accessible name "Send it again" through the countdown.
  - Beside it is one `sr-only` `aria-live="polite"` span per code step, holding "Send it again in {n}s" while the countdown runs. It reuses the existing `code.resendIn` string, is updated each second with `resendIn`, and is emptied at 0.
  - The visible text is unchanged. The dimmed look moves to `aria-disabled:` variants: on the Broadsheet's `LINK`, which only "Send it again" and "Change email" use, and on the Thread's chip, as `BASE`'s `disabled:` look. Confirm and "Change email" behave as before.
  - `e2e/keyboard.spec.ts` "a guest tabs to the code step's Send it again while it waits, and pressing it sends nothing" (Poster, inline): the button reads `aria-disabled="true"`; Tab from the code field reaches it with a visible ring; Enter leaves the focus on it; the live region holds "Send it again in Ns"; one email arrived.
  - `e2e/accessibility.spec.ts` "the code step on the Poster with the resend countdown running": the attribute, the live region, then axe. 864ee51 also asserted `toBeEnabled()` there, but Playwright counts `aria-disabled="true"` as disabled, so the row failed at both widths. 89253a0 removes that line and leaves the tab order to the keyboard row.
- Phone rows (864ee51, kept). In each, the host asks for a phone (Optional), the guest gives "(02) 555-1234", and the host's guest list shows it under Going.
  - `e2e/accessibility.spec.ts`, Poster: the name step with the field and "Optional. Only the hosts see it.", the confirmation's "Phone: (02) 555-1234", and the host's list, each read by axe.
  - `e2e/keyboard.spec.ts`, Broadsheet: by keyboard alone, through to the focused "You’re going!" and its phone line.
  - `e2e/locales.spec.ts`, Thread in Simplified Chinese: the ask 再留个电话号码吗？…, the guest's bubble with the number, 只有我, the done bubble.

Decisions and things to know:
- The confetti row is in `broadsheet.spec.ts`, not in `effects.spec.ts` (reduced-motion's sibling) or `capacity.spec.ts` as this ticket suggested. The dispatch's ruling asks for "the spec where confetti's presence is already asserted for a Going save", which `broadsheet.spec.ts` is, and its absence check matches. I kept it there rather than moving it.
- "A place opened up": a guest who promotes themselves and gave an email is still queued that mail by `promoteWaitlist`, while they are on the page reading "You’re going!". Left as it is, by the maintainer's decision (confetti only). For the reviewer.
- I read "its accessible name unchanged" as unchanged through the countdown, so the seconds are only in the live region. The visible label "Send it again in 29s" begins with the name "Send it again", so saying "click Send it again" works; axe's `label-content-name-mismatch` rule is experimental and not run. For the reviewer (WCAG 2.5.3).
- The live region speaks every second for thirty seconds, as ruled. A screen reader user who stays on the step hears it count.
- The click guard matters for the request in flight and the bot check. While the countdown runs, the hook's `send` already returns to the code step without a request. So the keyboard row's one-email check holds either way; the pin is the tab stop (mutation M2 below).
- 864ee51 did nothing beyond the five boxes. Both commits carry the session's `Claude-Session:` line after `Co-Authored-By`, as M3's commits do.

Left for later tickets or noted:
- For the maintainer: `Events.form.errors.capacityInvalid` still ends "…or leave it empty for no limit." (zh 不设上限 / 不設上限), and the Chinese field label is 人数上限 / 人數上限. Code comments still say "no limit" at `e2e/capacity.spec.ts:35`, `e2e/events.ts:19` and `src/app/(host)/events/event-form.tsx:128`. The box named only the hint, so these are unchanged.

Evidence:
- 864ee51's new rows against a Docker test profile built from 864ee51 (`CI=1`, 2 workers, both widths): 13 passed, 2 failed. The failures were the accessibility countdown row at `toBeEnabled()` (`accessibility.spec.ts:689`), at both widths.
- Unit mutations (each applied, the file run, the source restored and its SHA-256 compared): 3 tried, 3 caught.
  - `promotedSince` returning the mark whatever the status → "takes the mark off a reply that leaves Going" failed.
  - `promotedSince` always null → "keeps the mark of a promoted reply that stays Going" failed.
  - `confettiFor` without the waitlisted guard → "waitlisted to Going, a self-promotion" failed.
- RED in place for boxes 2–4: the three layouts' code steps, `trigger.ts` and `messages/en.json` reverted to 72ce04f; `app` rebuilt; 2 workers, both widths, without CI. 8 of 8 failed:
  - `broadsheet.spec.ts:294`: confetti count expected 0, received 1.
  - `capacity.spec.ts:197`: the hint not found.
  - `keyboard.spec.ts:251` and `accessibility.spec.ts:689`: no button named exactly "Send it again" (its name carried the seconds).
  - Restored; hashes matched.
- Mutation M2: `disabled` put back on the Poster's button beside `aria-disabled`; `app` rebuilt. The keyboard row failed at both widths at `tabTo(page, again)` (`:252`): Tab ran past the end of the page ("nothing has the focus"). The accessibility row passed, since it does not pin the tab order. Restored; hashes matched.
- Box 1 has no browser RED (nothing shows the mark). Box 5 changes no source: its rows pin behaviour that already worked, so there is GREEN only.
- GREEN, Docker test profile rebuilt from the final tree, `CI=1`: the seven new or changed rows at both widths, 15 passed (with the operator setup). Committed 89253a0 after this.
- Definitive run, Docker test profile rebuilt from 89253a0 after the Docker daemon restarted (`up -d --build --wait`, no credentials workaround needed), `CI=1`, 2 workers, both widths, exact paths, each count including the operator setup:
  - `keyboard accessibility reduced-motion`: 85 (20, 42, 6).
  - `locales rsvp broadsheet thread`: 65 (16, 16, 14, 14).
  - `capacity email-code contact-details events effects turnstile`: 89 (20, 10, 10, 22, 6, 20).
  - None flaky, none failed. The watch list passed first time at both widths: `capacity.spec.ts:172` (in the test at `:136`), `accessibility.spec.ts:115`, `reduced-motion.spec.ts:34`.
  - Before the daemon restart, `capacity email-code contact-details events` had also passed, 63, on a stack built from the same tree.

Chinese strings least sure of: the capacity hint's 留空则接纳所有人。/ 留空則接納所有人。 接纳 renders "take" and reads a little formal; 留空则所有人都能参加 / 留空則所有人都能參加 is a plainer alternative. No other new strings: the live region reuses `code.resendIn`.

**2026-10-15, implementing agent (fix round 1).** Done. Commit 4fd1392, on top of 89253a0. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 739 passed (74 files).

1. Revised ruling, the countdown's announcements. The seconds no longer go into a live region every second.
   - **The hook** (`use-rsvp-flow.ts`) keeps `waitFrom`: the seconds "Send it again" had left when the guest came to the code step. It is set in three places: in `send` with a sent code's `resendIn`, in `send`'s path back to the code step, and in `forward` into the code step. From it the hook derives `resendNotice`: nothing off the code step; `{ waitFor: waitFrom }` while the countdown runs; `"now"` once it reaches 0. It is derived, not set in an effect: React's `set-state-in-effect` lint rule refuses an effect that fills it, and a derived value needs none.
   - **The button**, in each layout: the visible "Send it again in {n}s" sits in a span with an id (the Poster's and the Broadsheet's `${id}-resend-in`, the Thread's own `useId`). While it counts, the button's `aria-describedby` points at that span, so a guest who reaches the button hears the seconds left. `aria-disabled`, the no-op click, the name "Send it again", Confirm and "Change email" are unchanged.
   - **The region** (`aria-live="polite"`, `sr-only`) now sits outside the code step, in a container already on the page before the code step comes: the Poster's stepper form, the Broadsheet's answering section, the Thread's composer bar. Words a live region appears with are not read out, which is why it moved.
   - **What it says:** it is empty except on the code step. It speaks when the guest comes to the step, with the seconds left then (30 for a new code), and at 0. In between its words stay as they are, so nothing new is read. Coming back to the step mid-wait (Change email, then Continue without changing it) says the seconds left at that moment; coming back after the wait says "now".
   - **The two new strings:** `Rsvp.code.resendLater` "You can send another code in {seconds, plural, one {# second} other {# seconds}}." The plural is there because a "too soon" reply can leave one second. `Rsvp.code.resendNow` "You can send it again now."
   - **The Poster's accessibility row** (now "…, and once it has run out", `:688`) checks, in order:
     - the button reads `aria-disabled="true"`;
     - the region reads "You can send another code in 30 seconds.";
     - no live region holds "Send it again in";
     - axe passes;
     - a second later the button has changed and the region has not;
     - the countdown runs out, waited for on the button's own text (`toHaveText("Send it again", { timeout: 40_000 })`, as `email-code.spec.ts` waits, no sleep);
     - then `aria-disabled="false"` and the region reads "You can send it again now."

     So the end text is pinned inside the row, at the cost of about thirty seconds per width.
2. The Broadsheet's and Thread's countdowns are pinned. In the code-step loop (`accessibility.spec.ts:659`), after the Code field has the focus, each layout checks that "Send it again" reads `aria-disabled="true"` and that one polite region holds "You can send another code in 30 seconds."
3. "Limit" beside the hint. `Events.form.errors.capacityInvalid` now ends "…or leave it empty to take everyone." (English only; 不设上限 and 人数上限 stay). The comments the ruling named now say "take everyone" or "no capacity": `e2e/capacity.spec.ts:33-34`, `e2e/events.ts:19`, `src/app/(host)/events/event-form.tsx:128`. Two more said the same about a capacity and are changed too, since CONTEXT.md's words apply in tests as well: the comment at `e2e/capacity.spec.ts:228` ("Removed: no capacity, …") and the unit title at `src/rsvps/waitlist.test.ts:25` ("promotes everyone when there is no capacity"). `src/auth/auth.ts:22`'s "no limit" is about rate limits and stays.
4. The keyboard row (`keyboard.spec.ts:236`) reaches the button with one Tab press. It then checks `toBeFocused`, the visible ring (`expectVisibleFocus`, which `tabTo` used to check at each stop), and `toHaveAccessibleDescription(/^Send it again in \d+s$/)`. The "sends nothing" poll is as it was.

Not in this round, as ruled: the self-promotion mail stays; "29s" stays. The hint's Chinese is the maintainer's choice: 留空则接纳所有人 / 留空則接納所有人 (committed) or 留空则所有人都能参加 / 留空則所有人都能參加.

Evidence:
- RED: the changed rows against the stack built from 89253a0, before any source change; 2 workers, both widths, without CI. 10 of 10 failed:
  - the loop at `:670` (the region's first words) in all three layouts, after `:669` (`aria-disabled`) had passed in each;
  - the Poster's row at `:697` (the region's first words);
  - the keyboard row at `:256` (the description), after the single Tab had reached the button.
- Mutation: the Broadsheet's `aria-disabled` replaced by `disabled`, `app` rebuilt. The loop's Broadsheet iteration failed at `:669` at both widths (`aria-disabled` received ""); the Poster and Thread iterations passed (5 with the operator setup). Restored from a copy; SHA-256 matched.
- GREEN: the Docker test profile rebuilt from the tree, `CI=1`. The loop in three layouts, the Poster's row and the keyboard row at both widths: 11 passed with the setup. Committed 4fd1392 after this.
- Long run: the Docker test profile rebuilt from 4fd1392, `CI=1`, 2 workers, both widths, `accessibility keyboard email-code rsvp broadsheet thread capacity`: 153 passed (42, 20, 10, 16, 14, 14, 20, the operator setup 1) in 18.7 minutes. None flaky, none failed. The known intermittent Thread-pill contrast row did not show.

Chinese for the two new strings, for the maintainer:
- `Rsvp.code.resendLater`: zh-Hans "{seconds, plural, other {# 秒}}后可以重新发送验证码。"; zh-Hant "{seconds, plural, other {# 秒}}後可以重新寄送驗證碼。"
- `Rsvp.code.resendNow`: zh-Hans "现在可以重新发送了。"; zh-Hant "現在可以重新寄送了。"
- Both follow the button's 重新发送 / 重新寄送 and the code step's 验证码 / 驗證碼.
