ALTER TABLE "activities" ALTER COLUMN "strava_activity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "source" text DEFAULT 'strava' NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "upload_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_user_upload_hash_idx" ON "activities" USING btree ("user_id","upload_hash");