CREATE TABLE "mail_outbox" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "notify_on_rsvp" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- On for events created from now on, off for every event that already exists: the upgrade emails
-- no host about replies until they turn it on (spec, story 141).
UPDATE "event" SET "notify_on_rsvp" = false;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_outbox" ADD CONSTRAINT "mail_outbox_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mail_outbox_event_id_idx" ON "mail_outbox" USING btree ("event_id");