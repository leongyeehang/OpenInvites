CREATE TYPE "public"."registration_mode" AS ENUM('invitationOnly', 'open');--> statement-breakpoint
CREATE TABLE "host_invitation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token_hash" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_email" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "host_invitation_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"registration_mode" "registration_mode" DEFAULT 'invitationOnly' NOT NULL,
	"operator_id" uuid,
	"first_account_email" text,
	CONSTRAINT "instance_settings_one_row" CHECK ("instance_settings"."id")
);
--> statement-breakpoint
ALTER TABLE "instance_settings" ADD CONSTRAINT "instance_settings_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The one row. A database from before there was an operator makes its earliest account the
-- operator; registration starts invitation only there too, as on a fresh instance.
INSERT INTO "instance_settings" ("id", "operator_id") VALUES (true, (SELECT "id" FROM "user" ORDER BY "created_at", "id" LIMIT 1));
