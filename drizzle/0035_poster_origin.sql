-- The poster (M4, ticket 01). Every existing upload is a photo the host uploaded; an emoji pattern
-- made in the Poster sheet (ticket 06) records its emoji and colour. No theme is rewritten: themes
-- written by 0.4 are read into a poster (themes/theme.ts, parsePoster) and saved in the new shape
-- the next time the host changes them.
CREATE TYPE "public"."upload_origin" AS ENUM('host', 'emoji');--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "origin" "upload_origin" DEFAULT 'host' NOT NULL;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "emoji_set" text[];--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "emoji_background" text;