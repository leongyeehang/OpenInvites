-- The poster a host picks in Account's Backdrop card to wear behind their own pages (M8 ticket 22):
-- one row per host who has saved a choice, the poster's gallery id or null for Automatic. A table of
-- its own rather than a column on "user", which is Better Auth's and whose shape is its own; it goes
-- with the account. No backfill: a host with no row is on Automatic, as before.
CREATE TABLE "host_look" (
	"host_id" uuid PRIMARY KEY NOT NULL,
	"poster" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "host_look" ADD CONSTRAINT "host_look_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;