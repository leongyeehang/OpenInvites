-- The album's settings (M6 ticket 03): who sees it (every guest who replied, as before; only those
-- Going; or only the hosts), whether a guest's photos wait for a host's approval, and whether the
-- hosts are emailed when they do. Every photo already in an album is approved.
CREATE TYPE "public"."album_visibility" AS ENUM('replied', 'going', 'hosts');--> statement-breakpoint
CREATE TYPE "public"."photo_status" AS ENUM('pending', 'approved');--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_visibility" "album_visibility" DEFAULT 'replied' NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_approval_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "notify_on_photo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "status" "photo_status" DEFAULT 'approved' NOT NULL;