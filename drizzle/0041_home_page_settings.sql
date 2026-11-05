-- The home page settings (home page, ticket 01): the instance's name and welcome line, which gallery
-- posters the home page shows, and whether it says who runs the site. The one row takes the defaults.
ALTER TABLE "instance_settings" ADD COLUMN "instance_name" text;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "welcome_line" text;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "home_posters" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "home_poster_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "show_operator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD CONSTRAINT "instance_settings_home_posters" CHECK ("instance_settings"."home_posters" in ('all', 'picked', 'one'));