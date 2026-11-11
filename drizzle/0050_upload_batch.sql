-- An upload in progress remembers the ask that made it (M7 ticket 06), so the last finish of a
-- batch emails the hosts once about what waits, as one post did. The table is empty until 0.7 runs.
ALTER TABLE "album_upload" ADD COLUMN "batch" text NOT NULL;