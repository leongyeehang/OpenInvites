-- What processing learns of an album item beyond its size and length (M8 ticket 05): a video's
-- HDR kind and frame rate, for the player and the technical line. Empty for a photo, and for a
-- video from before 0.8 until Make missing sizes reaches it.
ALTER TABLE "photo" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb NOT NULL;