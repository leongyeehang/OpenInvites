CREATE TABLE "co_host_link" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_id" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "co_host_link_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "event_host" (
	"event_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_host_event_id_host_id_pk" PRIMARY KEY("event_id","host_id")
);
--> statement-breakpoint
ALTER TABLE "co_host_link" ADD CONSTRAINT "co_host_link_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_host_link" ADD CONSTRAINT "co_host_link_used_by_id_user_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_host" ADD CONSTRAINT "event_host_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_host" ADD CONSTRAINT "event_host_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "co_host_link_event_id_idx" ON "co_host_link" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_host_host_id_idx" ON "event_host" USING btree ("host_id");