ALTER TYPE "public"."prospect_status" RENAME TO "prospect_status_old";
--> statement-breakpoint
CREATE TYPE "public"."prospect_status" AS ENUM(
  'new',
  'contacted',
  'replied',
  'converted',
  'bounced',
  'unsubscribed'
);
--> statement-breakpoint
ALTER TABLE "prospects" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
UPDATE "prospects"
SET "status" = 'new'
WHERE "status" IN ('researching', 'researched');
--> statement-breakpoint
ALTER TABLE "prospects"
ALTER COLUMN "status" TYPE "public"."prospect_status"
USING "status"::text::"public"."prospect_status";
--> statement-breakpoint
ALTER TABLE "prospects" ALTER COLUMN "status" SET DEFAULT 'new';
--> statement-breakpoint
DROP TYPE "public"."prospect_status_old";
