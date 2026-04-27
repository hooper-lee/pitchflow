CREATE TYPE "public"."agent_approval_status" AS ENUM(
  'pending',
  'approved',
  'rejected',
  'expired'
);
--> statement-breakpoint

CREATE TABLE "agent_action_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "agent_id" uuid NOT NULL,
  "run_id" uuid,
  "tool_call_id" uuid,
  "tool_name" varchar(255) NOT NULL,
  "input" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "agent_approval_status" DEFAULT 'pending' NOT NULL,
  "reason" text,
  "decided_by" uuid,
  "decided_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_action_approvals"
  ADD CONSTRAINT "agent_action_approvals_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_action_approvals"
  ADD CONSTRAINT "agent_action_approvals_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_action_approvals"
  ADD CONSTRAINT "agent_action_approvals_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_action_approvals"
  ADD CONSTRAINT "agent_action_approvals_run_id_agent_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_action_approvals"
  ADD CONSTRAINT "agent_action_approvals_tool_call_id_agent_tool_calls_id_fk"
  FOREIGN KEY ("tool_call_id") REFERENCES "public"."agent_tool_calls"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_action_approvals"
  ADD CONSTRAINT "agent_action_approvals_decided_by_users_id_fk"
  FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_action_approvals_tenant_idx" ON "agent_action_approvals" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "agent_action_approvals_agent_idx" ON "agent_action_approvals" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "agent_action_approvals_run_idx" ON "agent_action_approvals" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "agent_action_approvals_status_idx" ON "agent_action_approvals" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "agent_action_approvals_created_at_idx" ON "agent_action_approvals" USING btree ("created_at");
--> statement-breakpoint

CREATE TABLE "agent_channel_bindings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "channel" "agent_channel" NOT NULL,
  "external_user_id" varchar(255) NOT NULL,
  "external_open_id" varchar(255),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_channel_bindings"
  ADD CONSTRAINT "agent_channel_bindings_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_channel_bindings"
  ADD CONSTRAINT "agent_channel_bindings_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_channel_bindings_tenant_idx" ON "agent_channel_bindings" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "agent_channel_bindings_user_idx" ON "agent_channel_bindings" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "agent_channel_bindings"
  ADD CONSTRAINT "agent_channel_bindings_channel_external_unique"
  UNIQUE("channel","external_user_id");
