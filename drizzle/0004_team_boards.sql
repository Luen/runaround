ALTER TABLE "attempts" ADD COLUMN "trace" jsonb;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "team_size" integer;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "team_max_separation_m" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "team_max_start_gap_s" integer DEFAULT 300 NOT NULL;