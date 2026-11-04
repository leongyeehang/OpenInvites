# 05: The invitation is the editor

**What to build:** New event opens a blank invitation at `/events/[id]`, edited in place: the title typed on it, When, Where and About filled from small sheets, every change saved as it is made, Preview and Publish in the top bar. The 0.4 form and manage page go.

**Blocked by:** 03 The poster-first guest page

**Status:** done

- [x] Migration: `event.starts_at` nullable, check `state = 'draft' OR starts_at IS NOT NULL` (ticket 09 widens it for polls). Every reader of `startsAt` handles null: dashboard ("No date yet", sorted last among drafts), reminders, retention, calendar files and links, preview card, duplicate, the RSVP and comment mail. Types follow.
- [x] `/events/new` (verified host): creates a draft with an empty title, no date, the default poster look, and redirects to `/events/[id]`. Operator limits (events per host) apply here as they do today.
- [x] `/events/[id]`: the guest page's Poster layout in edit mode (spec, "The editor"). Title: `contenteditable="plaintext-only"`, role textbox, name "Event title", placeholder "Untitled event", Enter ends, paste is plain text, saved debounced 600 ms. When, Where, About: buttons in the details list with placeholders ("Set a date and time", "Add a place", "Say what to expect") opening sheets; the date sheet keeps 0.4's time zone defaulting and all-day rule; About uses 0.4's rich-text editor.
- [x] Top bar: close (to the dashboard), "Draft · Saved" / "Live · Saved" with "Saving…" and a retry line on failure, Preview (the guest view, with "Back to editing"), Publish or Share, and a More menu: Guests, Share, Hosts, Invites, Announcements, Duplicate, Cancel event, Delete event, each going where the 0.4 manage page linked. Co-hosts get the same menu minus what is the owner's (`hosts/role.ts`).
- [x] Publish refuses without a title or a date with "Add a title first." / "Add a date first." and puts focus on what is missing; success opens the share sheet (link, Copy, See it as a guest).
- [x] Until ticket 06 the toolbar holds one Design button opening the 0.4 drawer; until ticket 07 a Settings button opens the 0.4 form's remaining fields in a sheet. Delete `event-form.tsx` once nothing uses it.
- [x] `e2e/events.ts`: `createDraft` and friends drive the editor; every spec that used the form passes through them.
- [x] Unit tests: the publish check; null-date handling in the reminder and retention planners. Browser: New event → type title → set date → add place → publish, without a form; publish refused for each missing piece; autosave survives a reload mid-edit; the retry line on a failed save (server returns an error); a co-host's menu; keyboard and accessibility rows for the editor at both widths.

## Notes for the implementer

- Next.js in this repo is newer than training data: read `node_modules/next/dist/docs/` on server actions and `redirect` before writing them.
- Commit subject, e.g. `Editor: a new event opens as its invitation, edited in place`.

## Comments

**2026-11-03, implementing agent (Opus, in the maintainer's session).** Done in `676b6a9`, with the follow-ups below in the ticket 06 commit.

- `drizzle/0036_draft_without_date.sql`: `starts_at` nullable for drafts; `Dated`, `MaybeDated` and `isDated` (`events/time.ts`) carry it through the readers.
- `/events/new` makes the empty draft and opens `/events/[id]`, the Poster layout in edit mode: the title typed on it (`editable-title.tsx`), When, Where and About from sheets (`details.tsx`), each piece saved on its own (`events/editor-actions.ts`), the status pill counting saves (`data-saves`, which the tests wait on).
- Top bar (`top-bar.tsx`): close, the status, Preview, Publish or Share, and More with the 0.4 manage page's links and actions; a co-host gets a badge and the menu without the owner's actions.
- Publish refuses a missing title or date and focuses it; success opens the share page.
- `e2e/events.ts` drives the editor (`createDraft`, `typeTitle`, `setWhen`, `editSettings`, `openMore`, `publishInEditor`, `savedAfter`, `toEditor`).

Follow-ups found by the first browser run (499 passed, 36 failed), fixed since: specs reading Announcements, Invites, Hosts and the custom link open More first; settings reads open Settings; the top bar no longer overflows at 390 px (the status shrinks, and an empty question is not sent, so it cannot fail a save); the editor has the page footer; the co-host badge is in the banner. Two more found by the run below: the editor's links to the guest page (Preview, "See it as a guest") no longer prefetch it, since every request to an event link counts against its rate limit (`comments.spec.ts`'s 31st-comment row ran out of allowance at 29); and a sheet gives the focus back to whatever opened it (Radix gives it back only to a `Dialog.Trigger`).

**2026-11-03, the browser run.** `docker compose --profile test up -d --build --wait` from the working tree of tickets 03, 05, 06 and 07 together, then `CI=1 pnpm exec playwright test --workers=2`, every project: **538 passed, 2 failed, 1 flaky** in 59.9 min. The two failures were one row of `rsvp-sheet.spec.ts` still measuring the guest page's Design button, which ticket 06 removed; rewritten, the file passes (11 of 11). The flaky row, `accessibility.spec.ts:451` (dark tone), once saw a page with no `<title>` just after a comment was posted and passed on retry; repeated three times each tone, it passed every time. `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 796 passed (75 files).
