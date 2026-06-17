ALTER TABLE "users" ADD COLUMN "last_totp_step" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_email" text;