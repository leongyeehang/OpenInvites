CREATE TABLE "upload" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"luminance" double precision NOT NULL,
	"accent" text NOT NULL,
	"lightest" text NOT NULL,
	"darkest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "upload" ADD CONSTRAINT "upload_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;