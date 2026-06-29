CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"admin_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_activity_feed" ON "activity_events" USING btree ("user_id","hidden_at","created_at");