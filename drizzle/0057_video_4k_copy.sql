-- The operator's 4K switch (M8 ticket 04): whether a 4K original that is not H.264 also gets a 4K
-- H.264 copy that plays everywhere. Off, so an upgraded site makes nothing it did not before.
ALTER TABLE "instance_settings" ADD COLUMN "video_4k_copy" boolean DEFAULT false NOT NULL;
