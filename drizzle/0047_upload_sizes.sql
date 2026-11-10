-- Every album photo and every host's picture records its size as uploaded (M7 ticket 02), what
-- the storage limits count. Null for a row from before 0.7, until the one-time measuring after the
-- upgrade records what is stored for it (storage/measure.ts).
ALTER TABLE "photo" ADD COLUMN "bytes" bigint;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "bytes" bigint;