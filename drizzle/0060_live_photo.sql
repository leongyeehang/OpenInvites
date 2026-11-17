-- A live photo (M8 ticket 08): a photo whose motion the video queue has made from the clip its
-- JPEG carried, served beside its files. No backfill: no photo added before kept its clip.
ALTER TABLE "photo" ADD COLUMN "live" boolean DEFAULT false NOT NULL;