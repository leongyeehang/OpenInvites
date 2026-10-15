-- Capacity and the waitlist (M3, ticket 06). Existing events have no capacity, and no RSVP is
-- waitlisted or was promoted.
ALTER TABLE "event" ADD COLUMN "capacity" integer;--> statement-breakpoint
ALTER TABLE "rsvp" ADD COLUMN "waitlisted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rsvp" ADD COLUMN "promoted_at" timestamp with time zone;