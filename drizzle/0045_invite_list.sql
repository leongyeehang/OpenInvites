-- The invite list (M6 tickets 05 to 08): an invite gains a phone and the host's letter, and what
-- the invitation email needs (its stop link's token, when mail was stopped, when it was sent); an
-- event gains personal letters and invite-only, both off. No existing row changes otherwise.
ALTER TABLE "event" ADD COLUMN "letters_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "invite_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invite" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "invite" ADD COLUMN "letter" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "invite" ADD COLUMN "mail_token" text;--> statement-breakpoint
ALTER TABLE "invite" ADD COLUMN "mail_stopped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invite" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_mail_token_unique" UNIQUE("mail_token");