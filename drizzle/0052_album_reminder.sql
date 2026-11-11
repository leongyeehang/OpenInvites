-- The album's reminder (M7 ticket 09): so many days after the event its hosts are reminded once to
-- empty the album or keep it; null never, which every event from before 0.7 keeps. Nothing deletes.
ALTER TABLE "event" ADD COLUMN "album_reminder_days" integer;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_reminded_at" timestamp with time zone;