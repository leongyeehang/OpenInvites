CREATE TABLE "retired_slug" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"event_id" uuid NOT NULL,
	"retired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retired_slug_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "retired_slug" ADD CONSTRAINT "retired_slug_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "retired_slug_event_id_idx" ON "retired_slug" USING btree ("event_id");