CREATE TYPE "public"."discovery_job_status" AS ENUM(
  'pending',
  'searching',
  'crawling',
  'filtering',
  'scoring',
  'reviewing',
  'completed',
  'failed',
  'cancelled'
);
--> statement-breakpoint
CREATE TYPE "public"."discovery_candidate_decision" AS ENUM(
  'pending',
  'accepted',
  'rejected',
  'needs_review',
  'blacklisted',
  'saved'
);
--> statement-breakpoint
CREATE TYPE "public"."discovery_feedback_action" AS ENUM(
  'accept',
  'reject',
  'blacklist',
  'restore',
  'save_to_prospect'
);
--> statement-breakpoint
CREATE TYPE "public"."blocklist_type" AS ENUM(
  'domain',
  'company',
  'keyword',
  'category',
  'pattern'
);
--> statement-breakpoint
CREATE TYPE "public"."blocklist_scope" AS ENUM(
  'tenant',
  'user',
  'icp_profile'
);
--> statement-breakpoint

CREATE TABLE "icp_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "name" varchar(255) NOT NULL,
  "description" text,
  "industry" varchar(255),
  "target_customer_text" text,
  "must_have" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "must_not_have" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "positive_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "negative_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "product_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "sales_model" varchar(100),
  "score_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "min_score_to_save" integer DEFAULT 80 NOT NULL,
  "min_score_to_review" integer DEFAULT 60 NOT NULL,
  "prompt_template" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "icp_profiles"
  ADD CONSTRAINT "icp_profiles_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "icp_profiles"
  ADD CONSTRAINT "icp_profiles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "icp_profiles_tenant_idx" ON "icp_profiles" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "icp_profiles_user_idx" ON "icp_profiles" USING btree ("user_id");
--> statement-breakpoint

CREATE TABLE "lead_discovery_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "icp_profile_id" uuid,
  "name" varchar(255) NOT NULL,
  "status" "discovery_job_status" DEFAULT 'pending' NOT NULL,
  "industry" varchar(255),
  "country" varchar(100),
  "keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "input_query" text,
  "filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "target_limit" integer DEFAULT 50 NOT NULL,
  "searched_count" integer DEFAULT 0 NOT NULL,
  "crawled_count" integer DEFAULT 0 NOT NULL,
  "candidate_count" integer DEFAULT 0 NOT NULL,
  "accepted_count" integer DEFAULT 0 NOT NULL,
  "rejected_count" integer DEFAULT 0 NOT NULL,
  "saved_count" integer DEFAULT 0 NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "started_at" timestamp,
  "finished_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_discovery_jobs"
  ADD CONSTRAINT "lead_discovery_jobs_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_discovery_jobs"
  ADD CONSTRAINT "lead_discovery_jobs_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_discovery_jobs"
  ADD CONSTRAINT "lead_discovery_jobs_icp_profile_id_icp_profiles_id_fk"
  FOREIGN KEY ("icp_profile_id") REFERENCES "public"."icp_profiles"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "lead_discovery_jobs_tenant_idx" ON "lead_discovery_jobs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "lead_discovery_jobs_user_idx" ON "lead_discovery_jobs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "lead_discovery_jobs_status_idx" ON "lead_discovery_jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "lead_discovery_jobs_created_at_idx" ON "lead_discovery_jobs" USING btree ("created_at");
--> statement-breakpoint

CREATE TABLE "lead_discovery_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "icp_profile_id" uuid,
  "created_prospect_id" uuid,
  "url" text,
  "final_url" text,
  "domain" varchar(255),
  "root_domain" varchar(255),
  "company_name" varchar(500),
  "title" text,
  "snippet" text,
  "source" varchar(100),
  "search_query" text,
  "pages_fetched" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "raw_text" text,
  "detector_score" integer,
  "detector_dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "rule_score" integer,
  "ai_score" integer,
  "feedback_score" integer,
  "final_score" integer,
  "decision" "discovery_candidate_decision" DEFAULT 'pending' NOT NULL,
  "reject_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "matched_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "contacts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "lead_candidates_job_root_domain_unique" UNIQUE("job_id","root_domain")
);
--> statement-breakpoint
ALTER TABLE "lead_discovery_candidates"
  ADD CONSTRAINT "lead_discovery_candidates_job_id_lead_discovery_jobs_id_fk"
  FOREIGN KEY ("job_id") REFERENCES "public"."lead_discovery_jobs"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_discovery_candidates"
  ADD CONSTRAINT "lead_discovery_candidates_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_discovery_candidates"
  ADD CONSTRAINT "lead_discovery_candidates_icp_profile_id_icp_profiles_id_fk"
  FOREIGN KEY ("icp_profile_id") REFERENCES "public"."icp_profiles"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_discovery_candidates"
  ADD CONSTRAINT "lead_discovery_candidates_created_prospect_id_prospects_id_fk"
  FOREIGN KEY ("created_prospect_id") REFERENCES "public"."prospects"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "lead_candidates_tenant_idx" ON "lead_discovery_candidates" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "lead_candidates_job_idx" ON "lead_discovery_candidates" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX "lead_candidates_root_domain_idx" ON "lead_discovery_candidates" USING btree ("root_domain");
