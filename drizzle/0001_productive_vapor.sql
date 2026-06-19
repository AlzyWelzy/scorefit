CREATE TABLE "workout_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"program" text NOT NULL,
	"week" integer NOT NULL,
	"day_slug" text NOT NULL,
	"session_date" date NOT NULL,
	"distinct_exercises" integer DEFAULT 0 NOT NULL,
	"completed_sets" integer DEFAULT 0 NOT NULL,
	"prescribed_sets" integer DEFAULT 0 NOT NULL,
	"tonnage" real DEFAULT 0 NOT NULL,
	"best_e1rm" real,
	"qualifies" boolean DEFAULT false NOT NULL,
	"committed_at" timestamp with time zone,
	"backfilled" boolean DEFAULT false NOT NULL,
	"first_at" timestamp with time zone,
	"last_at" timestamp with time zone,
	CONSTRAINT "uq_session_coords" UNIQUE("user_id","program","week","day_slug")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "week_starts_on" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_sessions_per_week" integer;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_user_date" ON "workout_sessions" USING btree ("user_id","session_date");