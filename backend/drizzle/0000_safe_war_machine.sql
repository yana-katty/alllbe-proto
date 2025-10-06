CREATE TABLE IF NOT EXISTS "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"number_of_participants" varchar(50) NOT NULL,
	"booking_date" timestamp DEFAULT now() NOT NULL,
	"scheduled_visit_time" timestamp,
	"status" varchar(50) DEFAULT 'confirmed' NOT NULL,
	"qr_code" varchar(255),
	"attended_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_qr_code_unique" UNIQUE("qr_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experience_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"asset_type" varchar(50) NOT NULL,
	"asset_url" text NOT NULL,
	"thumbnail_url" text,
	"content_timing" varchar(50) NOT NULL,
	"category" varchar(50),
	"category_label" varchar(100),
	"access_level" varchar(50) DEFAULT 'public' NOT NULL,
	"display_order" varchar(50) DEFAULT '0' NOT NULL,
	"file_size" varchar(100),
	"duration" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" text,
	"duration" varchar(50),
	"capacity" varchar(100),
	"min_participants" varchar(50),
	"max_participants" varchar(50),
	"price" varchar(100),
	"payment_methods" text,
	"age_restriction" varchar(100),
	"notes" text,
	"highlights" text,
	"experience_type" varchar(50) NOT NULL,
	"scheduled_start_at" timestamp,
	"scheduled_end_at" timestamp,
	"period_start_date" timestamp,
	"period_end_date" timestamp,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"cover_image_url" text,
	"hero_image_url" text,
	"tags" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"amount" varchar(100) NOT NULL,
	"currency" varchar(10) DEFAULT 'JPY' NOT NULL,
	"payment_intent_id" varchar(255),
	"refund_id" varchar(255),
	"transaction_id" varchar(255),
	"paid_at" timestamp,
	"refunded_at" timestamp,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "experience_assets" ADD CONSTRAINT "experience_assets_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "experiences" ADD CONSTRAINT "experiences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_qr_code_idx" ON "bookings" USING btree ("qr_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_user_id_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_experience_id_idx" ON "bookings" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_scheduled_visit_time_idx" ON "bookings" USING btree ("scheduled_visit_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_user_status_idx" ON "bookings" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_experience_scheduled_idx" ON "bookings" USING btree ("experience_id","scheduled_visit_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experience_assets_experience_id_idx" ON "experience_assets" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experience_assets_content_timing_idx" ON "experience_assets" USING btree ("content_timing");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experience_assets_access_level_idx" ON "experience_assets" USING btree ("access_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experience_assets_exp_timing_access_idx" ON "experience_assets" USING btree ("experience_id","content_timing","access_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experience_assets_category_idx" ON "experience_assets" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_booking_id_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_payment_method_idx" ON "payments" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_payment_intent_id_idx" ON "payments" USING btree ("payment_intent_id");