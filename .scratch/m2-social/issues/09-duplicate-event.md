# 09: Duplicate an event

**What to build:** "Duplicate" on the manage page makes a new draft with the same details, look, questions, settings and picture, owned by the host who clicks, and opens it.

**Blocked by:** 05 Co-hosts (the `duplicate` action and the role gate)

**Status:** done

- [x] `Storage` (`src/storage/storage.ts`) gains `copy(fromKey, toKey)`, implemented for disk (a file copy) and S3 (a server-side copy), and covered by the S3 smoke test (`pnpm test:s3`) alongside put and get.
- [x] `src/events/duplicate.ts`: `duplicateInput(event, questions, locale)` is the pure part, unit tested: title with the localised "(copy)" appended (`Events.duplicate.copySuffix`), times, zone, all-day, location, both descriptions, theme (with `uploadId` to be replaced by the new upload's id when there is one), questions in order with their options and required flags, and every per-event setting (`plusOnesAllowed`, `requirePlusOneNames`, `askEmail`, `guestListVisibility`, `commentsEnabled`, `remindersEnabled`, `notifyOnRsvp`, `notifyOnComment`). Not copied: state (draft), slug (new), RSVPs, answers, comments, announcements, co-hosts, views, reminder marks, `publishedAt`.
- [x] The action: creates the event, saves the questions, and when the source has an upload, copies every rendition under a new upload id and inserts the upload row with the same sample and alt text, then points the new theme's `uploadId` at it. Files are copied before the row that names them, as `uploadPicture` does; on failure the copied files are removed.
- [x] The manage page's buttons row gains "Duplicate" (allowed for owner and co-host by `can`), which lands on the new draft's manage page with a notice "Duplicated from {title}".
- [x] Browser test (extend `e2e/events.spec.ts` or new `e2e/duplicate.spec.ts`): an event with a question, a setting changed from its default, and an uploaded picture is duplicated; the new draft's form shows the same values and the question; its event page (as the host) shows the picture; the source's RSVPs are not on the copy's guest list; the copy's link differs.

## Notes for the implementer

- `createEvent` and `saveQuestions` exist; the upload copy is new and belongs in `src/uploads/`.
- Commit subject, e.g. `Events: a host duplicates an event into a new draft with its look, questions, settings and picture`.

## Comments

**2026-10-08, implementing agent.** Done. `pnpm lint`, `pnpm typecheck` and `pnpm test` (466 passed) pass; `pnpm test:s3` passes with copy; browser specs pass on a production build. Commit `1f3125f`.

How it landed:
- `Storage.copy(fromKey, toKey)`: `copyFile` on disk, `copyObject` on S3; the smoke test copies, reads back both keys, deletes.
- `src/events/duplicate.ts`: `duplicateInput(event, questions, locale, copySuffix)` (the suffix is passed in so it stays pure; title is `"<title> <suffix>"`). Returns `{ event, questions }`; the theme comes back with `uploadId: null`.
- `src/uploads/copy.ts` `copyPicture` and `attachUploadCopy` in the uploads repository: files copied under a new id, then one transaction inserts the row (same sample and alt text) and sets the new theme's `uploadId` directly. It deliberately does not use `applyChange`/`replaceUpload`, which would switch a theme with a curated background over to the picture.
- `duplicateEventAction` in `events/actions.ts`; `createEvent` now takes an optional `theme`. Manage page: a "Duplicate" button (outline, beside Publish, `can(role, "duplicate")`) and a `role="status"` notice from `?from=<id>`, looked up through `findHostEvent` so another host's id shows nothing.

Decisions and things to know:
- On failure after the event exists, the action deletes the half-made draft (which also removes any copied files) and rethrows.
- Chinese suffix is "（副本）" in both scripts, joined to the title with an ASCII space.

Left for later tickets or noted:
- Ticket 10: `event.views` is not copied, and a new event starts at zero; nothing to do in duplicate.
- Ticket 15, strings least sure of: `Events.duplicate.copySuffix` "（副本）" and the space before it; zh `manage.duplicate` 复制活动 / 複製活動 (vs 复制 / 複製); `manage.duplicatedFrom` 复制自“{title}” / 複製自「{title}」; `manage.duplicateHint`.
- Any new event field must be added to `duplicateInput` (and its test) to be copied.

Evidence:
- RED: `pnpm exec vitest run src/events/duplicate.test.ts` failed to load `./duplicate`; GREEN: 5 passed.
- S3: `docker compose --profile s3 up -d --wait && pnpm test:s3` 1 passed (then `--profile s3 stop`).
- Browser, production-build loop: `e2e/duplicate.spec.ts` 4 passed (+ operator setup); with events, uploads, questions and co-hosts specs 63 passed, 2 desktop failures under two workers (questions "removing a question...", uploads "describes the picture") that pass on rerun alone with one worker (5 passed).
