-- Reactions to comments (M4, ticket 04): one of six emoji, by a guest through their RSVP or by a
-- host, once per emoji per comment. They go with the comment, the RSVP or the host's account.
CREATE TABLE "comment_reaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"comment_id" uuid NOT NULL,
	"rsvp_id" uuid,
	"host_id" uuid,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reaction_once_by_guest" UNIQUE("comment_id","rsvp_id","emoji"),
	CONSTRAINT "comment_reaction_once_by_host" UNIQUE("comment_id","host_id","emoji"),
	CONSTRAINT "comment_reaction_one_reactor" CHECK (("comment_reaction"."rsvp_id" is null) <> ("comment_reaction"."host_id" is null))
);
--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_rsvp_id_rsvp_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_reaction_rsvp_id_idx" ON "comment_reaction" USING btree ("rsvp_id");--> statement-breakpoint
CREATE INDEX "comment_reaction_host_id_idx" ON "comment_reaction" USING btree ("host_id");