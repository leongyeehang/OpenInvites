-- After M7's final review (ticket 11): when an upload's batch last received a part, so the hourly
-- sweep drops a batch that has received nothing for an hour; and why a video could not be
-- processed, for its tile.
ALTER TABLE "album_upload" ADD COLUMN "touched_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "failure" text;