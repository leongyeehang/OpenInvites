-- Personal invite links (M3, ticket 08). No existing row changes: there is no invite yet, and no
-- existing RSVP came through one.
CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"rsvp_id" uuid,
	CONSTRAINT "invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "rsvp" ADD COLUMN "invite_id" uuid;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_rsvp_id_rsvp_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvp"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_event_id_idx" ON "invite" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "rsvp" ADD CONSTRAINT "rsvp_invite_id_invite_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invite"("id") ON DELETE set null ON UPDATE no action;