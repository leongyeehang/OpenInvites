-- When the worker container, if VIDEO_PROCESSING moved the album's video processing to one, last
-- reported (M7 ticket 08); the Storage card says so. Null while the app processes videos itself.
ALTER TABLE "instance_settings" ADD COLUMN "video_worker_seen_at" timestamp with time zone;