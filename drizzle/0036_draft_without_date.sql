-- A draft may have no date yet (M4, ticket 05): New event makes a blank draft, dated in the editor.
-- Anything published or cancelled keeps one, as every event before this one has.
ALTER TABLE "event" ALTER COLUMN "starts_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_dated_unless_draft" CHECK ("event"."state" = 'draft' or "event"."starts_at" is not null);