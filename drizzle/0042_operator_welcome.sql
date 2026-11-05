-- The operator's welcome sheet (home page, ticket 04): which operator has been welcomed on their
-- dashboard. The operator an upgraded instance already has is marked as welcomed, so that they are
-- not greeted as if the site were new to them.
ALTER TABLE "instance_settings" ADD COLUMN "welcomed_operator_id" uuid;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD CONSTRAINT "instance_settings_welcomed_operator_id_user_id_fk" FOREIGN KEY ("welcomed_operator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE instance_settings SET welcomed_operator_id = operator_id;
