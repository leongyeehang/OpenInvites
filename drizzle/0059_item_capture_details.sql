-- The details a host may keep of each album item (M8 ticket 07): an event's two switches, for
-- when items were taken and for the camera with its lens and exposure, both off, and the album's
-- order, by when added; an item's capture time, null for everything added before. No backfill: the
-- stored files kept nothing to read it from.
CREATE TYPE "public"."album_order" AS ENUM('added', 'taken');--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_keep_taken_at" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_keep_camera" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_order" "album_order" DEFAULT 'added' NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "taken_at" timestamp with time zone;