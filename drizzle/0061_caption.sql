-- An album item's caption (M8 ticket 09): plain text written by whoever added it or a host, at
-- most 140 characters as char_length counts them; null for none. No backfill: nothing had one.
ALTER TABLE "photo" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_caption_length" CHECK (char_length("photo"."caption") <= 140);