-- Approval (M3, ticket 07). Existing events do not ask for it, and every existing RSVP is
-- approved. The type is new, so its values can be used in the transaction that creates it.
CREATE TYPE "public"."rsvp_approval" AS ENUM('approved', 'pending', 'declined');--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "approval_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp" ADD COLUMN "approval" "rsvp_approval" DEFAULT 'approved' NOT NULL;