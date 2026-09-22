CREATE TYPE "public"."rsvp_status" AS ENUM('going', 'maybe', 'cant');--> statement-breakpoint
CREATE TABLE "rsvp" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "rsvp_status" NOT NULL,
	"name" text NOT NULL,
	"plus_ones" integer DEFAULT 0 NOT NULL,
	"plus_one_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"email" text,
	"edit_token_hash" text NOT NULL,
	"replied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rsvp_edit_token_hash_unique" UNIQUE("edit_token_hash")
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "plus_ones_allowed" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "require_plus_one_names" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "ask_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp" ADD CONSTRAINT "rsvp_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rsvp_event_id_idx" ON "rsvp" USING btree ("event_id");