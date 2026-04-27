ALTER TYPE "prospect_status" ADD VALUE IF NOT EXISTS 'following_up';
ALTER TYPE "prospect_status" ADD VALUE IF NOT EXISTS 'interested';
ALTER TYPE "prospect_status" ADD VALUE IF NOT EXISTS 'not_following';

DO $$ BEGIN
 CREATE TYPE "campaign_type" AS ENUM('cold_outreach', 'reply_followup');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "campaign_type" "campaign_type" DEFAULT 'cold_outreach' NOT NULL;
