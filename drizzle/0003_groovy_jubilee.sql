ALTER TABLE "users" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "leaderboard_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accepted_terms_at" timestamp with time zone;