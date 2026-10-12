-- Waitlisted, the RSVP status a guest never chooses (M3, ticket 06), on its own: Postgres cannot use
-- an enum value in the transaction that adds it. No RSVP takes it here.
ALTER TYPE "public"."rsvp_status" ADD VALUE 'waitlisted';