ALTER TABLE "event" ADD COLUMN "reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- On for events created from now on, off for every event that already exists: the upgrade emails
-- no guest a reminder until the host turns them on (spec, story 141).
UPDATE "event" SET "reminders_enabled" = false;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
-- Events published before this change were last changed no earlier than they were published, so
-- their last change stands in for when (spec, "Automatic reminders").
UPDATE "event" SET "published_at" = "updated_at" WHERE "state" IN ('published', 'cancelled');--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "week_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "day_reminder_sent_at" timestamp with time zone;
