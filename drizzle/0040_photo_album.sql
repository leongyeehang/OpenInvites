-- The photo album (M4, ticket 11): photos added from an event's start by its guests and hosts, and
-- the operator's limit on how many one event may hold.
CREATE TABLE "photo" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"rsvp_id" uuid,
	"host_id" uuid,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_one_owner" CHECK (("photo"."rsvp_id" is null) <> ("photo"."host_id" is null))
);
--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "max_photos_per_event" integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_rsvp_id_rsvp_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_event_id_idx" ON "photo" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "photo_rsvp_id_idx" ON "photo" USING btree ("rsvp_id");--> statement-breakpoint
CREATE INDEX "photo_host_id_idx" ON "photo" USING btree ("host_id");