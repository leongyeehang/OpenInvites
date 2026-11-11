-- Video sizes (M8 ticket 02): an item keeps the sizes it has copies at, and an event the sizes its
-- host ticks, both through a new type that adds 4K, so no value is added to an existing enum. An
-- item's one copy carries over; an event that chose 720p keeps 720p alone and every other event
-- gets both sizes; no row is given 4K here. The old columns and their type go.
CREATE TYPE "public"."video_size" AS ENUM('2160p', '1080p', '720p');--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "copies" "video_size"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_copy_sizes" "video_size"[] DEFAULT '{1080p,720p}' NOT NULL;--> statement-breakpoint
UPDATE "photo" SET "copies" = ARRAY["copy"::text::"video_size"] WHERE "copy" IS NOT NULL;--> statement-breakpoint
UPDATE "event" SET "album_copy_sizes" = '{720p}' WHERE "album_copy_quality" = '720p';--> statement-breakpoint
ALTER TABLE "photo" DROP COLUMN "copy";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "album_copy_quality";--> statement-breakpoint
DROP TYPE "public"."video_quality";
