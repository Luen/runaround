ALTER TABLE "activities" ADD COLUMN "garmin_activity_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_garmin_id_idx" ON "activities" USING btree ("garmin_activity_id");