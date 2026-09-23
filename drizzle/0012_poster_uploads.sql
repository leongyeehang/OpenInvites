-- An upload is now also made into a poster, and measured as the blurred copy behind one. An upload
-- made before this has neither its poster rendition nor these measurements, and OpenInvites was
-- never released without them, so only a development database can hold one: it is dropped rather
-- than kept half-made. Its event shows the default background until the host chooses another.
DELETE FROM "upload";--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "poster_lightest" text NOT NULL;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "poster_darkest" text NOT NULL;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "poster_width" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "poster_height" integer NOT NULL;
