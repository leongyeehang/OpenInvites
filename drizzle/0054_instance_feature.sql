-- The operator's feature switches (M8 ticket 01): one row per feature the operator has saved, a
-- feature with no row being on, so nothing is backfilled and an upgraded site keeps every feature.
CREATE TABLE "instance_feature" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
