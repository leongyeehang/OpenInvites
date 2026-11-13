-- The page a host arranges (M8 ticket 25): how the event page's sections are ordered and set, one
-- JSON value read through parseArrangement (src/sections), and whether the event has an album, the
-- host's own switch beside the operator's (M8 spec, "One switch, one truth"). No backfill: the
-- empty value reads as never arranged, which draws each layout as before, and every album stays on.
ALTER TABLE "event" ADD COLUMN "sections" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_enabled" boolean DEFAULT true NOT NULL;