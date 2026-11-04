-- Date polls (M4, ticket 09): candidate dates, the people who voted and their answers, and when an
-- event's poll opened and closed. An event with an open poll may be published without a date.
CREATE TYPE "public"."vote_answer" AS ENUM('yes', 'ifNeedBe', 'no');--> statement-breakpoint
CREATE TABLE "date_option" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"day" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "date_vote" (
	"option_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"answer" "vote_answer" NOT NULL,
	CONSTRAINT "date_vote_option_id_voter_id_pk" PRIMARY KEY("option_id","voter_id")
);
--> statement-breakpoint
CREATE TABLE "date_voter" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"token_hash" text NOT NULL,
	"mail_token" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "date_voter_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "date_voter_mail_token_unique" UNIQUE("mail_token")
);
--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_dated_unless_draft";--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "poll_opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "poll_closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "date_option" ADD CONSTRAINT "date_option_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_vote" ADD CONSTRAINT "date_vote_option_id_date_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."date_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_vote" ADD CONSTRAINT "date_vote_voter_id_date_voter_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."date_voter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_voter" ADD CONSTRAINT "date_voter_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "date_option_event_id_idx" ON "date_option" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "date_vote_voter_id_idx" ON "date_vote" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "date_voter_event_id_idx" ON "date_voter" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_dated_unless_draft" CHECK ("event"."state" = 'draft' or "event"."starts_at" is not null or ("event"."poll_opened_at" is not null and "event"."poll_closed_at" is null));