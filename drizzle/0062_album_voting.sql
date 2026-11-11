-- The album vote (M8 ticket 10; src/voting): on each event, its state (off until a host starts it),
-- its closing time, who may vote and whether guests see who added each item; an event's awards,
-- made when a vote first needs one; and the votes given in them, one per voter in each round of
-- each award. The new enum types are used here, where they are made. No backfill: nothing voted.
CREATE TYPE "public"."album_award_scope" AS ENUM('all', 'photos', 'videos');--> statement-breakpoint
CREATE TYPE "public"."album_uploader_names" AS ENUM('always', 'afterVoting', 'never');--> statement-breakpoint
CREATE TYPE "public"."album_voters" AS ENUM('album', 'going', 'invited');--> statement-breakpoint
CREATE TYPE "public"."album_voting_state" AS ENUM('off', 'open', 'closed');--> statement-breakpoint
CREATE TABLE "album_award" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text,
	"scope" "album_award_scope" DEFAULT 'all' NOT NULL,
	"position" integer NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"finalists" uuid[] DEFAULT '{}' NOT NULL,
	"tiebreak_open" boolean DEFAULT false NOT NULL,
	"shared_first" boolean DEFAULT false NOT NULL,
	CONSTRAINT "album_award_name_length" CHECK (char_length("album_award"."name") <= 40)
);
--> statement-breakpoint
CREATE TABLE "album_vote" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"award_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"photo_id" uuid NOT NULL,
	"rsvp_id" uuid,
	"host_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "album_vote_once_by_guest" UNIQUE("award_id","round","rsvp_id"),
	CONSTRAINT "album_vote_once_by_host" UNIQUE("award_id","round","host_id"),
	CONSTRAINT "album_vote_one_voter" CHECK (("album_vote"."rsvp_id" is null) <> ("album_vote"."host_id" is null))
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_voting" "album_voting_state" DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_voting_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_voters" "album_voters" DEFAULT 'album' NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "album_uploader_names" "album_uploader_names" DEFAULT 'afterVoting' NOT NULL;--> statement-breakpoint
ALTER TABLE "album_award" ADD CONSTRAINT "album_award_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_vote" ADD CONSTRAINT "album_vote_award_id_album_award_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."album_award"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_vote" ADD CONSTRAINT "album_vote_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_vote" ADD CONSTRAINT "album_vote_rsvp_id_rsvp_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_vote" ADD CONSTRAINT "album_vote_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_award_event_id_idx" ON "album_award" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "album_vote_photo_id_idx" ON "album_vote" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "album_vote_rsvp_id_idx" ON "album_vote" USING btree ("rsvp_id");--> statement-breakpoint
CREATE INDEX "album_vote_host_id_idx" ON "album_vote" USING btree ("host_id");