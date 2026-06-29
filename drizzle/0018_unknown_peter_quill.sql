CREATE TABLE "leaderboard_cache" (
	"board" text NOT NULL,
	"rank" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"user_agent" text,
	"ip" text,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_country" text;--> statement-breakpoint
ALTER TABLE "leaderboard_cache" ADD CONSTRAINT "leaderboard_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lb_board" ON "leaderboard_cache" USING btree ("board","rank");--> statement-breakpoint
CREATE INDEX "idx_usersession_user" ON "user_sessions" USING btree ("user_id","last_seen_at");