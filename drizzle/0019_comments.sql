CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"rsvp_id" uuid,
	"host_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_one_author" CHECK (("comment"."rsvp_id" is null) <> ("comment"."host_id" is null))
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "comments_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "notify_on_comment" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- On for events created from now on, off for every event that already exists: the upgrade puts
-- comments on no live page, and emails no host about them, until the host turns them on (spec,
-- story 141).
UPDATE "event" SET "comments_enabled" = false, "notify_on_comment" = false;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_rsvp_id_rsvp_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_event_id_idx" ON "comment" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "comment_rsvp_id_idx" ON "comment" USING btree ("rsvp_id");--> statement-breakpoint
CREATE INDEX "comment_host_id_idx" ON "comment" USING btree ("host_id");