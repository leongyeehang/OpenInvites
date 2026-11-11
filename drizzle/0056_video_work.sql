-- What a queued job does (M8 ticket 03): `process` a clip into a ready item, as every job did in
-- 0.7, so every job queued now is one; make the `sizes` a ready item lacks, one a claim; or a live
-- photo's `motion` (ticket 08), created with the others so that no later migration adds a value.
CREATE TYPE "public"."video_work" AS ENUM('process', 'sizes', 'motion');--> statement-breakpoint
ALTER TABLE "video_job" ADD COLUMN "work" "video_work" DEFAULT 'process' NOT NULL;
