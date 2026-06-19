CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_user_id" uuid,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by_admin_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_social_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_admin_id_users_id_fk" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_reports_status" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_reports_reporter" ON "reports" USING btree ("reporter_id");