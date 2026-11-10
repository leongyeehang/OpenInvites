# 08: Videos: a worker container for the processing

**What to build:** An operator can move the processing to a second container from the same image: the app then only queues, the worker processes, and the Storage card says which is at work and when the worker was last seen.

**Blocked by:** 06 Videos: the upload protocol, the queue and the processing

**Status:** ready-for-agent

- [ ] `src/instance/env.ts`: `videoProcessingMode(): "app" | "worker"` from `VIDEO_PROCESSING` (default `app`, anything else refused at start as the rate limits are, `checkRateLimitsAtStart`'s pattern), and `videoRole(): "app" | "worker"` from `VIDEO_ROLE` (default `app`). Unit tests beside `env.test.ts`.
- [ ] Migration `0050_worker_heartbeat`: `instance_settings.video_worker_seen_at timestamptz`.
- [ ] `src/instrumentation.ts`: with `videoRole() === "worker"` the container runs migrations (safe under the advisory lock), the start checks, and then only the video queue: `startVideoQueue()` with an immediate kick, and a heartbeat every minute writing `video_worker_seen_at = now()`; it does not start the mail worker. With `videoRole() === "app"` and `videoProcessingMode() === "worker"`, the app does not start the queue and `kickVideoQueue()` is a no-op there; the worker's minute tick picks the job up. **(plan ruling 18.)**
- [ ] `scripts/video-worker.mjs`: a launcher, not a program: sets `process.env.VIDEO_ROLE = "worker"` and `await import("../server.js")` (the standalone server does `process.chdir(__dirname)`, so the import from `/app/scripts` works). Its comment says why: the image has no TypeScript toolchain and the S3 client is bundled into the server, so the worker is the same server in a worker role, listening on its port unpublished, which also gives it the health check.
- [ ] `deploy/compose.yaml`: a commented-out `worker` service beside `app` (same image, `env_file`, `environment: VIDEO_ROLE: worker`, `command: ["node", "scripts/video-worker.mjs"]`, no `ports`, the `uploads` volume on local disk) with a comment saying to set `VIDEO_PROCESSING=worker` on `app`; `deploy/.env.example` gains `# VIDEO_PROCESSING=app`.
- [ ] The Storage card (ticket 03): "Videos are processed by this site's app" (mode `app`), "…by the worker container, last seen {time}" (mode `worker` with a heartbeat; `getFormatter().relativeTime`), or "…by a worker container, which has not reported yet: check it is running" (mode `worker`, no heartbeat or one older than five minutes). Keys `Instance.storage.processedBy{App,Worker,WorkerMissing}`.
- [ ] Test profile: `compose.yaml` gives `app-fresh` `VIDEO_PROCESSING: worker` and adds `worker-fresh` (same `build: .`, `db-fresh`, the same environment as `app-fresh` plus `VIDEO_ROLE: worker`, `command: ["node", "scripts/video-worker.mjs"]`, no port); `ci.yml:83` dumps its logs too. `playwright.config.ts`: a `worker-instance` project (`testMatch: /(^|\/)worker\.spec\.ts$/`, baseURL 3002, in the serial chain after `home-instance`, ignored by mobile and desktop); `e2e/worker.spec.ts` recreates `db-fresh`, `app-fresh`, `worker-fresh` (`e2e/instances.ts:4-9`), signs up a host, publishes a past-dated event, adds `clip-h264.mp4` through the picker, and sees the tile ready within 90 s (processed by the worker); Site settings' Storage card says "by the worker container, last seen …". The other instance projects on `app-fresh` upload photos only, which need no queue.
- [ ] Docs, briefly (ticket 11 completes): `docs/operator/configuration.md` gains a `VIDEO_PROCESSING` row and a paragraph on the worker in the Storage subsection.

## Notes for the implementer

- Two containers never process one job twice: the lease is a single `UPDATE … FOR UPDATE SKIP LOCKED` (ticket 06).
- Commit subject, e.g. `Videos: a worker container can take the processing`.

## Comments
