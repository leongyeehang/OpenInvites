-- When a guest used the stop link (ticket 04, review). Before this, a stop only blanked the email,
-- which cannot be told apart from a guest blanking it on their own RSVP, so no existing RSVP is
-- marked: the mark starts with the next stop.
ALTER TABLE "rsvp" ADD COLUMN "mail_stopped_at" timestamp with time zone;
