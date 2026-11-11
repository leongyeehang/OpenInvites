-- Processing and failed, the states a video passes through (M7 ticket 05), on their own: Postgres
-- cannot use an enum value in the transaction that adds it, and every pending migration runs in
-- one transaction. No row takes either here; only the code does (album/jobs.ts).
ALTER TYPE "public"."photo_status" ADD VALUE 'processing';--> statement-breakpoint
ALTER TYPE "public"."photo_status" ADD VALUE 'failed';