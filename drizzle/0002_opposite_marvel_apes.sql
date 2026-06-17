CREATE TABLE "achievement_progress" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"progress_value" real DEFAULT 0 NOT NULL,
	"progress_max" real,
	"meta" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ach_progress" UNIQUE("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "pr_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_slug" text NOT NULL,
	"kind" text NOT NULL,
	"value" real NOT NULL,
	"gain_pct" real,
	"occurred_on" date NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pr_event" UNIQUE("user_id","exercise_slug","occurred_on","kind")
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"tier" text,
	"evidence" jsonb,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_achievement" UNIQUE("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "user_game_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"title" text DEFAULT 'Novice' NOT NULL,
	"best_e1rm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"ref_key" text NOT NULL,
	"amount" integer NOT NULL,
	"event_date" date NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_xp_event" UNIQUE("user_id","source","ref_key")
);
--> statement-breakpoint
ALTER TABLE "achievement_progress" ADD CONSTRAINT "achievement_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_events" ADD CONSTRAINT "pr_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_game_profile" ADD CONSTRAINT "user_game_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pr_user_ex" ON "pr_events" USING btree ("user_id","exercise_slug");--> statement-breakpoint
CREATE INDEX "idx_xp_user_date" ON "xp_events" USING btree ("user_id","event_date");