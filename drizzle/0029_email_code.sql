-- The email proven by a code (M3, ticket 05). Existing events start with the check off, and no
-- existing RSVP's email counts as proven: none was.
CREATE TABLE "email_code" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_code_event_email_unique" UNIQUE("event_id","email")
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "verify_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_code" ADD CONSTRAINT "email_code_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;