-- The M7 limits (ticket 01): the largest photo and video, the longest video, the storage per
-- event and for the site (whole binary megabytes), the album reminder's default (null: never), the
-- processing switch, and whether MAX_UPLOAD_MB has been read once into Largest photo at a start
-- (instance/upload-limit.ts). Every column has a default, so no existing row changes otherwise.
ALTER TABLE "instance_settings" ADD COLUMN "max_photo_mb" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "max_video_mb" integer DEFAULT 750 NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "max_video_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "max_event_storage_mb" integer DEFAULT 51200 NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "max_site_storage_mb" integer DEFAULT 51200 NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "album_reminder_default_days" integer DEFAULT 60;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "video_processing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "upload_env_adopted" boolean DEFAULT false NOT NULL;