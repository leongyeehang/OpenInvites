ALTER TABLE "event" ADD COLUMN "custom_slug" text;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_custom_slug_unique" UNIQUE("custom_slug");