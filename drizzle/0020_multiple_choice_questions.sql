ALTER TYPE "public"."question_type" ADD VALUE 'multiple' BEFORE 'yesNo';--> statement-breakpoint
ALTER TABLE "answer" ADD COLUMN "values" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "answer" SET "values" = ARRAY["value"];--> statement-breakpoint
ALTER TABLE "answer" ALTER COLUMN "values" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "answer" DROP COLUMN "value";
