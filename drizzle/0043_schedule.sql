-- The schedule (M6 ticket 01): an event's timed items, saved as a whole from the editor's sheet in
-- day-and-time order, and how guests' open pages pick up a change to them, every minute by default.
CREATE TYPE "public"."schedule_refresh" AS ENUM('minute', 'reload');--> statement-breakpoint
CREATE TABLE "schedule_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"day" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"title" text NOT NULL,
	"place" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "schedule_refresh" "schedule_refresh" DEFAULT 'minute' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_item" ADD CONSTRAINT "schedule_item_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_item_event_id_idx" ON "schedule_item" USING btree ("event_id");