-- Retention (M3, ticket 10). An existing instance keeps events for a year after they end, as a
-- new one does; no event is marked yet, so the first sweep after the upgrade only marks, and
-- deletes nothing for 30 days. Slugs of deleted events stay retired from now on, so that no other
-- event is given them: the reference to the event is nulled when the event goes, no longer
-- cascaded.
ALTER TABLE "retired_slug" DROP CONSTRAINT "retired_slug_event_id_event_id_fk";
--> statement-breakpoint
ALTER TABLE "retired_slug" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "retention_warned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "retention_days" integer;--> statement-breakpoint
UPDATE "instance_settings" SET "retention_days" = 365;--> statement-breakpoint
ALTER TABLE "retired_slug" ADD CONSTRAINT "retired_slug_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE set null ON UPDATE no action;