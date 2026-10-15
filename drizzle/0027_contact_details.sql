CREATE TYPE "public"."contact_field" AS ENUM('none', 'optional', 'required');--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "email_field" "contact_field" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "phone_field" "contact_field" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp" ADD COLUMN "phone" text;--> statement-breakpoint
-- The email switch becomes a choice (spec, "Contact details"). Before 0.4 a guest asked for an email
-- could always leave it out, so an event that asked for one asks for it optionally; an event that
-- did not ask keeps the column's default, don't ask.
UPDATE "event" SET "email_field" = 'optional' WHERE "ask_email";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "ask_email";
