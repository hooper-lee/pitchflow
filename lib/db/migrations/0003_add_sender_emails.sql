ALTER TABLE "email_templates"
ADD COLUMN "sender_email" varchar(255);
--> statement-breakpoint
ALTER TABLE "campaigns"
ADD COLUMN "from_email" varchar(255);
