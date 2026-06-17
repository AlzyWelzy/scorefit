CREATE TABLE "backup_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"name" text,
	"image" text,
	"password_hash" text,
	"unit" text DEFAULT 'kg' NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_method" text,
	"totp_secret" text,
	"last_totp_step" integer,
	"token_version" integer DEFAULT 0 NOT NULL,
	"pending_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_token_user_purpose" UNIQUE("user_id","purpose")
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"program" text NOT NULL,
	"week" integer NOT NULL,
	"day_slug" text NOT NULL,
	"exercise_slug" text NOT NULL,
	"set_index" integer NOT NULL,
	"weight" real,
	"reps" integer,
	"rpe" real,
	"completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_log_coords" UNIQUE("user_id","program","week","day_slug","exercise_slug","set_index")
);
--> statement-breakpoint
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_backup_user" ON "backup_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_log_user_program_week" ON "workout_logs" USING btree ("user_id","program","week");