--> statement-breakpoint
CREATE INDEX "lead_candidates_decision_idx" ON "lead_discovery_candidates" USING btree ("decision");
--> statement-breakpoint
CREATE INDEX "lead_candidates_final_score_idx" ON "lead_discovery_candidates" USING btree ("final_score");
--> statement-breakpoint

CREATE TABLE "lead_discovery_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "job_id" uuid,
  "candidate_id" uuid NOT NULL,
  "icp_profile_id" uuid,
  "action" "discovery_feedback_action" NOT NULL,
  "reason" text,
  "reason_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_discovery_feedback"
  ADD CONSTRAINT "lead_discovery_feedback_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_discovery_feedback"
  ADD CONSTRAINT "lead_discovery_feedback_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_discovery_feedback"
  ADD CONSTRAINT "lead_discovery_feedback_job_id_lead_discovery_jobs_id_fk"
  FOREIGN KEY ("job_id") REFERENCES "public"."lead_discovery_jobs"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_discovery_feedback"
  ADD CONSTRAINT "lead_discovery_feedback_candidate_id_lead_discovery_candidates_id_fk"
  FOREIGN KEY ("candidate_id") REFERENCES "public"."lead_discovery_candidates"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_discovery_feedback"
  ADD CONSTRAINT "lead_discovery_feedback_icp_profile_id_icp_profiles_id_fk"
  FOREIGN KEY ("icp_profile_id") REFERENCES "public"."icp_profiles"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "lead_discovery_feedback_tenant_idx" ON "lead_discovery_feedback" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "lead_discovery_feedback_candidate_idx" ON "lead_discovery_feedback" USING btree ("candidate_id");
--> statement-breakpoint
CREATE INDEX "lead_discovery_feedback_action_idx" ON "lead_discovery_feedback" USING btree ("action");
--> statement-breakpoint

CREATE TABLE "lead_blocklist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "icp_profile_id" uuid,
  "type" "blocklist_type" NOT NULL,
  "value" varchar(500) NOT NULL,
  "normalized_value" varchar(500) NOT NULL,
  "reason" text,
  "scope" "blocklist_scope" DEFAULT 'tenant' NOT NULL,
  "source_candidate_id" uuid,
  "source_job_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "lead_blocklist_unique" UNIQUE("tenant_id","type","normalized_value","scope","icp_profile_id")
);
--> statement-breakpoint
ALTER TABLE "lead_blocklist"
  ADD CONSTRAINT "lead_blocklist_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_blocklist"
  ADD CONSTRAINT "lead_blocklist_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_blocklist"
  ADD CONSTRAINT "lead_blocklist_icp_profile_id_icp_profiles_id_fk"
  FOREIGN KEY ("icp_profile_id") REFERENCES "public"."icp_profiles"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_blocklist"
  ADD CONSTRAINT "lead_blocklist_source_candidate_id_lead_discovery_candidates_id_fk"
  FOREIGN KEY ("source_candidate_id") REFERENCES "public"."lead_discovery_candidates"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_blocklist"
  ADD CONSTRAINT "lead_blocklist_source_job_id_lead_discovery_jobs_id_fk"
  FOREIGN KEY ("source_job_id") REFERENCES "public"."lead_discovery_jobs"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "lead_blocklist_tenant_idx" ON "lead_blocklist" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "lead_blocklist_normalized_value_idx" ON "lead_blocklist" USING btree ("normalized_value");
--> statement-breakpoint
CREATE INDEX "lead_blocklist_type_idx" ON "lead_blocklist" USING btree ("type");
