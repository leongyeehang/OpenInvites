# 05: The invitation is the editor

**What to build:** New event opens a blank invitation at `/events/[id]`, edited in place: the title typed on it, When, Where and About filled from small sheets, every change saved as it is made, Preview and Publish in the top bar. The 0.4 form and manage page go.

**Blocked by:** 03 The poster-first guest page

**Status:** ready-for-agent

- [ ] Migration: `event.starts_at` nullable, check `state = 'draft' OR starts_at IS NOT NULL` (ticket 09 widens it for polls). Every reader of `startsAt` handles null: dashboard ("No date yet", sorted last among drafts), reminders, retention, calendar files and links, preview card, duplicate, the RSVP and comment mail. Types follow.
- [ ] `/events/new` (verified host): creates a draft with an empty title, no date, the default poster look, and redirects to `/events/[id]`. Operator limits (events per host) apply here as they do today.
- [ ] `/events/[id]`: the guest page's Poster layout in edit mode (spec, "The editor"). Title: `contenteditable="plaintext-only"`, role textbox, name "Event title", placeholder "Untitled event", Enter ends, paste is plain text, saved debounced 600 ms. When, Where, About: buttons in the details list with placeholders ("Set a date and time", "Add a place", "Say what to expect") opening sheets; the date sheet keeps 0.4's time zone defaulting and all-day rule; About uses 0.4's rich-text editor.
- [ ] Top bar: close (to the dashboard), "Draft · Saved" / "Live · Saved" with "Saving…" and a retry line on failure, Preview (the guest view, with "Back to editing"), Publish or Share, and a More menu: Guests, Share, Hosts, Invites, Announcements, Duplicate, Cancel event, Delete event, each going where the 0.4 manage page linked. Co-hosts get the same menu minus what is the owner's (`hosts/role.ts`).
- [ ] Publish refuses without a title or a date with "Add a title first." / "Add a date first." and puts focus on what is missing; success opens the share sheet (link, Copy, See it as a guest).
- [ ] Until ticket 06 the toolbar holds one Design button opening the 0.4 drawer; until ticket 07 a Settings button opens the 0.4 form's remaining fields in a sheet. Delete `event-form.tsx` once nothing uses it.
- [ ] `e2e/events.ts`: `createDraft` and friends drive the editor; every spec that used the form passes through them.
- [ ] Unit tests: the publish check; null-date handling in the reminder and retention planners. Browser: New event → type title → set date → add place → publish, without a form; publish refused for each missing piece; autosave survives a reload mid-edit; the retry line on a failed save (server returns an error); a co-host's menu; keyboard and accessibility rows for the editor at both widths.

## Notes for the implementer

- Next.js in this repo is newer than training data: read `node_modules/next/dist/docs/` on server actions and `redirect` before writing them.
- Commit subject, e.g. `Editor: a new event opens as its invitation, edited in place`.
