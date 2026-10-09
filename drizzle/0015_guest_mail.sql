ALTER TABLE "rsvp" ADD COLUMN "mail_token" text;--> statement-breakpoint
ALTER TABLE "rsvp" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp" ADD CONSTRAINT "rsvp_mail_token_unique" UNIQUE("mail_token");--> statement-breakpoint
-- Every RSVP that already has an email gets its mail token now, so the guests who replied before
-- the upgrade get guest mail too (src/rsvps/cancellation.ts sends none without one). Postgres has
-- no built-in way to draw the app's 24 characters of the event link's alphabet from a
-- cryptographic source, so these are a random UUID's 32 hex digits (122 random bits) instead. The
-- stop link looks its token up exactly, so the two shapes live side by side; tokens made from now
-- on are the app's (src/rsvps/token.ts).
UPDATE "rsvp" SET "mail_token" = replace(gen_random_uuid()::text, '-', '') WHERE "email" IS NOT NULL AND "email" <> '' AND "mail_token" IS NULL;