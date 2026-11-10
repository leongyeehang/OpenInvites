-- Videos in the album (M7 ticket 05): an item's kind, a video's length, codec and lighter copy, a
-- video's size nullable until probed; the event's video settings; the processing queue and the
-- uploads in progress (ticket 06). New types may be used at once; the two states 0048 added are not.
CREATE TYPE "public"."photo_kind" AS ENUM('photo', 'video');--> statement-breakpoint
CREATE TYPE "public"."video_quality" AS ENUM('1080p', '720p');--> statement-breakpoint
CREATE TABLE "album_upload" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"rsvp_id" uuid,
	"host_id" uuid,
	"kind" "photo_kind" NOT NULL,
	"name" text NOT NULL,
	"size" bigint NOT NULL,
	"type" text NOT NULL,
	"duration_ms" integer,
	"part_size" integer NOT NULL,
	"received" integer[] DEFAULT '{}' NOT NULL,
	"photo_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "album_upload_one_owner" CHECK (("album_upload"."rsvp_id" is null) <> ("album_upload"."host_id" is null))
);
--> statement-breakpoint
CREATE TABLE "video_job" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"photo_id" uuid NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"leased_at" timestamp with time zone,
	"leased_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_job_photo_id_unique" UNIQUE("photo_id")
);
--> statement-breakpoint
ALTER TABLE "photo" ALTER COLUMN "width" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ALTER COLUMN "height" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_videos_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_max_video_mb" integer;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_max_video_minutes" integer;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_copy_quality" "video_quality" DEFAULT '1080p' NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "kind" "photo_kind" DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "codec" text;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "copy" "video_quality";--> statement-breakpoint
ALTER TABLE "album_upload" ADD CONSTRAINT "album_upload_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_upload" ADD CONSTRAINT "album_upload_rsvp_id_rsvp_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_upload" ADD CONSTRAINT "album_upload_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_upload" ADD CONSTRAINT "album_upload_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_job" ADD CONSTRAINT "video_job_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_upload_event_id_idx" ON "album_upload" USING btree ("event_id");