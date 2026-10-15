# Task 9 report: duplicate an event

Commit `1f3125f` Events: a host duplicates an event into a new draft with its look, questions, settings and picture.

Implemented: Storage.copy (disk, S3, smoke test); pure `duplicateInput(event, questions, locale, copySuffix)` with unit tests; `copyPicture` + `attachUploadCopy` (new upload id, files first, row and theme in one transaction, files removed on failure); `duplicateEventAction` (requireHost, findHostEvent, can duplicate; deletes the half-made draft on failure); manage page Duplicate button and `?from=` notice; en/zh-Hans/zh-Hant strings; `createEvent` accepts an optional theme (type widened, not a new parameter).

Tests: RED `pnpm exec vitest run src/events/duplicate.test.ts` (could not load ./duplicate), GREEN 5 passed. `pnpm lint` clean, `pnpm typecheck` clean, `pnpm test` 466 passed. `pnpm test:s3` 1 passed. Browser (production build, Compose dev profile): `e2e/duplicate.spec.ts` 4 passed; with events, uploads, questions, co-hosts: 63 passed, 2 desktop failures under 2 workers (questions removal-cost, uploads alt text) that passed on a 1-worker rerun. Server on 3000 stopped, symlinks removed, dev and s3 containers stopped.

Files: src/events/{duplicate.ts,duplicate.test.ts,actions.ts,repository.ts}, src/uploads/{copy.ts,repository.ts}, src/storage/{storage,disk,s3,s3.smoke}.ts, src/app/(host)/events/[id]/page.tsx, messages/*.json, e2e/duplicate.spec.ts.

Self-review: attachUploadCopy sets uploadId directly instead of applyChange, since applyChange would switch a curated-background theme to the picture. Concerns: no browser test of co-host duplication (role gate is `can`, unit covered elsewhere); Chinese suffix and spacing flagged for ticket 15.
