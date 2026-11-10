# 08: Videos: a worker container for the processing

**What to build:** An operator can move the processing to a second container from the same image: the app then only queues, the worker processes, and the Storage card says which is at work and when the worker was last seen.

**Blocked by:** 06 Videos: the upload protocol, the queue and the processing

**Status:** done

- [x] `src/instance/env.ts`: `videoProcessingMode(): "app" | "worker"` from `VIDEO_PROCESSING` (default `app`, anything else refused at start as the rate limits are, `checkRateLimitsAtStart`'s pattern), and `videoRole(): "app" | "worker"` from `VIDEO_ROLE` (default `app`). Unit tests beside `env.test.ts`.
- [x] Migration `0050_worker_heartbeat`: `instance_settings.video_worker_seen_at timestamptz`.
- [x] `src/instrumentation.ts`: with `videoRole() === "worker"` the container runs migrations (safe under the advisory lock), the start checks, and then only the video queue: `startVideoQueue()` with an immediate kick, and a heartbeat every minute writing `video_worker_seen_at = now()`; it does not start the mail worker. With `videoRole() === "app"` and `videoProcessingMode() === "worker"`, the app does not start the queue and `kickVideoQueue()` is a no-op there; the worker's minute tick picks the job up. **(plan ruling 18.)**
- [x] `scripts/video-worker.mjs`: a launcher, not a program: sets `process.env.VIDEO_ROLE = "worker"` and `await import("../server.js")` (the standalone server does `process.chdir(__dirname)`, so the import from `/app/scripts` works). Its comment says why: the image has no TypeScript toolchain and the S3 client is bundled into the server, so the worker is the same server in a worker role, listening on its port unpublished, which also gives it the health check.
- [x] `deploy/compose.yaml`: a commented-out `worker` service beside `app` (same image, `env_file`, `environment: VIDEO_ROLE: worker`, `command: ["node", "scripts/video-worker.mjs"]`, no `ports`, the `uploads` volume on local disk) with a comment saying to set `VIDEO_PROCESSING=worker` on `app`; `deploy/.env.example` gains `# VIDEO_PROCESSING=app`.
- [x] The Storage card (ticket 03): "Videos are processed by this site's app" (mode `app`), "…by the worker container, last seen {time}" (mode `worker` with a heartbeat; `getFormatter().relativeTime`), or "…by a worker container, which has not reported yet: check it is running" (mode `worker`, no heartbeat or one older than five minutes). Keys `Instance.storage.processedBy{App,Worker,WorkerMissing}`.
- [x] Test profile: `compose.yaml` gives `app-fresh` `VIDEO_PROCESSING: worker` and adds `worker-fresh` (same `build: .`, `db-fresh`, the same environment as `app-fresh` plus `VIDEO_ROLE: worker`, `command: ["node", "scripts/video-worker.mjs"]`, no port); `ci.yml:83` dumps its logs too. `playwright.config.ts`: a `worker-instance` project (`testMatch: /(^|\/)worker\.spec\.ts$/`, baseURL 3002, in the serial chain after `home-instance`, ignored by mobile and desktop); `e2e/worker.spec.ts` recreates `db-fresh`, `app-fresh`, `worker-fresh` (`e2e/instances.ts:4-9`), signs up a host, publishes a past-dated event, adds `clip-h264.mp4` through the picker, and sees the tile ready within 90 s (processed by the worker); Site settings' Storage card says "by the worker container, last seen …". The other instance projects on `app-fresh` upload photos only, which need no queue.
- [x] Docs, briefly (ticket 11 completes): `docs/operator/configuration.md` gains a `VIDEO_PROCESSING` row and a paragraph on the worker in the Storage subsection.

## Notes for the implementer

- Two containers never process one job twice: the lease is a single `UPDATE … FOR UPDATE SKIP LOCKED` (ticket 06).
- Commit subject, e.g. `Videos: a worker container can take the processing`.

## Comments

**2026-11-09, implementing session (native).** Done. `videoProcessingMode()` reads `VIDEO_PROCESSING` (`app` or `worker`, anything else refused at start beside the other checks), `videoRole()` reads `VIDEO_ROLE`, and `processesVideosHere()` says whether this process takes jobs: the app does unless the processing was moved, the worker always; `startVideoQueue` starts nothing and `kickVideoQueue` does nothing where it is false. The worker role in `instrumentation.ts` runs the migrations and the start checks, then only the queue, with an immediate first round and a heartbeat every minute into `instance_settings.video_worker_seen_at` (migration 0051); it does not adopt the old upload limit, promote the operator, start the mail worker or measure. `scripts/video-worker.mjs` sets the role and imports the standalone server, which the image already copies under `/app/scripts`. The Storage card's new line (`videoProcessor`, pure and tested, five minutes stale) says the app, the worker with when it was last seen, or a worker not yet heard from; shown under the ffmpeg line when ffmpeg is available. `deploy/compose.yaml` carries the worker service commented out, `deploy/.env.example` the setting, `docs/operator/configuration.md` a row and a paragraph. The test profile gives `app-fresh` `VIDEO_PROCESSING: worker`, a `worker-fresh` service in the worker role, and a shared `uploads-fresh` volume so the two see the same files on local disk; the `worker-instance` project runs `e2e/worker.spec.ts` after `home-instance`; CI dumps the worker's logs.

How it landed:
- Ruling: the migration is `0051_worker_heartbeat`, not the ticket's 0050, which ticket 06's batch column took. Cost if wrong: none.
- Ruling: the processed-by line shows only when ffmpeg is available; without ffmpeg the card already says videos are refused, and who would process them is moot. Cost if wrong: an operator who set worker mode on a server without ffmpeg misses one line.
- The test profile's `app-fresh` and `worker-fresh` share a named volume `uploads-fresh`, which the ticket did not list: on local disk the worker reads the clip as sent and writes what it becomes where the app serves them from.
- The worker spec signs up the instance's first account (the operator), publishes a past-dated event, has a guest add the H.264 clip from the picker, waits for the tile (the app's kick is a no-op; the worker's minute takes it), then opens Site settings and reads the worker line.

Things to know:
- Recreating `db-fresh` without `worker-fresh` (as the other instance specs do) leaves the worker ticking against an empty database until `app-fresh` has migrated it; its errors are logged and the next minute goes on. Those specs add photos only.
- The worker listens on its port inside the network, unpublished, which gives it the image's health check and lets `--wait` hold for it.

Evidence: `pnpm lint`, `pnpm typecheck`, `pnpm test` (105 files, 1,063 tests) pass. Against the Docker test profile rebuilt with the change: `worker-fresh` healthy and its heartbeat row written; `e2e/worker.spec.ts` on the `worker-instance` project (`--no-deps`; the full chain runs in ticket 11) 1 passed in 1.2 min; `e2e/instance-settings.spec.ts` 9 passed at both widths with the app-mode line.

