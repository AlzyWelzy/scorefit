CREATE TABLE "body_metrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"measured_on" date NOT NULL,
	"weight" real NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_body_metric_day" UNIQUE("user_id","measured_on")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_program" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_week" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "feature_allowlist" jsonb;--> statement-breakpoint
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_log_prev_completed" ON "workout_logs" USING btree ("user_id","program","exercise_slug","set_index","week" DESC NULLS LAST) WHERE "workout_logs"."completed" = true;--> statement-breakpoint
-- DB-level CHECK constraints mirroring the app-level Drizzle enums, so a bad write can't
-- slip a free-text value past the application. Wrapped in DO blocks so re-running is safe.
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "chk_users_unit" CHECK ("unit" IN ('kg','lb'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "chk_users_2fa_method" CHECK ("two_factor_method" IS NULL OR "two_factor_method" IN ('email','totp'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "chk_users_current_program" CHECK ("current_program" IS NULL OR "current_program" IN ('beginner','intermediate'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workout_logs" ADD CONSTRAINT "chk_logs_program" CHECK ("program" IN ('beginner','intermediate'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;