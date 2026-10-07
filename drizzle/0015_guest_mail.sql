ALTER TABLE "rsvp" ADD COLUMN "mail_token" text;--> statement-breakpoint
ALTER TABLE "rsvp" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp" ADD CONSTRAINT "rsvp_mail_token_unique" UNIQUE("mail_token");