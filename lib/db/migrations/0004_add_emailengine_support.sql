CREATE TYPE "public"."mail_account_state" AS ENUM(
  'init',
  'connecting',
  'syncing',
  'connected',
  'authenticationError',
  'connectError',
  'disconnected',
  'unset'
);
--> statement-breakpoint
CREATE TYPE "public"."mail_account_auth_type" AS ENUM('imap_smtp', 'oauth2');
--> statement-breakpoint
CREATE TABLE "mail_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "account_key" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "name" varchar(255),
  "auth_type" "public"."mail_account_auth_type" DEFAULT 'imap_smtp' NOT NULL,
  "state" "public"."mail_account_state" DEFAULT 'init' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "last_error" text,
  "sync_time" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "mail_accounts_account_key_unique" UNIQUE("account_key"),
  CONSTRAINT "mail_accounts_tenant_email_unique" UNIQUE("tenant_id","email")
);
--> statement-breakpoint
ALTER TABLE "mail_accounts" ADD CONSTRAINT "mail_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mail_accounts" ADD CONSTRAINT "mail_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "mail_account_id" uuid;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_mail_account_id_mail_accounts_id_fk" FOREIGN KEY ("mail_account_id") REFERENCES "public"."mail_accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "mail_account_id" uuid;
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "provider" varchar(50) DEFAULT 'resend' NOT NULL;
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "provider_message_id" varchar(500);
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "provider_queue_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "message_header_id" varchar(500);
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "thread_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_mail_account_id_mail_accounts_id_fk" FOREIGN KEY ("mail_account_id") REFERENCES "public"."mail_accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "email_replies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "prospect_id" uuid NOT NULL,
  "mail_account_id" uuid,
  "provider_message_id" varchar(500),
  "thread_id" varchar(255),
  "from_email" varchar(255),
  "from_name" varchar(255),
  "subject" varchar(500),
  "text_body" text,
  "html_body" text,
  "received_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_mail_account_id_mail_accounts_id_fk" FOREIGN KEY ("mail_account_id") REFERENCES "public"."mail_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "mail_accounts_tenant_idx" ON "mail_accounts" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "mail_accounts_user_idx" ON "mail_accounts" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "email_replies_email_idx" ON "email_replies" USING btree ("email_id");
--> statement-breakpoint
CREATE INDEX "email_replies_prospect_idx" ON "email_replies" USING btree ("prospect_id");
--> statement-breakpoint
CREATE INDEX "email_replies_provider_message_idx" ON "email_replies" USING btree ("provider_message_id");
