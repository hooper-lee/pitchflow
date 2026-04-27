CREATE TYPE "public"."agent_channel" AS ENUM(
  'web',
  'feishu',
  'wecom',
  'api'
);
--> statement-breakpoint
CREATE TYPE "public"."agent_message_role" AS ENUM(
  'system',
  'user',
  'assistant',
  'tool'
);
--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM(
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'requires_approval'
);
--> statement-breakpoint
CREATE TYPE "public"."agent_tool_call_status" AS ENUM(
  'pending',
  'running',
  'completed',
  'failed',
  'blocked',
  'requires_approval'
);
--> statement-breakpoint
CREATE TYPE "public"."agent_risk_level" AS ENUM(
  'low',
  'medium',
  'high'
);
--> statement-breakpoint
CREATE TYPE "public"."agent_usage_type" AS ENUM(
  'model',
  'tool',
  'conversation'
);
--> statement-breakpoint

CREATE TABLE "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "system_prompt" text,
  "model_provider" varchar(100),
  "model_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "enabled_toolkits" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "enabled_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "approval_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agents_tenant_idx" ON "agents" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "agents_created_by_idx" ON "agents" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX "agents_active_idx" ON "agents" USING btree ("is_active");
--> statement-breakpoint

CREATE TABLE "agent_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "agent_id" uuid NOT NULL,
  "channel" "agent_channel" DEFAULT 'web' NOT NULL,
  "channel_conversation_id" varchar(255),
  "title" varchar(500),
  "context_type" varchar(100),
  "context_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_conversations"
  ADD CONSTRAINT "agent_conversations_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_conversations"
  ADD CONSTRAINT "agent_conversations_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_conversations"
  ADD CONSTRAINT "agent_conversations_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_conversations_tenant_idx" ON "agent_conversations" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "agent_conversations_user_idx" ON "agent_conversations" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "agent_conversations_agent_idx" ON "agent_conversations" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "agent_conversations_channel_conversation_idx" ON "agent_conversations" USING btree ("channel","channel_conversation_id");
--> statement-breakpoint
CREATE INDEX "agent_conversations_created_at_idx" ON "agent_conversations" USING btree ("created_at");
--> statement-breakpoint

CREATE TABLE "agent_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "role" "agent_message_role" NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_messages"
  ADD CONSTRAINT "agent_messages_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_messages"
  ADD CONSTRAINT "agent_messages_conversation_id_agent_conversations_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_messages_tenant_idx" ON "agent_messages" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "agent_messages_conversation_idx" ON "agent_messages" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX "agent_messages_role_idx" ON "agent_messages" USING btree ("role");
--> statement-breakpoint
CREATE INDEX "agent_messages_created_at_idx" ON "agent_messages" USING btree ("created_at");
--> statement-breakpoint

CREATE TABLE "agent_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "agent_id" uuid NOT NULL,
  "conversation_id" uuid,
  "channel" "agent_channel" DEFAULT 'web' NOT NULL,
  "status" "agent_run_status" DEFAULT 'queued' NOT NULL,
  "intent" varchar(100),
  "input" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output" jsonb,
  "error_message" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_conversation_id_agent_conversations_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_runs_tenant_idx" ON "agent_runs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "agent_runs_user_idx" ON "agent_runs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "agent_runs_agent_idx" ON "agent_runs" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "agent_runs_conversation_idx" ON "agent_runs" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "agent_runs_created_at_idx" ON "agent_runs" USING btree ("created_at");
--> statement-breakpoint

CREATE TABLE "agent_tool_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "agent_id" uuid NOT NULL,
  "conversation_id" uuid,
  "run_id" uuid NOT NULL,
  "tool_name" varchar(255) NOT NULL,
  "toolkit" varchar(100) NOT NULL,
  "input" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output" jsonb,
  "status" "agent_tool_call_status" DEFAULT 'pending' NOT NULL,
  "risk_level" "agent_risk_level" DEFAULT 'low' NOT NULL,
  "approval_id" uuid,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "agent_tool_calls"
  ADD CONSTRAINT "agent_tool_calls_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_tool_calls"
  ADD CONSTRAINT "agent_tool_calls_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_tool_calls"
  ADD CONSTRAINT "agent_tool_calls_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_tool_calls"
  ADD CONSTRAINT "agent_tool_calls_conversation_id_agent_conversations_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_tool_calls"
  ADD CONSTRAINT "agent_tool_calls_run_id_agent_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_tool_calls_tenant_idx" ON "agent_tool_calls" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "agent_tool_calls_user_idx" ON "agent_tool_calls" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "agent_tool_calls_agent_idx" ON "agent_tool_calls" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "agent_tool_calls_conversation_idx" ON "agent_tool_calls" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX "agent_tool_calls_run_idx" ON "agent_tool_calls" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "agent_tool_calls_tool_idx" ON "agent_tool_calls" USING btree ("toolkit","tool_name");
--> statement-breakpoint
CREATE INDEX "agent_tool_calls_status_idx" ON "agent_tool_calls" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "agent_tool_calls_created_at_idx" ON "agent_tool_calls" USING btree ("created_at");
--> statement-breakpoint

CREATE TABLE "agent_usage_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "agent_id" uuid,
  "run_id" uuid,
  "usage_type" "agent_usage_type" NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "tool_calls" integer DEFAULT 0 NOT NULL,
  "credits" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_usage_records"
  ADD CONSTRAINT "agent_usage_records_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_usage_records"
  ADD CONSTRAINT "agent_usage_records_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_usage_records"
  ADD CONSTRAINT "agent_usage_records_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_usage_records"
  ADD CONSTRAINT "agent_usage_records_run_id_agent_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_usage_records_tenant_idx" ON "agent_usage_records" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "agent_usage_records_user_idx" ON "agent_usage_records" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "agent_usage_records_agent_idx" ON "agent_usage_records" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "agent_usage_records_run_idx" ON "agent_usage_records" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "agent_usage_records_usage_type_idx" ON "agent_usage_records" USING btree ("usage_type");
--> statement-breakpoint
CREATE INDEX "agent_usage_records_created_at_idx" ON "agent_usage_records" USING btree ("created_at");
