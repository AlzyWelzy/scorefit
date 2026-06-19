CREATE TABLE "challenge_participants" (
	"challenge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"final_score" integer,
	"final_rank" integer,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_challenge_participant" UNIQUE("challenge_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"group_id" uuid,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"shares_training_with_coach" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_group_member" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text DEFAULT 'crew' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_game_profile" ADD COLUMN "freezes_available" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_game_profile" ADD COLUMN "freeze_kept_weeks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_game_profile" ADD COLUMN "season_id" text;--> statement-breakpoint
ALTER TABLE "user_game_profile" ADD COLUMN "season_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_game_profile" ADD COLUMN "prestige" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_reminder_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_visibility" text DEFAULT 'friends' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sharing_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_event_id_activity_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."activity_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_challenge_ends" ON "challenges" USING btree ("ends_on");--> statement-breakpoint
CREATE INDEX "idx_comment_event" ON "event_comments" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_member_user" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_group_owner" ON "groups" USING btree ("owner_id");